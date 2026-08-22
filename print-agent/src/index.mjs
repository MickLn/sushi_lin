import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { printTicketToPrinter, writeTicketFile } from "./printer.mjs";
import { formatTicket, parseTicketOrder } from "./ticket.mjs";

const DEFAULT_CLOUD_POLL_INTERVAL_MS = 20_000;
const DEFAULT_FILESYSTEM_POLL_INTERVAL_MS = 5_000;
const PRINT_AGENT_SECRET_HEADER = "x-hokkaido-print-secret";
const REQUEST_TIMEOUT_MS = 10_000;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function getPollInterval(fallback) {
  const configured = Number.parseInt(process.env.POLL_INTERVAL_MS ?? "", 10);
  return Number.isInteger(configured) && configured >= 1_000 ? configured : fallback;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAgentMode() {
  const configuredUrl = process.env.PRINT_API_URL?.trim();
  if (configuredUrl === undefined || configuredUrl.length === 0) {
    return { kind: "filesystem" };
  }

  const secret = process.env.PRINT_AGENT_SECRET;
  if (secret === undefined || secret.length === 0) {
    return { kind: "invalid", message: "PRINT_AGENT_SECRET est requis avec PRINT_API_URL." };
  }

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { kind: "invalid", message: "PRINT_API_URL doit utiliser HTTP ou HTTPS." };
    }
    return { kind: "cloud", apiUrl: configuredUrl.replace(/\/+$/, ""), secret };
  } catch (error) {
    return { kind: "invalid", message: `PRINT_API_URL est invalide : ${getErrorMessage(error)}` };
  }
}

function getPrintConfiguration() {
  const printMode = process.env.PRINT_MODE ?? "file";
  if (printMode !== "file" && printMode !== "printer") {
    throw new Error("PRINT_MODE doit être file ou printer.");
  }

  return {
    dryRun: process.env.PRINTER_DRY_RUN === "1",
    outputDirectory: process.env.PRINT_OUTPUT_DIR ?? "/data/tickets",
    printMode,
    printerAddress: process.env.PRINTER_ADDRESS,
    printerInterface: process.env.PRINTER_INTERFACE,
    printerType: process.env.PRINTER_TYPE,
  };
}

function parseQueuePayload(value) {
  if (!isRecord(value) || !Object.hasOwn(value, "order")) {
    return { kind: "invalid" };
  }

  if (value.order === null) {
    return { kind: "empty" };
  }

  const order = parseTicketOrder(value.order);
  return order === null ? { kind: "invalid" } : { kind: "order", order };
}

async function getNextOrder(cloud) {
  try {
    const response = await fetch(`${cloud.apiUrl}/api/print/next`, {
      cache: "no-store",
      headers: { [PRINT_AGENT_SECRET_HEADER]: cloud.secret },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[print-agent] the print queue returned HTTP ${response.status}`);
      return { kind: "retry" };
    }

    return parseQueuePayload(await response.json());
  } catch (error) {
    console.error(`[print-agent] unable to reach the print queue: ${getErrorMessage(error)}`);
    return { kind: "retry" };
  }
}

async function markOrder(cloud, number, failed) {
  try {
    const response = await fetch(`${cloud.apiUrl}/api/print/marked`, {
      body: JSON.stringify({ failed, number }),
      headers: {
        "content-type": "application/json",
        [PRINT_AGENT_SECRET_HEADER]: cloud.secret,
      },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[print-agent] unable to acknowledge ${number}: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[print-agent] unable to acknowledge ${number}: ${getErrorMessage(error)}`);
    return false;
  }
}

async function outputTicket(order, ticket, configuration) {
  if (configuration.printMode === "file") {
    const filePath = await writeTicketFile({
      orderNumber: order.number,
      outputDirectory: configuration.outputDirectory,
      ticket,
    });
    console.log(`[print-agent] wrote ${order.number} to ${filePath}`);
    return;
  }

  const result = await printTicketToPrinter({
    dryRun: configuration.dryRun,
    order,
    orderNumber: order.number,
    outputDirectory: configuration.outputDirectory,
    printerAddress: configuration.printerAddress,
    printerInterface: configuration.printerInterface,
    printerType: configuration.printerType,
  });
  if (result.dryRunFilePath === null) {
    console.log(`[print-agent] sent ${order.number} to the thermal printer`);
    return;
  }

  console.log(`[print-agent] wrote ESC/POS dry-run bytes for ${order.number} to ${result.dryRunFilePath}`);
}

let isCloudPolling = false;

async function pollCloud(cloud, configuration) {
  if (isCloudPolling) {
    return;
  }

  isCloudPolling = true;
  try {
    const queue = await getNextOrder(cloud);
    if (queue.kind !== "order") {
      if (queue.kind === "invalid") {
        console.error("[print-agent] the print queue returned an invalid ticket payload");
      }
      return;
    }

    const ticket = formatTicket(queue.order);
    try {
      await outputTicket(queue.order, ticket, configuration);
    } catch (error) {
      console.error(`[print-agent] unable to print ${queue.order.number}: ${getErrorMessage(error)}`);
      if (await markOrder(cloud, queue.order.number, true)) {
        console.log(`[print-agent] marked ${queue.order.number} as FAILED`);
      }
      return;
    }

    if (await markOrder(cloud, queue.order.number, false)) {
      console.log(`[print-agent] marked ${queue.order.number} as PRINTED`);
    }
  } finally {
    isCloudPolling = false;
  }
}

function isTicketFile(fileName) {
  return fileName.endsWith(".txt") || fileName.endsWith(".bin");
}

async function startFilesystemPolling(outputDirectory) {
  const printedVersions = new Map();
  let isScanning = false;

  async function scanTickets() {
    if (isScanning) {
      return;
    }

    isScanning = true;
    try {
      const entries = await readdir(outputDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !isTicketFile(entry.name)) {
          continue;
        }

        const ticketPath = join(outputDirectory, entry.name);
        const ticketStat = await stat(ticketPath);
        if (printedVersions.get(ticketPath) === ticketStat.mtimeMs) {
          continue;
        }

        const content = await readFile(ticketPath);
        const renderedTicket = entry.name.endsWith(".bin") ? content.toString("hex") : content.toString("utf8");
        console.log(`[print-agent] printing ${entry.name}\n${renderedTicket}\n---`);
        printedVersions.set(ticketPath, ticketStat.mtimeMs);
      }
    } catch (error) {
      console.error(`[print-agent] unable to scan ticket directory: ${getErrorMessage(error)}`);
    } finally {
      isScanning = false;
    }
  }

  await mkdir(outputDirectory, { recursive: true });
  console.log(`[print-agent] ready; polling ${outputDirectory}`);
  await scanTickets();
  setInterval(() => {
    void scanTickets();
  }, getPollInterval(DEFAULT_FILESYSTEM_POLL_INTERVAL_MS));
}

async function main() {
  const agentMode = getAgentMode();
  if (agentMode.kind === "invalid") {
    throw new Error(agentMode.message);
  }

  const configuration = getPrintConfiguration();
  if (agentMode.kind === "filesystem") {
    await startFilesystemPolling(configuration.outputDirectory);
    return;
  }

  const pollInterval = getPollInterval(DEFAULT_CLOUD_POLL_INTERVAL_MS);
  console.log(`[print-agent] ready; polling ${agentMode.apiUrl} every ${pollInterval} ms in ${configuration.printMode} mode`);
  await pollCloud(agentMode, configuration);
  setInterval(() => {
    void pollCloud(agentMode, configuration);
  }, pollInterval);
}

void main().catch((error) => {
  console.error(`[print-agent] configuration error: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
