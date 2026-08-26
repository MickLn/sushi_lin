#!/bin/bash
cd "$(dirname "$0")"
echo "===================================================================="
echo "  SUSHI LIN - LANCEMENT DE L'AGENT D'IMPRESSION AUTOMATIQUE"
echo "===================================================================="
echo ""
echo "Connexion au serveur et surveillance des commandes en direct..."
echo "(Laissez cette fenêtre ouverte pendant tout le service)"
echo ""
python3 sushilin_imprimante.py
