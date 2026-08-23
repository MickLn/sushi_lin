# Agent d'impression Sushi Lin

Cet agent tourne en continu sur le PC du comptoir ou en local. Il récupère une commande en attente depuis le site Sushi Lin, imprime le ticket de caisse / cuisine, puis confirme l'impression au site.

## Modes de fonctionnement

L'agent fonctionne dans deux modes, choisis par la présence de `PRINT_API_URL` :

- **Mode cloud** (recommandé en production) : `PRINT_API_URL` est défini (ex: `https://sushilin.fr`). L'agent interroge le site via `GET /api/print/next`, imprime le ticket, puis confirme via `POST /api/print/marked`.
- **Mode fichier** (développement local) : sans `PRINT_API_URL`, l'agent surveille `PRINT_OUTPUT_DIR`, affiche les fichiers `.txt` et `.bin` nouveaux dans ses journaux, et ne contacte aucun site internet.

Dans les deux modes, la sortie est contrôlée par `PRINT_MODE` : `file` écrit un ticket texte, `printer` envoie les octets ESC/POS à une imprimante thermique.

## Installation sur le PC du comptoir

1. Installez Node.js (version 18+ ou 20+).
2. Copiez le dossier `print-agent/` sur le PC, puis exécutez `npm ci` (ou `npm install`) dans ce dossier.
3. Créez les variables d'environnement ci-dessous. La valeur de `PRINT_AGENT_SECRET` doit être exactement la même que celle configurée sur le serveur.
4. Lancez `npm start` avec un gestionnaire de service persistant afin que l'agent redémarre après une coupure ou un redémarrage du PC : service Windows, PM2, systemd, ou LaunchAgent macOS.

Exemple de configuration en mode cloud avec journal de fichiers :

```sh
PRINT_API_URL=https://sushilin.fr
PRINT_AGENT_SECRET=votre-cle-secrete-impression
PRINT_MODE=file
PRINT_OUTPUT_DIR=/var/lib/sushilin/tickets
POLL_INTERVAL_MS=20000
npm start
```

## Variables d'environnement

| Variable | Usage |
| --- | --- |
| `PRINT_API_URL` | URL publique de base du site, par exemple `https://sushilin.fr`. Active le mode cloud. |
| `PRINT_AGENT_SECRET` | Secret partagé avec `PRINT_AGENT_SECRET` du site. Obligatoire en mode cloud. |
| `POLL_INTERVAL_MS` | Intervalle entre deux vérifications en millisecondes (`20000` par défaut). |
| `PRINT_MODE` | `file` par défaut pour écrire un ticket texte, ou `printer` pour une imprimante thermique. |
| `PRINT_OUTPUT_DIR` | Dossier de sortie des `.txt` (mode fichier) et des `.bin` de test. Défaut : `/data/tickets`. |
| `PRINTER_TYPE` | `EPSON` par défaut ou `STAR` pour choisir le langage de l'imprimante thermique. |
| `PRINTER_INTERFACE` | En mode imprimante : `tcp` pour le réseau, `printer` pour CUPS, ou `path` pour un port local. |
| `PRINTER_ADDRESS` | Adresse correspondant à l'interface : IP et port (ex: `192.168.1.50:9100`), nom de file système, ou port USB/série. |
| `PRINTER_DRY_RUN` | Mettez `1` pour produire les octets ESC/POS dans un `.bin` sans contacter d'imprimante. |
| `PRINT_RESTAURANT_NAME` | Nom du restaurant imprimé en tête de ticket. Défaut : `SUSHI LIN`. |
| `PRINT_RESTAURANT_ADDRESS` | Adresse imprimée en tête de ticket. Défaut : `32 Rue des Dames`. |
| `PRINT_RESTAURANT_CITY` | Ville et code postal imprimés en tête de ticket. Défaut : `78340 Les Clayes-sous-Bois`. |
| `PRINT_RESTAURANT_PHONE` | Téléphone imprimé en tête de ticket. Défaut : `01 30 79 00 88`. |
| `PRINT_RESTAURANT_SITE` | Site Internet imprimé en tête de ticket. Défaut : `https://sushilin.fr`. |

## Imprimante thermique

### Imprimante réseau Epson ou Star

Pour une imprimante connectée au réseau local (Ethernet ou Wi-Fi) :

```sh
PRINT_MODE=printer
PRINTER_TYPE=EPSON
PRINTER_INTERFACE=tcp
PRINTER_ADDRESS=192.168.1.50:9100
```

### File système Epson (CUPS/Linux/macOS)

Pour une imprimante installée dans le système :

```sh
PRINT_MODE=printer
PRINTER_TYPE=EPSON
PRINTER_INTERFACE=printer
PRINTER_ADDRESS="Epson TM-T20"
```

## Format du ticket

Le ticket est au format 80 mm (standard caisse de restaurant japonais) :

- **En-tête du restaurant :** `SUSHI LIN` centré, `32 Rue des Dames`, `78340 Les Clayes-sous-Bois`, téléphone `01 30 79 00 88` et site web `https://sushilin.fr`.
- **Informations commande :** N° de commande, Type (`À emporter`), Nom du client, Téléphone, E-mail.
- **Détails de service :** Date et créneau horaire de retrait souhaité.
- **Tableau des articles :** Quantité, Code produit, Nom de l'article, Prix unitaire, Total ligne.
- **Total TTC & Options :** Total TTC, Sauces choisies, Baguettes, Notes et commentaires du client.

## Test de démonstration rapide

Vous pouvez tester la génération d'un ticket Sushi Lin immédiatement en ligne de commande :

```sh
cd print-agent
node src/demo-ticket.mjs
```

## Contrat d'API avec le serveur

En mode cloud, l'agent appelle :

- `GET /api/print/next` avec l'en-tête `x-sushilin-print-secret` pour récupérer la commande en attente.
- `POST /api/print/marked` avec `{ "number": "…", "failed": false }` après impression réussie.
