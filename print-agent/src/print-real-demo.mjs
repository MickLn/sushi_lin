import { printTicketToPrinter } from "./printer.mjs";
import { formatTicket, parseTicketOrder } from "./ticket.mjs";

const printerIp = process.argv[2]?.trim() || "192.168.1.17";
const printerPort = process.argv[3]?.trim() || "9100";
const printerType = process.env.PRINTER_TYPE || "EPSON";

console.log(`\n🖨️ Envoi d'un ticket de test Sushi Lin vers l'imprimante ${printerIp}:${printerPort}...\n`);

const demoOrder = {
  address: "32 Rue des Dames, 78340 Les Clayes-sous-Bois",
  createdAt: new Date().toISOString(),
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
  number: "1",
  paymentMethod: "CARD",
  sauce: "sucree",
  serviceDate: new Date().toLocaleDateString("fr-CA"),
  subtotalCents: 3210,
  discountCents: 321,
  timeWindow: "19h30",
  totalCents: 2889,
  type: "TAKEAWAY",
};

const parsedOrder = parseTicketOrder(demoOrder);
if (!parsedOrder) {
  console.error("Erreur de formatage de la commande de démonstration.");
  process.exit(1);
}

try {
  const result = await printTicketToPrinter({
    dryRun: false,
    order: parsedOrder,
    orderNumber: parsedOrder.number,
    printerAddress: `${printerIp}:${printerPort}`,
    printerInterface: "tcp",
    printerType: printerType,
  });
  console.log("✅ Ticket envoyé avec succès à l'imprimante !");
} catch (error) {
  console.error("❌ Erreur lors de l'impression :", error);
}
