import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { BreakLine, CharacterSet, PrinterTypes, ThermalPrinter } from "node-thermal-printer";

import { renderThermalTicket } from "./receipt.mjs";
import { safeTicketFileName } from "./ticket.mjs";

function getPrinterType(value) {
  switch ((value ?? "EPSON").trim().toUpperCase()) {
    case "EPSON":
      return PrinterTypes.EPSON;
    case "STAR":
      return PrinterTypes.STAR;
    default:
      throw new Error("PRINTER_TYPE doit être EPSON ou STAR.");
  }
}

function toSystemPrinterAddress(address) {
  if (address.startsWith("printer://")) {
    return `printer:${address.slice("printer://".length).replace(/^\/+/, "")}`;
  }

  return address.startsWith("printer:") ? address : `printer:${address}`;
}

function getPrinterAddress({ dryRun, printerAddress, printerInterface }) {
  const address = printerAddress?.trim();
  if (address === undefined || address.length === 0) {
    if (dryRun) {
      return "tcp://127.0.0.1:9100";
    }
    throw new Error("PRINTER_ADDRESS est requis avec PRINT_MODE=printer.");
  }

  switch ((printerInterface ?? "tcp").trim().toLowerCase()) {
    case "tcp":
    case "tcp://":
      return address.startsWith("tcp://") ? address : `tcp://${address}`;
    case "printer":
    case "printer:":
    case "printer://":
      return toSystemPrinterAddress(address);
    case "path":
    case "file":
      return address;
    default:
      throw new Error("PRINTER_INTERFACE doit être tcp, printer ou path.");
  }
}

function createCupsDriver() {
  return {
    getPrinter(printerName) {
      return { name: printerName, status: "AVAILABLE" };
    },
    getPrinters() {
      return [];
    },
    printDirect({ data, error, printer: printerName, success }) {
      const process = spawn("lp", ["-d", printerName, "-o", "raw"], {
        stdio: ["pipe", "ignore", "pipe"],
      });
      let complete = false;
      let errorOutput = "";
      const fail = (reason) => {
        if (!complete) {
          complete = true;
          error(reason);
        }
      };

      process.stderr.on("data", (chunk) => {
        if (errorOutput.length < 500) {
          errorOutput += chunk.toString("utf8");
        }
      });
      process.once("error", fail);
      process.stdin.once("error", fail);
      process.once("close", (exitCode) => {
        if (complete) {
          return;
        }
        if (exitCode === 0) {
          complete = true;
          success(`Printed with CUPS queue ${printerName}`);
          return;
        }
        fail(new Error(errorOutput.trim() || `La file CUPS a quitté avec le code ${exitCode}.`));
      });
      process.stdin.end(data);
    },
  };
}

function createThermalPrinter({ dryRun, printerAddress, printerInterface, printerType }) {
  const interfaceAddress = getPrinterAddress({ dryRun, printerAddress, printerInterface });
  const config = {
    breakLine: BreakLine.WORD,
    characterSet: CharacterSet.PC858_EURO,
    interface: interfaceAddress,
    options: { timeout: 5000 },
    removeSpecialCharacters: true,
    type: getPrinterType(printerType),
    // 48 characters in Epson Font A (12-dot wide) fill the 576-dot printable
    // width of an 80mm receipt; the receipt always selects Font A itself.
    width: 48,
  };

  return interfaceAddress.startsWith("printer:")
    ? new ThermalPrinter({ ...config, driver: createCupsDriver() })
    : new ThermalPrinter(config);
}

export async function writeTicketFile({ orderNumber, outputDirectory, ticket }) {
  await mkdir(outputDirectory, { recursive: true });
  const filePath = join(outputDirectory, `${safeTicketFileName(orderNumber)}.txt`);
  await writeFile(filePath, ticket, "utf8");
  return filePath;
}

import { Socket } from "node:net";

function sendBufferToTcpPrinter(address, buffer) {
  const cleanAddr = address.replace(/^tcp:\/\//, "");
  const [host, portStr] = cleanAddr.split(":");
  const port = Number.parseInt(portStr || "9100", 10);

  // Prepend ESC @ (init) and FS . (cancel Chinese/Kanji mode)
  const initSeq = Buffer.from([0x1b, 0x40, 0x1c, 0x2e]);
  const finalBuffer = Buffer.concat([initSeq, buffer]);

  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let handled = false;

    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true;
        socket.destroy();
        reject(new Error(`Timeout de connexion vers l'imprimante ${host}:${port}`));
      }
    }, 6000);

    socket.on("error", (err) => {
      if (!handled) {
        handled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.write(finalBuffer, () => {
        setTimeout(() => {
          if (!handled) {
            handled = true;
            socket.destroy();
            resolve();
          }
        }, 1200);
      });
    });
  });
}

export async function printTicketToPrinter({
  dryRun,
  order,
  orderNumber,
  outputDirectory,
  printerAddress,
  printerInterface,
  printerType,
}) {
  const printer = createThermalPrinter({ dryRun, printerAddress, printerInterface, printerType });
  renderThermalTicket(printer, order);
  // Minimal feed before the cut: one vertical tab instead of the default two.
  printer.cut({ verticalTabAmount: 1 });

  if (dryRun) {
    await mkdir(outputDirectory, { recursive: true });
    const filePath = join(outputDirectory, `${safeTicketFileName(orderNumber)}.bin`);
    await writeFile(filePath, printer.getBuffer());
    return { dryRunFilePath: filePath };
  }

  const iface = (printerInterface ?? "tcp").trim().toLowerCase();
  if (iface === "tcp" || printerAddress?.startsWith("tcp://") || (!printerAddress?.startsWith("printer:") && !printerAddress?.startsWith("path:"))) {
    await sendBufferToTcpPrinter(printerAddress, printer.getBuffer());
    return { dryRunFilePath: null };
  }

  await printer.execute();
  return { dryRunFilePath: null };
}
