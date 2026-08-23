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
  printer.println(`N. commande :   ${order.number}`);

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

function printItemsTable(printer, order) {
  printer.tableCustom([
    { text: "Q.", align: "LEFT", cols: TABLE_QTY_COLS, bold: true },
    { text: "Code", align: "LEFT", cols: TABLE_CODE_COLS, bold: true },
    { text: "Designation", align: "LEFT", cols: TABLE_DESIGNATION_COLS, bold: true },
    { text: "P.U.TTC", align: "RIGHT", cols: TABLE_UNIT_COLS, bold: true },
    { text: "Total", align: "RIGHT", cols: TABLE_TOTAL_COLS, bold: true },
  ]);

  for (const item of order.items) {
    const lineTotalCents = itemLineAmountCents(item);
    const perUnitCents = lineTotalCents === undefined ? undefined : Math.round(lineTotalCents / item.quantity);
    printer.tableCustom([
      { text: String(item.quantity), align: "LEFT", cols: TABLE_QTY_COLS },
      { text: item.code ?? "", align: "LEFT", cols: TABLE_CODE_COLS, bold: true },
      { text: stripAccents(item.name), align: "LEFT", cols: TABLE_DESIGNATION_COLS },
      { text: perUnitCents === undefined ? "" : formatAmount(perUnitCents), align: "RIGHT", cols: TABLE_UNIT_COLS },
      { text: lineTotalCents === undefined ? "" : formatAmount(lineTotalCents), align: "RIGHT", cols: TABLE_TOTAL_COLS },
    ]);
    for (const selectedOption of item.selectedOptions) {
      printer.println(`  - ${stripAccents(selectedOption.name)}`);
    }
  }
}

function printTotals(printer, order) {
  const totalStr = formatEuro(order.totalCents);
  printer.leftRight("Total TTC :", totalStr);
  printer.newLine();
  printer.alignCenter();
  printer.bold(true);
  printer.println(`Net a Payer : ${totalStr}`);
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
