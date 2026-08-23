export { parseTicketOrder } from "./parse-ticket.mjs";

export function stripAccents(str) {
  if (typeof str !== "string") return str ?? "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°]/g, ".")
    .replace(/[€]/g, "EUR")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae");
}

function isPresent(value) {
  return value !== undefined && value !== null;
}

export function formatAmount(cents) {
  return `${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function formatEuro(cents) {
  return `${formatAmount(cents)} EUR`;
}

export function formatOrderType(type) {
  return type === "DELIVERY" ? "Livraison" : "A emporter";
}

export function formatSauce(value) {
  switch (value) {
    case "sucree":
      return "Sucree";
    case "salee":
      return "Salee";
    case "les_deux":
      return "Sucree et salee";
    case "aucune":
      return "Pas de sauce";
    default:
      return "Non precisee";
  }
}

export function formatPaymentMethod(value) {
  switch (value) {
    case "carte_bancaire":
      return "Carte bancaire";
    case "titres_restaurant":
      return "Titres restaurant";
    case "carte_restaurant":
      return "Carte restaurant";
    case "especes":
      return "Especes";
    default:
      return "Non precise";
  }
}

// Public restaurant header shown on every ticket. Configurable through
// PRINT_RESTAURANT_* environment variables; these defaults match the
// restaurant signage and are not secrets.
function envOrDefault(env, key, fallback) {
  const value = env[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

export function getRestaurantHeader(env = process.env) {
  return {
    name: envOrDefault(env, "PRINT_RESTAURANT_NAME", "SUSHI LIN"),
    address: envOrDefault(env, "PRINT_RESTAURANT_ADDRESS", "32 Rue des Dames"),
    city: envOrDefault(env, "PRINT_RESTAURANT_CITY", "78340 Les Clayes-sous-Bois"),
    phone: envOrDefault(env, "PRINT_RESTAURANT_PHONE", "01 30 79 00 88"),
    site: envOrDefault(env, "PRINT_RESTAURANT_SITE", "https://sushilin.fr"),
  };
}

// Preferred line total: the server-computed value (base price plus selected
// option deltas, times the quantity). Legacy payloads without it fall back to
// the stored unit price times the quantity.
export function itemLineAmountCents(item) {
  if (item.lineTotalCents !== undefined) {
    return item.lineTotalCents;
  }
  if (item.unitPriceCents === undefined) {
    return undefined;
  }
  const optionDeltaCents = item.selectedOptions.reduce((sum, option) => sum + (option.priceDeltaCents ?? 0), 0);
  return (item.unitPriceCents + optionDeltaCents) * item.quantity;
}

export function formatPickupTime(value) {
  if (!value) return undefined;
  let str = String(value).trim();
  if (str.includes("~")) {
    str = str.split("~")[0].trim();
  } else if (str.includes(" - ")) {
    str = str.split(" - ")[0].trim();
  }
  return str;
}

// Date vient de la date de service (YYYY-MM-DD -> DD/MM/YYYY).
export function formatServiceDate(order) {
  if (order.serviceDate !== undefined) {
    return `${order.serviceDate.slice(8, 10)}/${order.serviceDate.slice(5, 7)}/${order.serviceDate.slice(0, 4)}`;
  }
  const dateTime = formatDateTime(order.createdAt);
  return dateTime === undefined ? undefined : dateTime.slice(0, 5);
}

export function formatDateTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

export function extractPostalCode(address) {
  const match = /\b\d{5}\b/.exec(address);
  return match === null ? undefined : match[0];
}

// 48 characters is the full line width of an 80mm receipt in Epson Font A.
const LINE_WIDTH = 48;
const SEPARATOR = "-".repeat(LINE_WIDTH);
const COL_QTY = 3;
const COL_CODE = 6;
const COL_DESIGNATION = 21;
const COL_UNIT = 9;
const COL_TOTAL = 9;

function padEnd(text, width) {
  return text.length >= width ? text : `${text}${" ".repeat(width - text.length)}`;
}

function padStart(text, width) {
  return text.length >= width ? text : `${" ".repeat(width - text.length)}${text}`;
}

function center(text, width) {
  const padding = Math.max(0, width - text.length);
  const left = Math.floor(padding / 2);
  return `${" ".repeat(left)}${text}${" ".repeat(padding - left)}`;
}

function wrapText(text, width) {
  const lines = [];
  let remaining = text;
  while (remaining.length > width) {
    lines.push(remaining.slice(0, width));
    remaining = remaining.slice(width);
  }
  lines.push(remaining);
  return lines;
}

export function formatHeaderRow() {
  return (
    padEnd("Q.", COL_QTY) +
    padEnd("Code", COL_CODE) +
    padEnd("Designation", COL_DESIGNATION) +
    padStart("P.U.TTC", COL_UNIT) +
    padStart("Total", COL_TOTAL)
  );
}

function formatItemRow(item) {
  const lineTotalCents = itemLineAmountCents(item);
  const perUnitCents = lineTotalCents === undefined ? undefined : Math.round(lineTotalCents / item.quantity);
  const cleanName = stripAccents(item.name);
  const nameLines = wrapText(cleanName, COL_DESIGNATION);
  const lines = [
    padEnd(String(item.quantity), COL_QTY) +
      padEnd(item.code === undefined ? "" : item.code, COL_CODE) +
      padEnd(nameLines[0], COL_DESIGNATION) +
      padStart(perUnitCents === undefined ? "" : formatAmount(perUnitCents), COL_UNIT) +
      padStart(lineTotalCents === undefined ? "" : formatAmount(lineTotalCents), COL_TOTAL),
  ];
  for (const nameChunk of nameLines.slice(1)) {
    lines.push(" ".repeat(COL_QTY + COL_CODE) + padEnd(nameChunk, COL_DESIGNATION));
  }
  return lines;
}

function formatRestaurantHeaderLines(header) {
  return [
    center(stripAccents(header.name), LINE_WIDTH),
    center(stripAccents(header.address), LINE_WIDTH),
    center(stripAccents(header.city), LINE_WIDTH),
    center(`Tel. : ${header.phone}`, LINE_WIDTH),
    center(`Site : ${header.site}`, LINE_WIDTH),
  ];
}

export function formatTicket(order, header = getRestaurantHeader()) {
  const lines = [...formatRestaurantHeaderLines(header), SEPARATOR];

  lines.push(`N. commande :   ${order.number}`);

  const serviceDate = formatServiceDate(order);
  if (serviceDate !== undefined) {
    lines.push(`Date :          ${serviceDate}`);
  }
  const pickupTime = formatPickupTime(order.timeWindow || order.pickupTime);
  if (pickupTime !== undefined) {
    lines.push(`Heure retrait : ${pickupTime}`);
  }

  lines.push(`Nom client :    ${stripAccents(order.customerName)}`);
  lines.push(`Telephone :     ${order.customerPhone}`);

  if (isPresent(order.customerEmail)) {
    lines.push(`Email :         ${order.customerEmail}`);
  }

  const preferences = [];
  if (isPresent(order.note)) {
    preferences.push(`Commentaires :  ${stripAccents(order.note)}`);
  }
  if (isPresent(order.flatwareQty) && order.flatwareQty > 0) {
    preferences.push(`Nb. couverts :  ${order.flatwareQty}`);
  }
  if (isPresent(order.sauce)) {
    preferences.push(`Sauce :         ${formatSauce(order.sauce)}`);
  }

  if (preferences.length > 0) {
    lines.push(SEPARATOR, ...preferences);
  }

  lines.push(SEPARATOR);
  lines.push("A emporter");
  lines.push(SEPARATOR, formatHeaderRow());

  for (const item of order.items) {
    lines.push(...formatItemRow(item));
    for (const selectedOption of item.selectedOptions) {
      lines.push(`  - ${stripAccents(selectedOption.name)}`);
    }
  }
  lines.push(SEPARATOR);

  const totalStr = formatEuro(order.totalCents);
  const totalRow = padStart(totalStr, LINE_WIDTH - "Total TTC :".length);
  lines.push(`Total TTC :${totalRow}`);

  const netLabel = `Net a Payer : ${totalStr}`;
  lines.push(center(netLabel, LINE_WIDTH));

  lines.push(SEPARATOR);
  lines.push(center("Merci de votre visite, a bientot !", LINE_WIDTH));
  lines.push("");

  return lines.join("\n");
}

export function safeTicketFileName(orderNumber) {
  return orderNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
}

