# Agent d'impression Hokkaido

Cet agent tourne en continu sur le PC du comptoir. Il récupère une commande en attente depuis le site Hokkaido déployé, imprime le ticket, puis confirme l'impression au site. Le PC doit pouvoir joindre le site public en HTTPS.

## Modes de fonctionnement

L'agent fonctionne dans deux modes, choisis par la présence de `PRINT_API_URL` :

- **Mode cloud** (recommandé en production) : `PRINT_API_URL` est défini. L'agent interroge le site déployé via `GET /api/print/next`, imprime le ticket, puis confirme via `POST /api/print/marked`.
- **Mode fichier** (développement local) : sans `PRINT_API_URL`, l'agent surveille `PRINT_OUTPUT_DIR`, affiche les fichiers `.txt` et `.bin` nouveaux dans ses journaux, et ne contacte aucun site internet. C'est le mode utilisé par `docker compose up` dans ce dépôt.

Dans les deux modes, la sortie est contrôlée par `PRINT_MODE` : `file` écrit un ticket texte, `printer` envoie les octets ESC/POS à une imprimante thermique.

## Installation sur le PC du comptoir

1. Installez Node.js 25 ou une version Node.js récente compatible avec l'agent.
2. Copiez le dossier `print-agent/` sur le PC, puis exécutez `npm ci` dans ce dossier.
3. Créez les variables d'environnement ci-dessous. La valeur de `PRINT_AGENT_SECRET` doit être exactement la même que celle configurée pour le site déployé.
4. Lancez `npm start` avec un gestionnaire de service persistant afin que l'agent redémarre après une coupure ou un redémarrage du PC : service Windows, Planificateur de tâches Windows, `systemd`, PM2, ou LaunchAgent macOS.

Exemple de configuration en mode cloud avec journal de fichiers :

```sh
PRINT_API_URL=https://commande.exemple.fr
PRINT_AGENT_SECRET=la-meme-valeur-longue-et-aleatoire-que-sur-le-site
PRINT_MODE=file
PRINT_OUTPUT_DIR=/var/lib/hokkaido/tickets
POLL_INTERVAL_MS=20000
npm start
```

Ne partagez jamais `PRINT_AGENT_SECRET` et ne l'écrivez pas dans les journaux, les captures d'écran ou un ticket de support.

## Variables d'environnement

| Variable | Usage |
| --- | --- |
| `PRINT_API_URL` | URL publique de base du site, par exemple `https://commande.exemple.fr`. Active le mode cloud. |
| `PRINT_AGENT_SECRET` | Secret partagé avec `PRINT_AGENT_SECRET` du site. Obligatoire en mode cloud. |
| `POLL_INTERVAL_MS` | Intervalle entre deux vérifications en millisecondes. En mode cloud : `20000` par défaut. |
| `PRINT_MODE` | `file` par défaut pour écrire un ticket texte, ou `printer` pour une imprimante thermique. |
| `PRINT_OUTPUT_DIR` | Dossier de sortie des `.txt` (mode fichier) et des `.bin` de test. Défaut : `/data/tickets`. |
| `PRINTER_TYPE` | `EPSON` par défaut ou `STAR` pour choisir le langage de l'imprimante thermique. |
| `PRINTER_INTERFACE` | En mode imprimante : `tcp` pour le réseau, `printer` pour une file système CUPS, ou `path` pour un port local. |
| `PRINTER_ADDRESS` | Adresse correspondant à l'interface : IP et port, nom de file système, ou chemin de port. |
| `PRINTER_DRY_RUN` | Mettez `1` pour produire les octets ESC/POS dans un `.bin` sans contacter d'imprimante. |
| `PRINT_RESTAURANT_NAME` | Nom du restaurant imprimé en tête de ticket. Défaut : `HOKKAIDO RAMBOUILLET`. |
| `PRINT_RESTAURANT_ADDRESS` | Adresse imprimée en tête de ticket. Défaut : `22 Rue Raymond Poincaré`. |
| `PRINT_RESTAURANT_CITY` | Ville et code postal imprimés en tête de ticket. Défaut : `78120 Rambouillet`. |
| `PRINT_RESTAURANT_PHONE` | Téléphone imprimé en tête de ticket. Défaut : `01 34 83 28 53`. |
| `PRINT_RESTAURANT_SITE` | Site Internet imprimé en tête de ticket. Défaut : `http://www.hokkaido78rambouillet.fr`. |

## Imprimante thermique

### Imprimante réseau Epson ou Star

Pour une Epson ou une Star TSP143 accessible sur le réseau local :

```sh
PRINT_MODE=printer
PRINTER_TYPE=EPSON
PRINTER_INTERFACE=tcp
PRINTER_ADDRESS=192.168.1.50:9100
```

