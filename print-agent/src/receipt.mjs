import {
  extractPostalCode,
  formatAmount,
  formatEuro,
  formatOrderType,
  formatPaymentMethod,
  formatSauce,
  formatServiceDate,
  getRestaurantHeader,
  itemLineAmountCents,
} from "./ticket.mjs";

// Column widths (in characters) for the Q. / Code / Désignation / P.U.TTC /
// Total table. They sum to 48 so the table fills the 80mm paper in Font A.
const TABLE_QTY_COLS = 3;
const TABLE_CODE_COLS = 6;
const TABLE_DESIGNATION_COLS = 22;
const TABLE_UNIT_COLS = 8;
const TABLE_TOTAL_COLS = 9;

function isPresent(value) {
  return value !== undefined && value !== null;
}

function printRestaurantHeader(printer, header) {
  printer.alignCenter();
  printer.bold(true);
  printer.println(header.name);
  printer.bold(false);
  printer.println(header.address);
  printer.println(header.city);
  printer.println(`Tél. : ${header.phone}`);
  printer.println(`Site : ${header.site}`);
  printer.alignLeft();
}

function printCustomerBlock(printer, order) {
  printer.println(`N° cmde : ${order.number}`);
  printer.println(`${formatOrderType(order.type)} Commande`);
  printer.println(`Nom du client : ${order.customerName}`);
  printer.println(`Mode de paiement : ${formatPaymentMethod(order.paymentMethod)}`);
  if (isPresent(order.customerEmail)) {
    printer.println(`Email : ${order.customerEmail}`);
  }
  printer.println(`Tél : ${order.customerPhone}`);
  if (order.address) {
    printer.println(`Adresse : ${order.address}`);
    const postalCode = extractPostalCode(order.address);
    if (postalCode !== undefined) {
      printer.println(`Code postal : ${postalCode}`);
    }
  }
}

function printSchedule(printer, order) {
  const serviceDate = formatServiceDate(order);
  if (serviceDate !== undefined) {
    printer.println(`Date liv. : ${serviceDate}`);
  }
  if (isPresent(order.timeWindow)) {
    const label = order.type === "DELIVERY" ? "Heure de livraison" : "Heure de retrait";
    printer.println(`${label} : ${order.timeWindow}`);
  }
}

function printItemsTable(printer, order) {
  printer.tableCustom([
    { text: "Q.", align: "LEFT", cols: TABLE_QTY_COLS, bold: true },
    { text: "Code", align: "LEFT", cols: TABLE_CODE_COLS, bold: true },
    { text: "Désignation", align: "LEFT", cols: TABLE_DESIGNATION_COLS, bold: true },
    { text: "P.U.TTC", align: "LEFT", cols: TABLE_UNIT_COLS, bold: true },
    { text: "Total", align: "LEFT", cols: TABLE_TOTAL_COLS, bold: true },
  ]);

  for (const item of order.items) {
    const lineTotalCents = itemLineAmountCents(item);
    const perUnitCents = lineTotalCents === undefined ? undefined : Math.round(lineTotalCents / item.quantity);
    printer.tableCustom([
      { text: String(item.quantity), align: "LEFT", cols: TABLE_QTY_COLS },
      { text: item.code ?? "", align: "LEFT", cols: TABLE_CODE_COLS },
      { text: item.name, align: "LEFT", cols: TABLE_DESIGNATION_COLS },
      { text: perUnitCents === undefined ? "" : formatAmount(perUnitCents), align: "RIGHT", cols: TABLE_UNIT_COLS },
      { text: lineTotalCents === undefined ? "" : formatAmount(lineTotalCents), align: "RIGHT", cols: TABLE_TOTAL_COLS },
    ]);
    for (const selectedOption of item.selectedOptions) {
      printer.println(`  - ${selectedOption.name}`);
    }
  }
}

function printTotals(printer, order) {
  if (isPresent(order.deliveryFeeCents) && order.type === "DELIVERY") {
    printer.println(`Frais de livraison : ${formatEuro(order.deliveryFeeCents)}`);
  }
  printer.println(`Net : ${formatEuro(order.totalCents)}`);
}

function printPreferences(printer, order) {
  const preferences = [];
  if (isPresent(order.flatwareQty) && order.flatwareQty > 0) {
    preferences.push(`Couvert : ${order.flatwareQty}`);
  }
  if (isPresent(order.sauce)) {
    preferences.push(`SAUCE : ${formatSauce(order.sauce)}`);
  }
  if (isPresent(order.note)) {
    preferences.push(`NOTE : ${order.note}`);
  }

  if (preferences.length === 0) {
    return;
  }

  printer.newLine();
  for (const preference of preferences) {
    printer.println(preference);
  }
}

export function renderThermalTicket(printer, order, header = getRestaurantHeader()) {
  // Explicitly select Epson Font A (12-dot wide, 48 chars per 80mm line) and
  // normal height for the whole ticket: do not rely on printer state, and no
  // double-height body. Only the restaurant name is briefly bold.
  printer.setTypeFontA();
  printer.setTextNormal();
  printRestaurantHeader(printer, header);
  printer.drawLine("-");

  printCustomerBlock(printer, order);
  printSchedule(printer, order);

  printItemsTable(printer, order);

  printer.drawLine("-");
  printTotals(printer, order);

  printPreferences(printer, order);

  printer.drawLine("-");
  printer.newLine();
}
