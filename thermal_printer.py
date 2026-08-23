import socket
import unicodedata

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

def generate_ticket_bytes(order):
    buf = bytearray()

    # 1. ESC @ (Init) + FS . (Cancel Chinese mode)
    buf.extend(b'\x1b\x40\x1c\x2e')
    # Charset PC858 Euro
    buf.extend(b'\x1b\x74\x13')

    # Centered Header
    buf.extend(b'\x1b\x61\x01') # Align Center
    buf.extend(b'\x1b\x45\x01') # Bold ON
    buf.extend(strip_accents("SUSHI LIN").encode('cp858', errors='replace') + b'\n')
    buf.extend(b'\x1b\x45\x00') # Bold OFF
    buf.extend(strip_accents("32 Rue des Dames - 78340 Les Clayes").encode('cp858', errors='replace') + b'\n')
    buf.extend(b"Tel : 01 30 79 00 88\n")
    buf.extend(b"Site : sushilin.fr\n")
    buf.extend(b'\x1b\x61\x00') # Align Left
    buf.extend(b"------------------------------------------------\n")

    # Customer Block
    order_num = str(order.get('id') or order.get('number') or '1')
    buf.extend(b'\x1b\x45\x01') # Bold ON
    buf.extend(f"N. commande :   {order_num}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00') # Bold OFF

    date_str = str(order.get('dateFormatted') or order.get('serviceDate') or '')
    if date_str:
        buf.extend(f"Date :          {strip_accents(date_str)}\n".encode('cp858', errors='replace'))

    pickup_time = str(order.get('pickupTime') or '19h30')
    buf.extend(f"Heure retrait : {strip_accents(pickup_time)}\n".encode('cp858', errors='replace'))

    cust_name = str(order.get('customerName') or order.get('name') or 'Client Sushi Lin')
    buf.extend(f"Nom client :    {strip_accents(cust_name)}\n".encode('cp858', errors='replace'))

    cust_phone = str(order.get('customerPhone') or order.get('phone') or '06 00 00 00 00')
    buf.extend(b'\x1b\x45\x01')
    buf.extend(f"Telephone :     {strip_accents(cust_phone)}\n".encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00')

    cust_email = str(order.get('customerEmail') or order.get('email') or '').strip()
    if cust_email:
        buf.extend(f"Email :         {cust_email}\n".encode('cp858', errors='replace'))

    # Preferences
    prefs = []
    comment = str(order.get('comment') or order.get('note') or '').strip()
    if comment:
        prefs.append(f"Commentaires :  {strip_accents(comment)}")
    flatware = str(order.get('baguettesChoice') or order.get('flatwareQty') or '').strip()
    if flatware:
        prefs.append(f"Nb. couverts :  {strip_accents(flatware)}")
    sauce = str(order.get('sauceChoice') or order.get('sauce') or '').strip()
    if sauce:
        prefs.append(f"Sauce :         {strip_accents(sauce)}")

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
    header_title = "QTE / CODE   DESIGNATION".ljust(37) + "TOTAL".rjust(11) + "\n"
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
        name = strip_accents(str(it.get('name') or 'Article')).upper().strip()

        # 1. Quantity and Code in Quad Area (Double Width + Double Height + Bold)
        buf.extend(b'\x1d\x21\x11') # Double Width & Height
        buf.extend(b'\x1b\x45\x01') # Bold ON
        buf.extend(f"{qty}x  [ {code} ]\n".encode('cp858', errors='replace'))

        # Reset to Normal font
        buf.extend(b'\x1d\x21\x00') # Normal Size
        buf.extend(b'\x1b\x45\x01') # Bold ON

        total_str = format_euro(total_cents)
        max_first_len = max(10, 48 - 3 - len(total_str) - 2)
        name_lines = wrap_words(name, max_first_len)

        # Line 1: first part of name + Total on right
        first_line = "   " + name_lines[0].ljust(48 - 3 - len(total_str)) + total_str + "\n"
        buf.extend(first_line.encode('cp858', errors='replace'))

        # Remaining lines of name
        for extra in name_lines[1:]:
            buf.extend(f"   {extra}\n".encode('cp858', errors='replace'))

        buf.extend(b'\x1b\x45\x00') # Bold OFF

        # Discount line
        is_elig = is_discount_eligible(code, name)
        if is_elig:
            discounted_cents = int(round(total_cents * 0.90))
            if discounted_cents < total_cents:
                disc_str = format_euro(discounted_cents)
                disc_line = "   " + "(-10% remise)".ljust(48 - 3 - len(disc_str)) + disc_str + "\n"
                buf.extend(disc_line.encode('cp858', errors='replace'))

        # Details / Options
        details = it.get('details') or it.get('selectedOptions') or []
        for d in details:
            d_str = d if isinstance(d, str) else f"{d.get('quantity', 1)}x {d.get('flavor', d.get('name', ''))}"
            buf.extend(f"     - {strip_accents(d_str)}\n".encode('cp858', errors='replace'))

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

    # Net a payer (Centered & Bold)
    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b'\x1b\x45\x01') # Bold ON
    net_str = f"Net a payer : {format_euro(int(round(total_val * 100)))}\n"
    buf.extend(net_str.encode('cp858', errors='replace'))
    buf.extend(b'\x1b\x45\x00') # Bold OFF
    buf.extend(b'\x1b\x61\x00') # Left
    buf.extend(b"------------------------------------------------\n")

    # Footer
    buf.extend(b'\x1b\x61\x01') # Center
    buf.extend(b"Merci de votre visite, a bientot !\n\n")
    buf.extend(b'\x1b\x61\x00') # Left

    # Cut Paper (GS V 1)
    buf.extend(b'\x1d\x56\x01')

    return bytes(buf)

def send_to_thermal_printer(order, printer_ip="192.168.1.210", printer_port=9100, timeout=4):
    ticket_bytes = generate_ticket_bytes(order)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((printer_ip, printer_port))
        sock.sendall(ticket_bytes)
        print(f"[THERMAL PRINTER] ✅ Ticket #{order.get('id', '1')} imprimé avec succès sur {printer_ip}:{printer_port} !", flush=True)
        return True
    except Exception as e:
        print(f"[THERMAL PRINTER] ❌ Erreur connexion imprimante ({printer_ip}:{printer_port}): {e}", flush=True)
        return False
    finally:
        sock.close()
