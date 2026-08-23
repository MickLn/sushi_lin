import { Socket } from "node:net";

const SUBNET_PREFIX = process.argv[2]?.trim() || "192.168.1";
const PORT = Number.parseInt(process.argv[3] || "9100", 10);
const TIMEOUT_MS = 1200;

console.log(`\n🔍 Recherche d'imprimantes thermiques sur ${SUBNET_PREFIX}.1-254 (Port ${PORT})...\n`);

function checkIp(ip) {
  return new Promise((resolve) => {
    const socket = new Socket();
    let isResolved = false;

    socket.setTimeout(TIMEOUT_MS);

    socket.on("connect", () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ ip, open: true });
      }
    });

    socket.on("timeout", () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ ip, open: false });
      }
    });

    socket.on("error", () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve({ ip, open: false });
      }
    });

    try {
      socket.connect(PORT, ip);
    } catch {
      resolve({ ip, open: false });
    }
  });
}

async function scan() {
  const promises = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `${SUBNET_PREFIX}.${i}`;
    promises.push(checkIp(ip));
  }

  const results = await Promise.all(promises);
  const found = results.filter((r) => r.open);

  if (found.length === 0) {
    console.log("❌ Aucune imprimante détectée sur le port 9100 sur ce sous-réseau.");
    console.log("💡 Astuce : Assurez-vous que l'imprimante est allumée et reliée au même réseau Wi-Fi/Box.");
  } else {
    console.log("✅ Imprimante(s) trouvée(s) :");
    for (const f of found) {
      console.log(`   👉 IP : ${f.ip} (Port ${PORT})`);
    }
    console.log("\nVous pouvez tester l'impression avec :");
    console.log(`   node src/test-printer.mjs ${found[0].ip}\n`);
  }
}

scan();
