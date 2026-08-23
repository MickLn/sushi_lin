import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stat } from "node:fs/promises";

import { printTicketToPrinter } from "./printer.mjs";
import { formatTicket, parseTicketOrder } from "./ticket.mjs";

// Representative DELIVERY order in the exact shape served by GET /api/print/next.
const demoOrder = {
  address: "32 Rue des Dames, 78340 Les Clayes-sous-Bois",
  createdAt: "2026-08-23T12:00:00.000Z",
  customerEmail: "client@example.com",
  customerName: "Mickael LIN",
  customerPhone: "06 12 34 56 78",
  deliveryFeeCents: 0,
  flatwareQty: 2,
  items: [
    {
      code: "29",
      lineTotalCents: 1160,
      name: "California saumon avocat (6 pcs)",
      quantity: 2,
      selectedOptions: [],
      unitPriceCents: 580,
    },
    {
      code: "32A",
      lineTotalCents: 600,
      name: "California thon cuit avocat (6 pcs)",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 600,
    },
    {
      code: "M1",
      lineTotalCents: 1450,
      name: "Menu M1 5 brochettes yakitori",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 1450,
    },
  ],
  note: "Sauce sucree svp",
  number: "CMD-20260823-DEMO",
  paymentMethod: "CARD",
  sauce: "sucree",
  serviceDate: "2026-08-23",
  subtotalCents: 3210,
  discountCents: 321,
  timeWindow: "19h30",
  totalCents: 2889,
  type: "TAKEAWAY",
};

// Legacy payload: plain-string options, no serviceDate, no lineTotalCents.
const legacyOrder = {
  address: "32 Rue des Dames, 78340 Les Clayes-sous-Bois",
  createdAt: "2026-08-23T12:00:00.000Z",
  customerEmail: null,
  customerName: "Aya Tanaka",
  customerPhone: "0612345678",
  deliveryFeeCents: 0,
  flatwareQty: 0,
  items: [
    {
      code: "1",
      name: "California Saumon Avocat",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 650,
    },
  ],
  note: null,
  number: "CMD-20260823-LEGACY",
  paymentMethod: null,
  sauce: null,
  subtotalCents: 650,
  timeWindow: null,
  totalCents: 650,
  type: "TAKEAWAY",
};

const parsedOrder = parseTicketOrder(demoOrder);
if (parsedOrder === null) {
  throw new Error("the demo payload failed to parse");
}
if (parseTicketOrder(legacyOrder) === null) {
  throw new Error("the legacy payload failed to parse");
}

console.log(formatTicket(parsedOrder));

const outputDirectory = await mkdtemp(join(tmpdir(), "sushilin-ticket-demo-"));
const result = await printTicketToPrinter({
  dryRun: true,
  order: parsedOrder,
  orderNumber: parsedOrder.number,
  outputDirectory,
  printerType: "EPSON",
});
const dryRunStat = await stat(result.dryRunFilePath);
console.log(`\nESC/POS dry-run wrote ${dryRunStat.size} bytes to ${result.dryRunFilePath}`);
console.log("legacy payload parse: OK");