L'agent transforme cette configuration en `tcp://192.168.1.50:9100` et envoie les octets ESC/POS avec `node-thermal-printer`. Pour une Star, remplacez `PRINTER_TYPE` par `STAR`.

### File système Epson (CUPS/Linux)

Pour une imprimante déjà installée dans CUPS :

```sh
PRINT_MODE=printer
PRINTER_TYPE=EPSON
PRINTER_INTERFACE=printer
PRINTER_ADDRESS="Epson TM-T20"
```

`printer://Epson TM-T20` est également accepté comme valeur d'adresse. Cette option utilise `lp -d <nom> -o raw`; le PC doit donc avoir CUPS et la commande `lp` disponibles, avec une file d'impression configurée pour accepter les données brutes.

### Port local

Pour un port série ou USB local, utilisez `PRINTER_INTERFACE=path` avec le chemin du port comme `PRINTER_ADDRESS`.

## Format du ticket

Le ticket est au format ecommande, pleine largeur (80 mm, `width: 48`, police Epson Font A, hauteur normale) :

- En-tête du restaurant : `HOKKAIDO RAMBOUILLET` centré, adresse, ville, téléphone et site, tous configurables via `PRINT_RESTAURANT_*` (valeurs par défaut ci-dessus).
- `N° cmde`, type (`Livraison Commande` / `A emporter Commande`), nom du client, mode de paiement, email, téléphone, adresse et code postal extrait.
- `Date liv.` (date de service choisie au passage de commande ; repli sur la date de création uniquement pour les anciennes commandes) et fenêtre de livraison ou de retrait : le créneau exact sélectionné par le client, relevé par `serviceStartTime`/`serviceEndTime` de la commande (repli sur la fenêtre parent du créneau uniquement pour les anciennes commandes qui n'ont pas ces champs).
- Tableau `Q. / Code / Désignation / P.U.TTC / Total` (colonnes 3 + 6 + 22 + 8 + 9 = 48) avec le code produit, le prix unitaire TTC, le total de la ligne et les options sélectionnées en dessous.
- `Frais de livraison` (livraison uniquement) puis `Net`.
- Pied de page : couvert, sauce, note.

Aucun montant n'est inventé : les totaux de ligne viennent des prix de base et suppléments d'options enregistrés (calculés côté site). Comme le modèle de données ne stocke pas de TVA, le ticket imprime `Net`/total TTC à partir du total enregistré de la commande.

## Vérification sans imprimante

Avant de brancher une imprimante, testez le rendu ESC/POS sans risque :

```sh
PRINT_MODE=printer
PRINTER_DRY_RUN=1
PRINT_OUTPUT_DIR=/var/lib/hokkaido/tickets
npm start
```

L'agent crée un fichier `<numero>.bin` contenant les octets qui seraient envoyés à l'imprimante, puis marque la commande comme imprimée uniquement si l'écriture du fichier a réussi.

## Test de connectivité rapide

Pour vérifier qu'une imprimante réseau Epson est joignable avant de configurer l'agent, envoyez une étiquette de test autonome :

```sh
node src/test-printer.mjs 192.168.1.200
```

Le script se connecte au port 9100, envoie un reçu de test et se ferme. Un port optionnel peut être passé en second argument (défaut `9100`).

## Contrat avec le site

En mode cloud, l'agent appelle :

- `GET /api/print/next` avec l'en-tête `x-hokkaido-print-secret` pour demander la plus ancienne commande `PENDING`.
- `POST /api/print/marked` avec `{ "number": "…", "failed": false }` après une impression réussie.
- `POST /api/print/marked` avec `{ "number": "…", "failed": true }` si l'écriture ou l'impression échoue.

Une erreur réseau ou une confirmation échouée est journalisée et l'agent réessaie au prochain cycle. Une confirmation échouée peut occasionnellement réimprimer le même ticket : c'est volontaire, car une commande ne doit pas être perdue silencieusement.

## Dépannage

- **Délai d'attente apparent sur les imprimantes réseau** : beaucoup d'imprimantes thermiques gardent la connexion TCP ouverte sans rien renvoyer. Un « timeout » ne signifie pas forcément un échec d'impression. Utilisez `node src/test-printer.mjs <IP>` pour confirmer que l'imprimante reçoit bien les données, puis vérifiez que le ticket sort réellement.
- **Aucune impression en mode cloud** : vérifiez que `PRINT_API_URL` est joignable en HTTPS depuis le PC et que `PRINT_AGENT_SECRET` correspond exactement à celui du site.
- **Erreur de configuration au démarrage** : l'agent affiche un message clair (par exemple `PRINT_AGENT_SECRET` manquant avec `PRINT_API_URL`, ou `PRINTER_ADDRESS` manquant avec `PRINT_MODE=printer`). Corrigez la variable indiquée puis relancez.
