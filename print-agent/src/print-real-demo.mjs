import { printTicketToPrinter } from "./printer.mjs";
import { formatTicket, parseTicketOrder } from "./ticket.mjs";

const printerIp = process.argv[2]?.trim() || "192.168.1.17";
const printerPort = process.argv[3]?.trim() || "9100";
const printerType = process.env.PRINTER_TYPE || "EPSON";

console.log(`\n🖨️ Envoi d'un ticket de test Sushi Lin vers l'imprimante ${printerIp}:${printerPort}...\n`);

const demoOrder = {
  address: "12 Avenue de Paris, 78340 Les Clayes-sous-Bois",
  createdAt: new Date().toISOString(),
  customerEmail: "client@example.com",
  customerName: "Mickaël LIN",
  customerPhone: "06 12 34 56 78",
  deliveryFeeCents: 0,
  flatwareQty: 2,
  items: [
    {
      code: "1",
      lineTotalCents: 650,
      name: "California Saumon Avocat (6 pcs)",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 650,
    },
    {
      code: "2",
      lineTotalCents: 750,
      name: "California Thon Cuit Avocat (6 pcs)",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 750,
    },
    {
      code: "M1",
      lineTotalCents: 1450,
      name: "Menu Yakitori 5 Brochettes",
      quantity: 1,
      selectedOptions: [],
      unitPriceCents: 1450,
    },
  ],
  note: "Sauce sucrée svp",
  number: "CMD-" + Math.floor(100000 + Math.random() * 900000),
  paymentMethod: "carte_bancaire",
  sauce: "sucree",
  serviceDate: new Date().toLocaleDateString("fr-CA"),
  subtotalCents: 2850,
  timeWindow: "19h30",
  totalCents: 2850,
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
