import {
  extractPostalCode,
  formatAmount,
  formatDateTime,
  formatEuro,
  formatOrderType,
  formatPaymentMethod,
  formatPickupTime,
  formatSauce,
  formatServiceDate,
  getRestaurantHeader,
  itemLineAmountCents,
  stripAccents,
} from "./ticket.mjs";

// Column widths (in characters) for the Q. / Code / Designation / P.U.TTC /
// Total table. They sum to 48 so the table fills the 80mm paper in Font A.
const TABLE_QTY_COLS = 3;
const TABLE_CODE_COLS = 6;
const TABLE_DESIGNATION_COLS = 21;
const TABLE_UNIT_COLS = 9;
const TABLE_TOTAL_COLS = 9;

function isPresent(value) {
  return value !== undefined && value !== null;
}

function printRestaurantHeader(printer, header) {
  printer.alignCenter();
  printer.bold(true);
  printer.println(stripAccents(header.name));
  printer.bold(false);
  printer.println(stripAccents(header.address));
  printer.println(stripAccents(header.city));
  printer.println(`Tel. : ${header.phone}`);
  printer.println(`Site : ${header.site}`);
  printer.alignLeft();
}

function printCustomerBlock(printer, order) {
  printer.bold(true);
  printer.println(`N. commande :   ${order.number}`);
  printer.bold(false);

  const serviceDate = formatServiceDate(order);
  if (serviceDate !== undefined) {
    printer.println(`Date :          ${serviceDate}`);
  }
  const pickupTime = formatPickupTime(order.timeWindow || order.pickupTime);
  if (pickupTime !== undefined) {
    printer.println(`Heure retrait : ${pickupTime}`);
  }

  printer.println(`Nom client :    ${stripAccents(order.customerName)}`);
  printer.bold(true);
  printer.println(`Telephone :     ${order.customerPhone}`);
  printer.bold(false);

  if (isPresent(order.customerEmail)) {
    printer.println(`Email :         ${order.customerEmail}`);
  }
}

function printPreferencesBlock(printer, order) {
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

  if (preferences.length === 0) {
    return;
  }

  printer.drawLine("-");
  for (const pref of preferences) {
    printer.println(pref);
  }
}

function printBanner(printer) {
  printer.bold(true);
  printer.println("A emporter");
  printer.bold(false);
}

function isItemDiscountEligible(item) {
  const code = (item.code || item.id || "").toUpperCase().trim();
  const name = (item.name || "").toLowerCase().trim();
  if (code.startsWith("D") && /^D\d+$/.test(code)) return false;
  if (code.startsWith("DS")) return false;
  if (
    name.includes("coca") ||
    name.includes("eau") ||
    name.includes("evian") ||
    name.includes("san pellegrino") ||
    name.includes("biere") ||
    name.includes("vin") ||
    name.includes("tsingtao") ||
    name.includes("asah") ||
    name.includes("kirin") ||
    name.includes("mochi") ||
    name.includes("dorayaki") ||
    name.includes("lychee") ||
    name.includes("mystere") ||
    name.includes("perle de coco") ||
    name.includes("fondant") ||
    name.includes("dessert") ||
    name.includes("boisson")
  ) {
    return false;
  }
  return true;
}

function wrapWords(text, maxLen) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxLen) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

function printItemsTable(printer, order) {
  printer.setTextNormal();
  printer.bold(true);
  printer.leftRight("QTE / CODE   DESIGNATION", "TOTAL");
  printer.bold(false);
  printer.newLine();

  for (const item of order.items) {
    const lineTotalCents = itemLineAmountCents(item);
    const itemCode = item.code ?? "—";
    const isEligible = isItemDiscountEligible(item);
    const discountedLineCents = isEligible && lineTotalCents !== undefined ? Math.round(lineTotalCents * 0.9) : lineTotalCents;

    // 1. Quantity & Code in Double Width + Double Height (Quad Area) & Bold
    printer.setTextQuadArea();
    printer.bold(true);
    printer.println(`${item.quantity}x  [ ${itemCode} ]`);

    // 2. Designation & Original Price in BOLD and UPPERCASE with natural word wrapping
    printer.setTextNormal();
    printer.bold(true);

    const totalText = lineTotalCents === undefined ? "" : formatEuro(lineTotalCents);
    const fullName = stripAccents(item.name).toUpperCase().trim();
    // Max characters on first line alongside right-aligned total
    const maxFirstLineLen = Math.max(10, 48 - 3 - totalText.length - 2);
    const nameLines = wrapWords(fullName, maxFirstLineLen);

    // Line 1: first part of name + Total on right
    printer.leftRight(`   ${nameLines[0]}`, totalText);

    // Additional lines: remaining parts of name indented
    for (let i = 1; i < nameLines.length; i++) {
      printer.println(`   ${nameLines[i]}`);
    }

    printer.bold(false);

    // 3. Discounted line total underneath in same Total column
    if (isEligible && lineTotalCents !== undefined && discountedLineCents < lineTotalCents) {
      const discountedText = formatEuro(discountedLineCents);
      printer.leftRight(`   (-10% remise)`, discountedText);
    }

    for (const selectedOption of item.selectedOptions) {
      printer.println(`     - ${stripAccents(selectedOption.name)}`);
    }
    printer.newLine();
  }
}

function printTotals(printer, order) {
  const subtotalCents = order.subtotalCents ?? order.totalCents;
  const discountCents = order.discountCents;

  if (discountCents !== undefined && discountCents > 0) {
    printer.leftRight("Sous-total :", formatEuro(subtotalCents));
    printer.leftRight("Remise a emporter (-10%) :", `-${formatEuro(discountCents)}`);
  }

  const totalStr = formatEuro(order.totalCents);
  printer.leftRight("Total TTC :", totalStr);
  printer.newLine();
  printer.alignCenter();
  printer.bold(true);
  printer.println(`Net a payer : ${totalStr}`);
  printer.bold(false);
  printer.alignLeft();
}

export function renderThermalTicket(printer, order, header = getRestaurantHeader()) {
  printer.setTypeFontA();
  printer.setTextNormal();
  printRestaurantHeader(printer, header);
  printer.drawLine("-");

  printCustomerBlock(printer, order);
  printPreferencesBlock(printer, order);
  printer.drawLine("-");

  printBanner(printer);
  printer.drawLine("-");

  printItemsTable(printer, order);
  printer.drawLine("-");

  printTotals(printer, order);
  printer.drawLine("-");

  printer.alignCenter();
  printer.println("Merci de votre visite, a bientot !");
  printer.alignLeft();
  printer.newLine();
}
