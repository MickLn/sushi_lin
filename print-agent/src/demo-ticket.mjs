import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stat } from "node:fs/promises";

import { printTicketToPrinter } from "./printer.mjs";
import { formatTicket, parseTicketOrder } from "./ticket.mjs";

// Representative DELIVERY order in the exact shape served by GET /api/print/next.
const deliveryOrder = {
  address: "5 rue des Fleurs, 78120 Rambouillet",
  createdAt: "2026-08-09T08:00:00.000Z",
  customerEmail: "pierre.dupont@example.com",
  customerName: "Pierre DUPONT",
  customerPhone: "06 12 34 56 78",
  deliveryFeeCents: 300,
  flatwareQty: 2,
  items: [
    {
      code: "E1",
      lineTotalCents: 560,
      name: "RIZ NATURE",
      quantity: 2,
      selectedOptions: [{ name: "Sans oignons", priceDeltaCents: 0 }],
      unitPriceCents: 280,
    },
    {
      code: "E2",
      lineTotalCents: 320,
      name: "RIZ VINAIGRE",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 320,
    },
    {
      code: "E10",
      lineTotalCents: 720,
      name: "RAVIOLIS CREVETTES X4",
      quantity: 1,
      selectedOptions: [{ name: "Supplément crevettes", priceDeltaCents: 100 }],
      unitPriceCents: 620,
    },
  ],
  note: "Ne pas sonner, déposer devant la porte",
  number: "HK-20260809-DEMO",
  paymentMethod: "carte_bancaire",
  sauce: "les_deux",
  serviceDate: "2026-08-09",
  subtotalCents: 1600,
  timeWindow: "20:15 ~ 20:45",
  totalCents: 1900,
  type: "DELIVERY",
};

// Legacy payload: plain-string options, no serviceDate, no lineTotalCents.
const legacyOrder = {
  address: "3 rue de la Gare, 78120 Rambouillet",
  createdAt: "2026-08-01T12:00:00.000Z",
  customerEmail: null,
  customerName: "Aya Tanaka",
  customerPhone: "0612345678",
  deliveryFeeCents: 0,
  flatwareQty: 0,
  items: [
    {
      code: "E1",
      name: "RIZ NATURE",
      quantity: 1,
      selectedOptions: ["Sans oignons"],
      unitPriceCents: 280,
    },
  ],
  note: null,
  number: "HK-20260801-LEGACY",
  paymentMethod: null,
  sauce: null,
  subtotalCents: 280,
  timeWindow: null,
  totalCents: 280,
  type: "TAKEAWAY",
};

const parsedOrder = parseTicketOrder(deliveryOrder);
if (parsedOrder === null) {
  throw new Error("the demo delivery payload failed to parse");
}
if (parseTicketOrder(legacyOrder) === null) {
  throw new Error("the legacy payload failed to parse");
}

console.log(formatTicket(parsedOrder));

const outputDirectory = await mkdtemp(join(tmpdir(), "hokkaido-ticket-demo-"));
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