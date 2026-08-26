#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
====================================================================
SUSHI LIN — AGENT D'IMPRESSION AUTOMATIQUE (RESTAURANT)
====================================================================
Ce programme s'exécute sur le PC du restaurant connecté à la box Internet.
Il interroge en temps réel le site internet Sushi Lin et envoie instantanément
les nouvelles commandes et réservations à l'imprimante thermique locale.

Adresse IP imprimante par défaut : 192.168.1.210 (Port 9100)
====================================================================
"""

import time
import socket
import json
import urllib.request
import urllib.error
import unicodedata
import re
import sys
import os

# ====================================================================
# CONFIGURATION
# ====================================================================
# Adresse du site internet (ex: "https://sushilin2.fr" ou "http://localhost:3000" pour les tests)
SERVER_URL = os.environ.get("SUSHILIN_SERVER_URL", "https://sushilin2.fr")

# Clé secrète d'impression (doit correspondre à celle configurée sur le serveur)
PRINTER_SECRET_KEY = os.environ.get("SUSHILIN_PRINTER_KEY", "sushilin_secret_printer_2026")

# Adresse IP locale et port de votre imprimante thermique dans le restaurant
PRINTER_IP = os.environ.get("SUSHILIN_PRINTER_IP", "192.168.1.210")
PRINTER_PORT = int(os.environ.get("SUSHILIN_PRINTER_PORT", "9100"))

# Intervalle de vérification des nouvelles commandes (en secondes)
CHECK_INTERVAL_SECONDS = 3

# ====================================================================
# OUTILS DE FORMATAGE ET ESC/POS (80mm)
# ====================================================================
def clean_ticket_item_name(name):
    if not name:
        return ""
    # Nettoyage intelligent : supprime le contenu entre parenthèses pour gagner de la place
    name = re.sub(r'\(.*?\)', '', str(name))
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def strip_accents(text):
    if not text:
        return ""
    text = str(text)
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join([c for c in nfkd if not unicodedata.combining(c)]).replace('€', 'EUR').replace('œ', 'oe').replace('Œ', 'OE')

def format_euro(cents):
    return f"{cents / 100:.2f}".replace('.', ',') + " EUR"

def wrap_words(text, max_len):
    words = [w for w in text.strip().split() if w]
    lines = []
    curr = ""
    for w in words:
        if not curr:
            curr = w
        elif len(curr) + 1 + len(w) <= max_len:
            curr += " " + w
        else:
            lines.append(curr)
            curr = w
    if curr:
        lines.append(curr)
    return lines or [text]

def is_discount_eligible(code, name):
    c = str(code or '').upper().strip()
    n = str(name or '').lower().strip()
    if c.startswith('D') and c[1:].isdigit():
        return False
    if c.startswith('DS'):
        return False
    excluded = ['coca', 'eau', 'evian', 'san pellegrino', 'biere', 'vin', 'tsingtao', 'asah', 'kirin', 'mochi', 'dorayaki', 'lychee', 'mystere', 'perle de coco', 'fondant', 'dessert', 'boisson']
    if any(ex in n for ex in excluded):
        return False
    return True

# ====================================================================
# GÉNÉRATEURS DE TICKETS ESC/POS (CUISINE + CAISSE + RÉSERVATION)
# ====================================================================
def generate_ticket_bytes(order):
    buf = bytearray()
    buf.extend(b'\x1b\x40\x1c\x2e') # Init + Cancel Chinese mode
    buf.extend(b'\x1b\x74\x13')     # Charset PC858 Euro

    # Header
    buf.extend(b'\x1b\x61\x01') # Align Center
    buf.extend(b'\x1b\x45\x01') # Bold ON
    buf.extend(strip_accents("SUSHI LIN").encode('cp858', errors='replace') + b'\n')
    buf.extend(b'\x1b\x45\x00') # Bold OFF
    buf.extend(strip_accents("32 Rue des Dames - 78340 Les Clayes").encode('cp858', errors='replace') + b'\n')
    buf.extend(b"Tel : 01 30 79 00 88\n")
    buf.extend(b"Site : sushilin2.fr\n")
    buf.extend(b'\x1b\x61\x00') # Align Left
    buf.extend(b"------------------------------------------------\n")

    # Order Number & Pickup Time
    order_num = str(order.get('id') or order.get('number') or '1').lstrip('#')
    pickup_time = str(order.get('pickupTime') or '19h30')
    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b'\x1d\x21\x11') # Double Width + Double Height
    buf.extend(b'\x1b\x45\x01') # Bold ON
    buf.extend(f"COMMANDE #{order_num}\n".encode('cp858', errors='replace'))
    buf.extend(f"RETRAIT : {strip_accents(pickup_time)}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1d\x21\x00') # Normal Size
    buf.extend(b'\x1b\x45\x00') # Bold OFF
    buf.extend(b'\x1b\x61\x00') # Align Left
    buf.extend(b"------------------------------------------------\n")

    # Customer Block
    date_str = str(order.get('dateFormatted') or order.get('serviceDate') or '')
    if date_str:
        buf.extend(f"Date :          {strip_accents(date_str)}\n".encode('cp858', errors='replace'))

    cust_name = str(order.get('customerName') or order.get('name') or 'Client Sushi Lin')
    buf.extend(f"Nom client :    {strip_accents(cust_name)}\n".encode('cp858', errors='replace'))

    cust_phone = str(order.get('customerPhone') or order.get('phone') or '06 00 00 00 00')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"Telephone :     {strip_accents(cust_phone)}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00')

    # Preferences
    prefs = []
    sauce = str(order.get('sauceChoice') or order.get('sauce') or '').strip()
    if sauce:
        prefs.append(f"Sauce :         {strip_accents(sauce)}")
    flatware = str(order.get('baguettesChoice') or order.get('flatwareQty') or '').strip()
    if flatware:
        prefs.append(f"Baguettes :     {strip_accents(flatware)}")
    comment = str(order.get('comment') or order.get('note') or '').strip()
    if comment:
        prefs.append(f"Remarques :     {strip_accents(comment)}")

    if prefs:
        buf.extend(b"------------------------------------------------\n")
        for p in prefs:
            buf.extend(f"{p}\n".encode('cp858', errors='replace'))

    # Banner
    buf.extend(b"------------------------------------------------\n")
    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b'\x1b\x45\x01')
    buf.extend(b"A EMPORTER\n")
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b'\x1b\x61\x00') # Left
    buf.extend(b"------------------------------------------------\n")

    # Column Titles
    buf.extend(b'\x1b\x45\x01')
    header_title = "CODE   QTE  DESIGNATION".ljust(37) + "TOTAL".rjust(11) + "\n"
    buf.extend(header_title.encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00\n')

    # Items
    items = order.get('items', [])
    for it in items:
        qty = int(it.get('qty') or it.get('quantity') or 1)
        price = float(it.get('price') or it.get('unitPrice') or 0)
        total_line = float(it.get('totalPrice') or it.get('lineTotal') or (price * qty))
        total_cents = int(round(total_line * 100))
        code = str(it.get('code') or '').strip() or '—'
        name = strip_accents(clean_ticket_item_name(str(it.get('name') or 'Article'))).upper().strip()

        total_str = format_euro(total_cents)
        code_tag = f"[{code}]"
        lead_prefix = f"{code_tag:<7}{qty}x  "
        avail_name_len = max(10, 48 - len(lead_prefix) - len(total_str))
        name_lines = wrap_words(name, avail_name_len)

        buf.extend(b'\x1b\x45\x01')
        first_line = lead_prefix + name_lines[0].ljust(48 - len(lead_prefix) - len(total_str)) + total_str + "\n"
        buf.extend(first_line.encode('cp858', errors='replace'))

        for extra in name_lines[1:]:
            buf.extend(f"{' ' * len(lead_prefix)}{extra}\n".encode('cp858', errors='replace'))
        buf.extend(b'\x1b\x45\x00')

        is_elig = is_discount_eligible(code, name)
        if is_elig:
            discounted_cents = int(round(total_cents * 0.90))
            if discounted_cents < total_cents:
                disc_str = format_euro(discounted_cents)
                indent_spaces = ' ' * len(lead_prefix)
                disc_line = indent_spaces + "(-10% remise)".ljust(48 - len(indent_spaces) - len(disc_str)) + disc_str + "\n"
                buf.extend(disc_line.encode('cp858', errors='replace'))

        details = it.get('details') or it.get('selectedOptions') or []
        for d in details:
            d_str = d if isinstance(d, str) else f"{d.get('quantity', 1)}x {d.get('flavor', d.get('name', ''))}"
            buf.extend(f"{' ' * len(lead_prefix)}- {strip_accents(d_str)}\n".encode('cp858', errors='replace'))

        buf.extend(b"\n")

    # Totals
    buf.extend(b"------------------------------------------------\n")
    subtotal_val = float(order.get('subtotal') or 0)
    discount_val = float(order.get('discount') or 0)
    total_val = float(order.get('total') or 0)

    if discount_val > 0:
        sub_line = "Sous-total :".ljust(37) + format_euro(int(round(subtotal_val * 100))).rjust(11) + "\n"
        buf.extend(sub_line.encode('cp858', errors='replace'))
        disc_line = "Remise a emporter (-10%) :".ljust(36) + f"-{format_euro(int(round(discount_val * 100)))}".rjust(12) + "\n"
        buf.extend(disc_line.encode('cp858', errors='replace'))

    tot_line = "Total TTC :".ljust(37) + format_euro(int(round(total_val * 100))).rjust(11) + "\n"
    buf.extend(tot_line.encode('cp858', errors='replace'))
    buf.extend(b"\n")

    # Net a payer
    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b'\x1b\x45\x01') # Bold ON
    net_str = f"Net a payer : {format_euro(int(round(total_val * 100)))}\n"
    buf.extend(net_str.encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00') # Bold OFF
    buf.extend(b'\x1b\x61\x00') # Left
    buf.extend(b"------------------------------------------------\n")

    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b"Merci de votre visite, a bientot !\n")
    buf.extend(b'\x1b\x61\x00') # Left
    buf.extend(b"\n\n\n\n\n\n\x1b\x64\x04\x1d\x56\x01") # Feed 6 lines & Cut
    return bytes(buf)

def generate_kitchen_ticket_bytes(order):
    buf = bytearray()
    buf.extend(b'\x1b\x40\x1c\x2e')
    buf.extend(b'\x1b\x74\x13')

    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b'\x1b\x45\x01')
    buf.extend(strip_accents("SUSHI LIN - CUISINE").encode('cp858', errors='replace') + b'\n')
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b"------------------------------------------------\n")

    order_num = str(order.get('id') or order.get('number') or '1').lstrip('#')
    buf.extend(b'\x1d\x21\x11')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"COMMANDE #{order_num}\n".encode('cp858', errors='replace'))
    
    pickup_time = str(order.get('pickupTime') or '19h30')
    buf.extend(f"RETRAIT : {strip_accents(pickup_time)}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1d\x21\x00')
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b'\x1b\x61\x00')
    buf.extend(b"------------------------------------------------\n")

    date_str = str(order.get('dateFormatted') or order.get('serviceDate') or '')
    if date_str:
        buf.extend(f"Date : {strip_accents(date_str)}\n".encode('cp858', errors='replace'))

    cust_name = str(order.get('customerName') or order.get('name') or 'Client')
    cust_phone = str(order.get('customerPhone') or order.get('phone') or '')
    phone_part = f" ({strip_accents(cust_phone)})" if cust_phone else ""
    buf.extend(f"Client : {strip_accents(cust_name)}{phone_part}\n".encode('cp858', errors='replace'))

    sauce = str(order.get('sauceChoice') or order.get('sauce') or '').strip()
    if sauce:
        buf.extend(f"Sauce :     {strip_accents(sauce)}\n".encode('cp858', errors='replace'))
    flatware = str(order.get('baguettesChoice') or order.get('flatwareQty') or '').strip()
    if flatware:
        buf.extend(f"Baguettes : {strip_accents(flatware)}\n".encode('cp858', errors='replace'))
    comment = str(order.get('comment') or order.get('note') or '').strip()
    if comment:
        buf.extend(b'\x1b\x45\x01')
        buf.extend(f"Remarques : {strip_accents(comment)}\n".encode('cp858', errors='replace'))
        buf.extend(b'\x1b\x45\x00')

    buf.extend(b"------------------------------------------------\n\n")

    items = order.get('items', [])
    total_qty = 0
    for it in items:
        qty = int(it.get('qty') or it.get('quantity') or 1)
        total_qty += qty
        code = str(it.get('code') or '').strip() or '—'
        name = strip_accents(clean_ticket_item_name(str(it.get('name') or 'Article'))).upper().strip()

        buf.extend(b'\x1d\x21\x01') # Double Height ONLY
        buf.extend(b'\x1b\x45\x01') # Bold ON

        line_lead = f"[ {code} ]  {qty}x  "
        if len(line_lead) + len(name) <= 48:
            buf.extend(f"{line_lead}{name}\n".encode('cp858', errors='replace'))
        else:
            buf.extend(f"{line_lead}\n".encode('cp858', errors='replace'))
            name_lines = wrap_words(name, 44)
            for nl in name_lines:
                buf.extend(f"   {nl}\n".encode('cp858', errors='replace'))

        buf.extend(b'\x1d\x21\x00')
        buf.extend(b'\x1b\x45\x00')

        details = it.get('details') or it.get('selectedOptions') or []
        for d in details:
            d_str = d if isinstance(d, str) else f"{d.get('quantity', 1)}x {d.get('flavor', d.get('name', ''))}"
            buf.extend(f"     - {strip_accents(d_str)}\n".encode('cp858', errors='replace'))

        buf.extend(b"\n")

    buf.extend(b"------------------------------------------------\n")
    buf.extend(b'\x1b\x61\x01')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"Total articles : {total_qty}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b'\x1b\x61\x00')
    buf.extend(b"\n\n\n\n\n\n\x1b\x64\x04\x1d\x56\x01")
    return bytes(buf)

def generate_reservation_ticket_bytes(reservation):
    buf = bytearray()
    buf.extend(b'\x1b\x40\x1c\x2e')
    buf.extend(b'\x1b\x74\x13')

    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b'\x1b\x45\x01')
    buf.extend(strip_accents("SUSHI LIN").encode('cp858', errors='replace') + b'\n')
    buf.extend(b'\x1b\x45\x00')
    buf.extend(strip_accents("32 Rue des Dames - 78340 Les Clayes").encode('cp858', errors='replace') + b'\n')
    buf.extend(b"Tel : 01 30 79 00 88\n")
    buf.extend(b"Site : sushilin2.fr\n")
    buf.extend(b"------------------------------------------------\n")

    buf.extend(b'\x1b\x45\x01')
    buf.extend(b"*** NOUVELLE RESERVATION ***\n")
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b"------------------------------------------------\n")
    buf.extend(b'\x1b\x61\x00')

    res_num = str(reservation.get('id') or reservation.get('number') or '1')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"N. reservation : #{res_num}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00')

    raw_date = str(reservation.get('date') or reservation.get('reservation_date') or '').strip()
    if len(raw_date) == 10 and raw_date[4] == '-' and raw_date[7] == '-':
        y, m, d = raw_date.split('-')
        date_str = f"{d}/{m}/{y}"
    else:
        date_str = raw_date
    if date_str:
        buf.extend(f"Date :           {strip_accents(date_str)}\n".encode('cp858', errors='replace'))

    service = str(reservation.get('service') or reservation.get('service_time') or '19h00')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"Creneau :        {strip_accents(service)}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00')

    guests = str(reservation.get('guests') or reservation.get('guests_count') or '2')
    guests_label = f"{guests} personne{'s' if guests != '1' else ''}"
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"Nb. couverts :   {guests_label}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b"------------------------------------------------\n")

    cust_name = str(reservation.get('name') or reservation.get('customer_name') or 'Client')
    buf.extend(f"Nom client :     {strip_accents(cust_name)}\n".encode('cp858', errors='replace'))

    cust_phone = str(reservation.get('phone') or reservation.get('customer_phone') or '')
    if cust_phone:
        buf.extend(b'\x1b\x45\x01')
        buf.extend(f"Telephone :      {strip_accents(cust_phone)}\n".encode('cp858', errors='replace'))
        buf.extend(b'\x1b\x45\x00')

    notes = str(reservation.get('notes') or '').strip()
    if notes:
        buf.extend(b"------------------------------------------------\n")
        buf.extend(f"Remarques :      {strip_accents(notes)}\n".encode('cp858', errors='replace'))

    buf.extend(b"------------------------------------------------\n")
    buf.extend(b'\x1b\x61\x01')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(b"Statut : TABLE CONFIRMEE\n")
    buf.extend(b'\x1b\x45\x00')
    buf.extend(b"Enregistre sur sushilin2.fr\n")
    buf.extend(b'\x1b\x61\x00')
    buf.extend(b"\n\n\n\n\n\n\x1b\x64\x04\x1d\x56\x01")
    return bytes(buf)

# ====================================================================
# ENVOI SOCKET VERS L'IMPRIMANTE LOCALE (192.168.1.210)
# ====================================================================
def print_payload(payload_bytes):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    try:
        sock.connect((PRINTER_IP, PRINTER_PORT))
        sock.sendall(payload_bytes)
        return True
    except Exception as e:
        print(f"❌ [ERREUR IMPRESSION] Impossible de joindre {PRINTER_IP}:{PRINTER_PORT} -> {e}")
        return False
    finally:
        sock.close()

# ====================================================================
# BOUCLE PRINCIPALE (ÉCOUTE DES NOUVELLES COMMANDES SUR LE SERVEUR)
# ====================================================================
def main():
    print("=" * 60)
    print("🍣 SUSHI LIN — AGENT D'IMPRESSION AUTOMATIQUE EN COURS D'EXECUTION")
    print(f"📡 Serveur surveillé  : {SERVER_URL}")
    print(f"🖨️  Imprimante locale : {PRINTER_IP}:{PRINTER_PORT}")
    print("=" * 60)
    print("En attente de nouvelles commandes... (Laissez cette fenêtre ouverte)")
    
    # Mémoire locale des IDs déjà imprimés pour éviter tout doublon
    printed_orders = set()
    printed_reservations = set()

    while True:
        try:
            # 1. Vérification des commandes
            req = urllib.request.Request(
                f"{SERVER_URL}/api/orders",
                headers={"X-Printer-Key": PRINTER_SECRET_KEY, "User-Agent": "SushiLinPrinter/1.0"}
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as res:
                    if res.status == 200:
                        data = json.loads(res.read().decode('utf-8'))
                        orders = data.get('orders', [])
                        for ord_item in orders:
                            ord_id = str(ord_item.get('id', ''))
                            # Si nouvelle commande non imprimée
                            if ord_id and ord_id not in printed_orders:
                                print(f"\n🔔 [NOUVELLE COMMANDE] #{ord_id} reçue ! Envoi à l'imprimante...")
                                kitchen_b = generate_kitchen_ticket_bytes(ord_item)
                                client_b = generate_ticket_bytes(ord_item)
                                if print_payload(kitchen_b + client_b):
                                    printed_orders.add(ord_id)
                                    print(f"✅ [IMPRESSION OK] Commande #{ord_id} imprimée et découpée !")
            except Exception:
                pass # Mode silencieux en cas d'attente normale

            # 2. Vérification des réservations
            req_res = urllib.request.Request(
                f"{SERVER_URL}/api/reservations",
                headers={"X-Printer-Key": PRINTER_SECRET_KEY, "User-Agent": "SushiLinPrinter/1.0"}
            )
            try:
                with urllib.request.urlopen(req_res, timeout=5) as res:
                    if res.status == 200:
                        data = json.loads(res.read().decode('utf-8'))
                        reservations = data.get('reservations', [])
                        for res_item in reservations:
                            r_id = str(res_item.get('id', ''))
                            if r_id and r_id not in printed_reservations:
                                print(f"\n🔔 [NOUVELLE RÉSERVATION] #{r_id} reçue ! Envoi à l'imprimante...")
                                res_b = generate_reservation_ticket_bytes(res_item)
                                if print_payload(res_b):
                                    printed_reservations.add(r_id)
                                    print(f"✅ [IMPRESSION OK] Réservation #{r_id} imprimée !")
            except Exception:
                pass

        except KeyboardInterrupt:
            print("\nArrêt de l'agent d'impression.")
            break
        except Exception as e:
            # En cas de coupure de connexion internet temporaire, on réessaie sagement
            time.sleep(2)

        time.sleep(CHECK_INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
