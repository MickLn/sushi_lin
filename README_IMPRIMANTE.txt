====================================================================
SUSHI LIN — GUIDE D'INSTALLATION DE L'AGENT D'IMPRESSION RESTAURANT
====================================================================

Ce dossier contient tout ce dont vous avez besoin pour que vos tickets
de commande et de réservation s'impriment AUTOMATIQUEMENT au restaurant.

--------------------------------------------------------------------
1. QUE CONTIENT CE PACK ?
--------------------------------------------------------------------
- sushilin_imprimante.py        : Le programme qui écoute les commandes et imprime
- Lancer_Imprimante_Windows.bat : Le raccourci de lancement pour PC Windows
- Lancer_Imprimante_Mac.command : Le raccourci de lancement pour Mac
- README_IMPRIMANTE.txt         : Ce guide

--------------------------------------------------------------------
2. INSTALLATION AU RESTAURANT (1 MINUTE)
--------------------------------------------------------------------
1. Copiez ce dossier ou ce fichier sur une clé USB.
2. Collez-le sur le bureau de l'ordinateur du restaurant (connecté à la box).
3. Assurez-vous que l'ordinateur a Python installé (gratuit sur https://www.python.org/downloads/).

--------------------------------------------------------------------
3. UTILISATION AU QUOTIDIEN
--------------------------------------------------------------------
Le matin à l'ouverture :
- Double-cliquez sur "Lancer_Imprimante_Windows.bat" (ou "Lancer_Imprimante_Mac.command").
- Une petite fenêtre s'ouvre indiquant :
  "En attente de nouvelles commandes... (Laissez cette fenêtre ouverte)"

Dès qu'un client commande sur le site :
- Le programme détecte la commande en 2 secondes.
- L'imprimante thermique 192.168.1.210 imprime et découpe les 2 tickets (Cuisine + Caisse).
- L'écran indique "✅ Commande #... imprimée et découpée !".

Astuce : Vous pouvez ajouter ce raccourci au dossier "Démarrage" de Windows
pour qu'il se lance automatiquement à l'allumage du PC chaque matin.
====================================================================
