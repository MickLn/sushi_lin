import { Socket } from "node:net";

const encoder = new TextEncoder();

const host = process.argv[2]?.trim();
if (host === undefined || host.length === 0) {
  console.error("Usage: node test-printer.mjs <PRINTER_IP> [PORT=9100]");
  process.exit(1);
}
const port = Number.parseInt(process.argv[3] ?? "9100", 10);

const data = [
  "\x1b@", // initialize
  "\x1bd\x01", // feed line
  "HOKKAIDO - TEST IMPRESSION\n",
  "====================\n",
  "Ce reçu confirme la\n",
  "connexion reseau.\n",
  "IP : " + host + "\n",
  "Date : " + new Date().toLocaleString("fr-FR") + "\n",
  "\x1bd\x04", // feed
  "\x1dV\x00", // partial cut
];

const socket = new Socket();
const timeout = setTimeout(() => {
  console.error("TIMEOUT : impossibile de joindre l'imprimante sur " + host + ":" + port);
  socket.destroy();
  process.exit(1);
}, 8000);

socket.setTimeout(8000);
socket.on("timeout", () => {
  console.error("TIMEOUT reseau : " + host + ":" + port);
  socket.destroy();
  process.exit(1);
});

socket.on("connect", () => {
  clearTimeout(timeout);
  console.log("Connecté à " + host + ":" + port + " - envoi du test...");
  // Les imprimantes réseau gardent souvent la connexion ouverte sans rien
  // renvoyer. On considère l'envoi réussi une fois le flux écrit au socket,
  // puis on laisse un court délai à l'imprimante pour imprimer avant de fermer.
  socket.write(encoder.encode(data.join("")), () => {
    setTimeout(() => {
      console.log("Test envoyé. La connexion reste ouverte (comportement normal).");
      socket.destroy();
      process.exit(0);
    }, 2000);
  });
});

socket.on("data", () => {
  // imprimantes reseau n'envoient généralement rien de retour
});

socket.on("close", () => {
  // fermeture gérée par la phase d'envoi ci-dessus
});

socket.on("error", (error) => {
  console.error("ERREUR : " + error.message);
  console.error("Vérifiez l'IP de l'imprimante et que le port 9100 est ouvert.");
  process.exit(1);
});

socket.connect(port, host);
