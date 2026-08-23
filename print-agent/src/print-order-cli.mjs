import { printTicketToPrinter } from "./printer.mjs";
import { parseTicketOrder } from "./ticket.mjs";

const printerIp = process.env.PRINTER_IP || process.argv[2] || "192.168.1.210";
const printerPort = process.env.PRINTER_PORT || process.argv[3] || "9100";
const orderJson = process.argv[4] || process.env.ORDER_DATA;

async function run() {
  let rawOrder;
  if (orderJson) {
    rawOrder = JSON.parse(orderJson);
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks).toString("utf8").trim();
    if (!buf) {
      console.error("[PRINT] Aucune donnée de commande reçue.");
      process.exit(1);
    }
    rawOrder = JSON.parse(buf);
  }

  const rawItems = rawOrder.items || [];
  const items = rawItems.map((it) => {
    const qty = Number.parseInt(it.qty || it.quantity || 1, 10);
    const unitPrice = Number.parseFloat(it.unitPrice || it.price || 0);
    const lineTotal = Number.parseFloat(it.totalPrice || it.lineTotal || unitPrice * qty);
    const unitCents = Math.round(unitPrice * 100);
    const lineTotalCents = Math.round(lineTotal * 100);

    const details = it.details || it.selectedOptions || [];
    const selectedOptions = details.map((d) => {
      if (typeof d === "string") return { name: d };
      const q = d.quantity ? `${d.quantity}x ` : "";
      const fl = d.flavor || d.name || "";
      return { name: `${q}${fl}`.trim() };
    });

    return {
      code: it.code || "",
      lineTotalCents,
      name: it.name || "Article",
      quantity: qty,
      selectedOptions,
      unitPriceCents: unitCents,
    };
  });

  const subtotalCents = Math.round(Number.parseFloat(rawOrder.subtotal || 0) * 100);
  const discountCents = Math.round(Number.parseFloat(rawOrder.discount || 0) * 100);
  const totalCents = Math.round(Number.parseFloat(rawOrder.total || 0) * 100);

  const formattedOrder = {
    address: rawOrder.address || "32 Rue des Dames, 78340 Les Clayes-sous-Bois",
    createdAt: rawOrder.timestamp || rawOrder.createdAt || new Date().toISOString(),
    customerEmail: rawOrder.customerEmail || rawOrder.email || undefined,
    customerName: rawOrder.customerName || rawOrder.name || "Client Sushi Lin",
    customerPhone: rawOrder.customerPhone || rawOrder.phone || "06 00 00 00 00",
    deliveryFeeCents: 0,
    discountCents: discountCents > 0 ? discountCents : undefined,
    flatwareQty: Number.parseInt(rawOrder.baguettesChoice || rawOrder.flatwareQty || 1, 10) || 1,
    items,
    note: rawOrder.comment || rawOrder.note || undefined,
    number: String(rawOrder.id || rawOrder.number || "1"),
    paymentMethod: rawOrder.paymentMethod || "CARD",
    sauce: rawOrder.sauceChoice || rawOrder.sauce || undefined,
    serviceDate: new Date().toLocaleDateString("fr-CA"),
    subtotalCents: subtotalCents > 0 ? subtotalCents : undefined,
    timeWindow: rawOrder.pickupTime || rawOrder.timeWindow || "19h30",
    totalCents,
    type: "TAKEAWAY",
  };

  const parsed = parseTicketOrder(formattedOrder);
  if (!parsed) {
    console.error("[PRINT] Erreur : impossible de parser le format du ticket", formattedOrder);
    process.exit(1);
  }

  try {
    await printTicketToPrinter({
      dryRun: false,
      order: parsed,
      orderNumber: parsed.number,
      printerAddress: `${printerIp}:${printerPort}`,
      printerInterface: "tcp",
      printerType: "EPSON",
    });
    console.log(`[PRINT] ✅ Ticket #${parsed.number} imprimé avec succès sur ${printerIp}:${printerPort} !`);
  } catch (err) {
    console.error("[PRINT] ❌ Erreur lors de l'impression :", err);
  }
}

run();
