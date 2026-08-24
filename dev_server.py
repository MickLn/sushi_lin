import os
import re
import json
import ssl
import html
import traceback
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, HTTPServer

import db

PORT = 3000
ENV_FILE = os.path.join(os.path.dirname(__file__), '.env')

_MENU_CODE_MAP = None

def get_menu_code_map():
    global _MENU_CODE_MAP
    if _MENU_CODE_MAP is not None:
        return _MENU_CODE_MAP
    code_map = {}
    menu_path = os.path.join(os.path.dirname(__file__), 'data', 'menu.json')
    try:
        if os.path.exists(menu_path):
            with open(menu_path, 'r', encoding='utf-8') as mf:
                menu_json_data = json.load(mf)
                for mi in menu_json_data.get('items', []):
                    if mi.get('id'):
                        code_map[str(mi['id'])] = mi.get('code', '')
                    if mi.get('name'):
                        code_map[str(mi['name']).strip().lower()] = mi.get('code', '')
    except Exception as ex:
        print(f"Warning chargement menu.json map: {ex}", flush=True)
    _MENU_CODE_MAP = code_map
    return _MENU_CODE_MAP

def safe_float(val, default=0.0):
    try:
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            cleaned = val.replace('€', '').replace('\xa0', '').replace(' ', '').replace(',', '.').strip()
            return float(cleaned)
    except Exception:
        pass
    return default

def safe_int(val, default=1):
    try:
        return int(val)
    except Exception:
        return default

def format_euro_fr(val):
    return f"{safe_float(val):.2f}".replace('.', ',') + ' €'

def get_ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

def load_env():
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def dispatch_resend_email(api_key, registered_account_email, requested_email, subject, html_content):
    def call_resend(to_addr):
        resend_payload = {
            "from": "Sushi Lin <onboarding@resend.dev>",
            "to": [to_addr],
            "subject": subject,
            "html": html_content
        }
        ssl_ctx = get_ssl_context()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(resend_payload).encode('utf-8'),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "SushiLin/1.0"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode('utf-8'))

    initial_target = requested_email or registered_account_email
    try:
        resend_res = call_resend(initial_target)
        print(f"E-mail envoyé avec succès à {initial_target} (Resend ID: {resend_res.get('id')})", flush=True)
        return resend_res
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        match = re.search(r'\(([^)]+@[^)]+)\)', err_body)
        if match:
            allowed_email = match.group(1).strip()
            print(f"Resend 403 (compte gratuit) -> Redirection vers l'adresse autorisée : {allowed_email}", flush=True)
            resend_res = call_resend(allowed_email)
            print(f"E-mail envoyé avec succès à {allowed_email} (Resend ID: {resend_res.get('id')})", flush=True)
            return resend_res
        else:
            resend_res = call_resend("mickael.lin@icloud.com")
            print(f"E-mail envoyé avec succès à mickael.lin@icloud.com (Resend ID: {resend_res.get('id')})", flush=True)
            return resend_res

class SushiLinHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable caching in development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # --- API : LECTURE DES UTILISATEURS (POSTGRESQL) ---
        if self.path.startswith('/api/users'):
            users = db.get_users()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'users': users}, default=str).encode('utf-8'))
            return

        # --- API : LECTURE DES COMMANDES (POSTGRESQL) ---
        if self.path.startswith('/api/orders'):
            orders = db.get_orders()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'orders': orders}, default=str).encode('utf-8'))
            return

        # --- API : PROCHAIN ID DE COMMANDE DU JOUR (1, 2, 3...) ---
        if self.path.startswith('/api/next-order-id'):
            next_id = db.get_next_daily_order_id()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'orderId': next_id or '1'}).encode('utf-8'))
            return

        # --- API : LECTURE DES RÉSERVATIONS (POSTGRESQL) ---
        if self.path.startswith('/api/reservations'):
            reservations = db.get_reservations()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'reservations': reservations}, default=str).encode('utf-8'))
            return

        super().do_GET()

    def do_PATCH(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            data = json.loads(body)
            item_id = str(data.get('id', '')).strip()
            status = str(data.get('status', '')).strip()

            if self.path == '/api/orders' and item_id:
                success = db.update_order_status(item_id, status)
                self.send_response(200 if success else 400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
                return

            if self.path == '/api/reservations' and item_id:
                success = db.update_reservation_status(item_id, status)
                self.send_response(200 if success else 400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
                return
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        try:
            data = json.loads(body)
            item_id = str(data.get('id', '')).strip()

            if self.path == '/api/orders' and item_id:
                success = db.delete_order(item_id)
                self.send_response(200 if success else 400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
                return

            if self.path == '/api/reservations' and item_id:
                success = db.delete_reservation(item_id)
                self.send_response(200 if success else 400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
                return
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        env = load_env()
        api_key = env.get('RESEND_API_KEY') or os.environ.get('RESEND_API_KEY')
        registered_account_email = env.get('TEST_EMAIL') or 'mickael.lin@icloud.com'

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'

        # --- ENDPOINT : CRÉATION / MISE À JOUR UTILISATEUR ---
        if self.path == '/api/users':
            try:
                user_data = json.loads(body)
                success = db.save_user(user_data)
                self.send_response(200 if success else 400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': success}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # --- ENDPOINT 1 : ENREGISTREMENT POSTGRESQL & ENVOI EMAIL COMMANDE ---
        if self.path in ('/api/send-order-email', '/api/orders'):
            try:
                data = json.loads(body)
                requested_email = str(data.get('toEmail', '') or data.get('customerEmail', '')).strip()
                order = data.get('order', data)
                if requested_email and not order.get('customerEmail'):
                    order['customerEmail'] = requested_email
                items = order.get('items', [])

                menu_code_map = get_menu_code_map()
                subtotal = safe_float(order.get('subtotal', 0))
                discount = safe_float(order.get('discount', 0))
                total = safe_float(order.get('total', 0))
                order_id_clean = html.escape(str(order.get('id', 'CMD-XXX')).strip())

                # Sauvegarde immédiate dans PostgreSQL
                db_saved = db.save_order(order)

                # Impression automatique directe du ticket thermique (IP: 192.168.1.210)
                try:
                    import threading
                    import thermal_printer
                    threading.Thread(target=thermal_printer.send_to_thermal_printer, args=(order, "192.168.1.210", 9100), daemon=True).start()
                    print(f"[PRINT] 🖨️ Déclenchement automatique de l'impression pour la commande #{order_id_clean} vers 192.168.1.210...", flush=True)
                except Exception as p_err:
                    print(f"[PRINT] Erreur déclenchement impression: {p_err}", flush=True)

                print(f"\n[COMMANDE SUSHI LIN] #{order_id_clean} - {len(items)} article(s) (DB: {'OK' if db_saved else 'N/A'}):", flush=True)
                rows = []
                for it in items:
                    qty = safe_int(it.get('qty', 1))
                    price = safe_float(it.get('price', 0))
                    item_total = price * qty
                    item_id = str(it.get('id', '')).strip()
                    item_name_key = str(it.get('name', '')).strip().lower()
                    code = html.escape(str(it.get('code', '')).strip() or menu_code_map.get(item_id, '') or menu_code_map.get(item_name_key, ''))
                    name = html.escape(str(it.get('name', 'Article')).strip())
                    code_badge = f'<span class="code-pill" style="display:inline-block; font-size:10.5px; font-weight:700; color:#E11D48; background:#FFF0F3; border:1px solid #FFCCD5; border-radius:4px; padding:1px 5px; margin-right:6px;">{code}</span>' if code else ''
                    
                    details_list = it.get('details', [])
                    details_str = ""
                    if details_list and isinstance(details_list, list):
                        flavor_parts = [f"{html.escape(str(d.get('quantity', 1)))}x {html.escape(str(d.get('flavor', '')))}" for d in details_list if d.get('quantity', 0) > 0]
                        if flavor_parts:
                            details_str = f'<div style="font-size: 12px; color: #E11D48; margin-top: 3px; font-weight: 600;">{", ".join(flavor_parts)}</div>'

                    rows.append(f"""<tr class="border-row" style="border-bottom: 1px solid #F5E6EA;">
                        <td style="padding: 11px 0; vertical-align: middle;">
                          <div class="text-main" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif; font-size: 13.5px; color: #0D1127; line-height: 1.4;">
                            <span style="font-weight: 700; margin-right: 4px;">{qty}x</span>{code_badge}{name}
                            {details_str}
                          </div>
                        </td>
                        <td style="padding: 11px 0; text-align: right; vertical-align: middle; white-space: nowrap;">
                          <span class="text-main" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif; font-size: 13.5px; font-weight: 600; color: #0D1127;">{format_euro_fr(item_total)}</span>
                        </td>
                    </tr>""")

                items_html = ''.join(rows)

                sauce_choice = html.escape(str(order.get('sauceChoice', 'Sauce sucrée')).strip())
                baguettes_choice = html.escape(str(order.get('baguettesChoice', '1 paire')).strip())
                sauces_couverts = f"{sauce_choice} / {baguettes_choice}"

                comment_val = html.escape(str(order.get('comment', '')).strip())
                comment_row = f"""<tr>
                  <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top; width: 120px;">Remarques</td>
                  <td class="text-main" style="padding: 7px 0; color: #0D1127;">{comment_val}</td>
                </tr>""" if comment_val else ""

                requested_email_clean = html.escape(requested_email)
                client_email_row = f"""<tr>
                  <td class="text-muted" style="padding: 7px 0; color: #64748B; width: 120px;">E-mail client</td>
                  <td class="text-main" style="padding: 7px 0; color: #0D1127;">{requested_email_clean}</td>
                </tr>""" if requested_email else ""

                raw_order_date = str(order.get('dateFormatted', '') or order.get('date', '')).strip()
                if len(raw_order_date) >= 10 and raw_order_date[4] == '-' and raw_order_date[7] == '-':
                    y, m, d = raw_order_date[:10].split('-')
                    order_date_formatted = f"{d}/{m}/{y}"
                elif len(raw_order_date) >= 10 and raw_order_date[2] == '/' and raw_order_date[5] == '/':
                    order_date_formatted = html.escape(raw_order_date[:10])
                else:
                    order_date_formatted = html.escape(raw_order_date)

                pickup_time_formatted = html.escape(str(order.get('pickupTime', 'Dès que possible')).strip())

                html_content = f"""<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Confirmation de commande - Sushi Lin</title>
  <style>
    :root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
    body, .email-body {{ background-color: #FFF5F8 !important; color: #0D1127 !important; }}
    .email-card {{ background-color: #FFFFFF !important; border: 1.5px solid #FFD6DF !important; }}
    .email-title {{ color: #1E244D !important; }}
    .email-subtitle {{ color: #F06292 !important; }}
    .email-meta-box {{ background-color: #FFF5F8 !important; border: 1px solid #FFE4E8 !important; }}
    .text-main {{ color: #0D1127 !important; }}
    .text-muted {{ color: #64748B !important; }}
    .text-discount {{ color: #059669 !important; }}
    .text-total {{ color: #E11D48 !important; }}
    .border-row {{ border-color: #F5E6EA !important; }}
    .code-pill {{ background-color: #FFF0F3 !important; color: #E11D48 !important; border: 1px solid #FFCCD5 !important; }}
    .link-phone {{ color: #F06292 !important; }}

    @media (prefers-color-scheme: dark) {{
      body, .email-body {{ background-color: #0A0C16 !important; color: #F0F2FF !important; }}
      .email-card {{ background-color: #14172B !important; border: 1.5px solid #2B1D2C !important; }}
      .email-title {{ color: #FFFFFF !important; }}
      .email-subtitle {{ color: #FF80AB !important; }}
      .email-meta-box {{ background-color: #1C2038 !important; border: 1px solid #2C3358 !important; }}
      .text-main {{ color: #F0F2FF !important; }}
      .text-muted {{ color: #A0AEC0 !important; }}
      .text-discount {{ color: #34D399 !important; }}
      .text-total {{ color: #FF80AB !important; }}
      .border-row {{ border-color: #24294A !important; }}
      .code-pill {{ background-color: #381224 !important; color: #FF80AB !important; border: 1px solid #5C1E3A !important; }}
      .link-phone {{ color: #FF80AB !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #FFF5F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif;" class="email-body">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 460px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; border: 1.5px solid #FFD6DF; box-shadow: 0 4px 25px rgba(30, 36, 77, 0.06); overflow: hidden;" class="email-card">
    <tr>
      <td style="padding: 28px 24px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 22px;">
              <h1 class="email-title" style="font-family: 'Shippori Mincho', 'Times New Roman', serif; font-size: 26px; font-weight: 700; letter-spacing: 5px; color: #1E244D; margin: 0; text-transform: uppercase;">SUSHI LIN</h1>
              <p class="email-subtitle" style="font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #F06292; margin: 6px 0 0;">Restaurant Japonais</p>
              <p class="text-muted" style="font-size: 13px; color: #64748B; margin: 12px 0 0;">Confirmation de commande à emporter</p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td class="email-meta-box" style="background-color: #FFF5F8; border-radius: 12px; padding: 14px 18px; border: 1px solid #FFE4E8;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">N° Commande</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 13px; font-weight: 700; color: #0D1127; text-align: right;">{order_id_clean}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">Date</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 12.5px; font-weight: 700; color: #0D1127; text-align: right;">{order_date_formatted}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">Retrait prévu</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 12.5px; font-weight: 700; color: #0D1127; text-align: right;">{pickup_time_formatted}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #8C98A4; margin-bottom: 10px;">Détail de la commande</div>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 18px;">
          <tbody>{items_html}</tbody>
        </table>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px; margin-bottom: 22px;">
          <tr>
            <td class="text-muted" style="padding: 4px 0; color: #64748B;">Sous-total</td>
            <td class="text-main" style="padding: 4px 0; text-align: right; color: #0D1127;">{format_euro_fr(subtotal)}</td>
          </tr>
          <tr>
            <td class="text-discount" style="padding: 4px 0; color: #059669; font-weight: 600;">Remise à emporter (–10%)</td>
            <td class="text-discount" style="padding: 4px 0; text-align: right; color: #059669; font-weight: 600;">–{format_euro_fr(discount)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 14px;"><div class="border-row" style="border-top: 1px solid #F5E6EA;"></div></td>
          </tr>
          <tr>
            <td class="text-main" style="padding: 12px 0; font-size: 14px; font-weight: 700; color: #0D1127;">Total à régler</td>
            <td class="text-total" style="padding: 12px 0; font-size: 17px; font-weight: 700; color: #E11D48; text-align: right; white-space: nowrap;">{format_euro_fr(total)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-bottom: 4px;"><div class="border-row" style="border-top: 1px solid #F5E6EA;"></div></td>
          </tr>
        </table>

        <div style="font-size: 12.5px; line-height: 1.6;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td class="text-muted" style="padding: 7px 0; width: 120px; color: #64748B; vertical-align: top;">Sauces & couverts</td>
              <td class="text-main" style="padding: 7px 0; color: #0D1127;">{sauces_couverts}</td>
            </tr>
            {comment_row}
            {client_email_row}
            <tr>
              <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top;">Lieu de retrait</td>
              <td class="text-main" style="padding: 7px 0; color: #0D1127;">32 Rue des Dames<br>78340 Les Clayes-sous-Bois</td>
            </tr>
            <tr>
              <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top;">Téléphone</td>
              <td style="padding: 7px 0;"><a href="tel:0130790088" class="link-phone" style="color: #F06292; text-decoration: none; font-weight: 600;">01 30 79 00 88</a></td>
            </tr>
          </table>
        </div>

        <div class="text-muted" style="text-align: center; font-size: 11.5px; color: #94A3B8; letter-spacing: 0.3px; margin-top: 22px;">
          Merci pour votre commande et bon appétit.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>"""

                resend_res = dispatch_resend_email(api_key, registered_account_email, requested_email, f"Confirmation de votre commande Sushi Lin ({order_id_clean})", html_content)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'db': db_saved, 'resend': resend_res}).encode('utf-8'))

            except Exception as e:
                print(f"Erreur commande email / db: {e}", flush=True)
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # --- ENDPOINT 2 : ENREGISTREMENT POSTGRESQL & ENVOI EMAIL RÉSERVATION ---
        if self.path in ('/api/send-reservation-email', '/api/reservations'):
            try:
                data = json.loads(body)
                requested_email = str(data.get('toEmail', '') or data.get('email', '')).strip()
                res_data = data.get('reservation', data)
                if requested_email and not res_data.get('email'):
                    res_data['email'] = requested_email

                res_id_clean = html.escape(str(res_data.get('id', 'RES-XXX')).strip())
                res_name_clean = html.escape(str(res_data.get('name', '')).strip())
                res_guests_clean = html.escape(str(res_data.get('guests', '2')).strip())
                raw_res_date = str(res_data.get('date', '')).strip()
                if len(raw_res_date) == 10 and raw_res_date[4] == '-' and raw_res_date[7] == '-':
                    y, m, d = raw_res_date.split('-')
                    res_date_clean = f"{d}/{m}/{y}"
                else:
                    res_date_clean = html.escape(raw_res_date)

                res_service_clean = html.escape(str(res_data.get('service', '19h00')).strip())
                res_phone_clean = html.escape(str(res_data.get('phone', '')).strip())

                # Sauvegarde immédiate dans PostgreSQL
                db_saved = db.save_reservation(res_data)

                print(f"\n[RÉSERVATION TABLE SUSHI LIN] #{res_id_clean} - {res_name_clean} ({res_guests_clean} couverts, DB: {'OK' if db_saved else 'N/A'}):", flush=True)
                print(f"   Date: {res_date_clean} | Créneau: {res_service_clean} | Tél: {res_phone_clean}", flush=True)

                notes_val = html.escape(str(res_data.get('notes', '')).strip())
                notes_row = f"""<tr>
                  <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top; width: 130px;">Demandes</td>
                  <td class="text-main" style="padding: 7px 0; color: #0D1127;">{notes_val}</td>
                </tr>""" if notes_val else ""

                requested_email_clean = html.escape(requested_email)
                client_email_row = f"""<tr>
                  <td class="text-muted" style="padding: 7px 0; color: #64748B; width: 130px;">E-mail de contact</td>
                  <td class="text-main" style="padding: 7px 0; color: #0D1127;">{requested_email_clean}</td>
                </tr>""" if requested_email else ""

                html_res_content = f"""<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Confirmation de réservation - Sushi Lin</title>
  <style>
    :root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
    body, .email-body {{ background-color: #FFF5F8 !important; color: #0D1127 !important; }}
    .email-card {{ background-color: #FFFFFF !important; border: 1.5px solid #FFD6DF !important; }}
    .email-title {{ color: #1E244D !important; }}
    .email-subtitle {{ color: #F06292 !important; }}
    .email-meta-box {{ background-color: #FFF5F8 !important; border: 1px solid #FFE4E8 !important; }}
    .text-main {{ color: #0D1127 !important; }}
    .text-muted {{ color: #64748B !important; }}
    .text-status {{ color: #059669 !important; }}
    .border-row {{ border-color: #F5E6EA !important; }}
    .link-phone {{ color: #F06292 !important; }}

    @media (prefers-color-scheme: dark) {{
      body, .email-body {{ background-color: #0A0C16 !important; color: #F0F2FF !important; }}
      .email-card {{ background-color: #14172B !important; border: 1.5px solid #2B1D2C !important; }}
      .email-title {{ color: #FFFFFF !important; }}
      .email-subtitle {{ color: #FF80AB !important; }}
      .email-meta-box {{ background-color: #1C2038 !important; border: 1px solid #2C3358 !important; }}
      .text-main {{ color: #F0F2FF !important; }}
      .text-muted {{ color: #A0AEC0 !important; }}
      .text-status {{ color: #34D399 !important; }}
      .border-row {{ border-color: #24294A !important; }}
      .link-phone {{ color: #FF80AB !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #FFF5F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif;" class="email-body">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 460px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; border: 1.5px solid #FFD6DF; box-shadow: 0 4px 25px rgba(30, 36, 77, 0.06); overflow: hidden;" class="email-card">
    <tr>
      <td style="padding: 28px 24px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 22px;">
              <h1 class="email-title" style="font-family: 'Shippori Mincho', 'Times New Roman', serif; font-size: 26px; font-weight: 700; letter-spacing: 5px; color: #1E244D; margin: 0; text-transform: uppercase;">SUSHI LIN</h1>
              <p class="email-subtitle" style="font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #F06292; margin: 6px 0 0;">Restaurant Japonais</p>
              <p class="text-muted" style="font-size: 13px; color: #64748B; margin: 12px 0 0;">Confirmation de votre réservation de table</p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td class="email-meta-box" style="background-color: #FFF5F8; border-radius: 12px; padding: 14px 18px; border: 1px solid #FFE4E8;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">N° Réservation</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 13px; font-weight: 700; color: #0D1127; text-align: right;">#{res_id_clean}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">Date</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 12.5px; font-weight: 700; color: #0D1127; text-align: right;">{res_date_clean}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">Créneau</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 12.5px; font-weight: 700; color: #0D1127; text-align: right;">{res_service_clean}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="text-muted" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #8C98A4; margin-bottom: 12px;">Détail de la réservation</div>

        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px; margin-bottom: 22px;">
          <tr class="border-row" style="border-bottom: 1px solid #F5E6EA;">
            <td class="text-muted" style="padding: 10px 0; color: #64748B; width: 130px;">Nombre de couverts</td>
            <td class="text-main" style="padding: 10px 0; font-weight: 700; color: #0D1127; text-align: right;">{res_guests_clean} personne(s)</td>
          </tr>
          <tr class="border-row" style="border-bottom: 1px solid #F5E6EA;">
            <td class="text-muted" style="padding: 10px 0; color: #64748B;">Nom du client</td>
            <td class="text-main" style="padding: 10px 0; font-weight: 600; color: #0D1127; text-align: right;">{res_name_clean}</td>
          </tr>
          <tr>
            <td class="text-muted" style="padding: 10px 0; color: #64748B;">Téléphone</td>
            <td class="text-main" style="padding: 10px 0; color: #0D1127; text-align: right;">{res_phone_clean}</td>
          </tr>
          <tr>
            <td class="text-main" style="padding: 14px 0 10px; font-size: 14px; font-weight: 700; color: #0D1127;">Statut</td>
            <td class="text-status" style="padding: 14px 0 10px; font-size: 15px; font-weight: 700; color: #059669; text-align: right; white-space: nowrap;">Table confirmée</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-bottom: 4px;"><div class="border-row" style="border-top: 1px solid #F5E6EA;"></div></td>
          </tr>
        </table>

        <div style="font-size: 12.5px; line-height: 1.6;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            {notes_row}
            {client_email_row}
            <tr>
              <td class="text-muted" style="padding: 7px 0; width: 130px; color: #64748B; vertical-align: top;">Lieu du restaurant</td>
              <td class="text-main" style="padding: 7px 0; color: #0D1127;">32 Rue des Dames<br>78340 Les Clayes-sous-Bois</td>
            </tr>
            <tr>
              <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top;">Téléphone</td>
              <td style="padding: 7px 0;"><a href="tel:0130790088" class="link-phone" style="color: #F06292; text-decoration: none; font-weight: 600;">01 30 79 00 88</a></td>
            </tr>
          </table>
        </div>

        <div class="text-muted" style="text-align: center; font-size: 11.5px; color: #94A3B8; letter-spacing: 0.3px; margin-top: 22px;">
          Nous serons ravis de vous accueillir chez Sushi Lin.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>"""

                resend_res = dispatch_resend_email(api_key, registered_account_email, requested_email, f"Confirmation de votre réservation Sushi Lin ({res_id_clean})", html_res_content)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'db': db_saved, 'resend': resend_res}).encode('utf-8'))

            except Exception as e:
                print(f"Erreur réservation email / db: {e}", flush=True)
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        super().do_POST()

if __name__ == '__main__':
    db.init_db()
    server = HTTPServer(('0.0.0.0', PORT), SushiLinHandler)
    print(f"Serveur Sushi Lin prêt sur http://0.0.0.0:{PORT}", flush=True)
    server.serve_forever()
