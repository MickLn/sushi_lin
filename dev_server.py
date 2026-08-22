import os
import re
import json
import ssl
import traceback
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 3000
ENV_FILE = os.path.join(os.path.dirname(__file__), '.env')

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

class SushiLinHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local testing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/send-order-email':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                env = load_env()
                api_key = env.get('RESEND_API_KEY') or os.environ.get('RESEND_API_KEY')
                registered_account_email = env.get('TEST_EMAIL') or 'mickael.lin@icloud.com'
                requested_email = str(data.get('toEmail', '')).strip()

                order = data.get('order', {})
                items = order.get('items', [])
                subtotal = safe_float(order.get('subtotal', 0))
                discount = safe_float(order.get('discount', 0))
                total = safe_float(order.get('total', 0))

                print(f"\n🍣 [NOUVELLE COMMANDE REÇUE] #{order.get('id', 'CMD-XXX')} - {len(items)} article(s):")
                rows = []
                for it in items:
                    qty = safe_int(it.get('qty', 1))
                    price = safe_float(it.get('price', 0))
                    item_total = price * qty
                    code = str(it.get('code', '')).strip()
                    name = str(it.get('name', 'Article')).strip()
                    code_badge = f'<span style="display:inline-block; font-size:10px; font-weight:700; color:#E11D48; background:#FFF0F3; border:1px solid #FFCCD5; border-radius:4px; padding:1px 5px; margin-right:6px;">{code}</span>' if code else ''
                    
                    print(f"   • {qty}x {code} {name} -> {item_total:.2f} €")
                    rows.append(f"""<tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F8E8EB; vertical-align: middle;">
                          <div style="font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13.5px; color: #1E244D; line-height: 1.4;">
                            <span style="font-weight: 700; color: #1E244D; margin-right: 4px;">{qty}x</span>{code_badge}{name}
                          </div>
                        </td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #F8E8EB; text-align: right; vertical-align: middle; white-space: nowrap;">
                          <span style="font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13.5px; font-weight: 600; color: #1E244D;">{item_total:.2f} €</span>
                        </td>
                    </tr>""")

                items_html = ''.join(rows)
                print(f"   Total: {total:.2f} € | Retrait: {order.get('pickupTime')} | Sauces: {order.get('sauceChoice')}")
                print(f"   Destinataire client: '{requested_email or registered_account_email}'")

                if not api_key:
                    print("❌ ERREUR: Pas de RESEND_API_KEY dans .env")
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Clé RESEND_API_KEY manquante dans .env'}).encode('utf-8'))
                    return

                comment_val = order.get('comment', '').strip()
                comment_row = f"""<tr>
                  <td style="padding: 3px 0; color: #8C98A4; vertical-align: top;">Remarques</td>
                  <td style="padding: 3px 0; color: #1E244D;">{comment_val}</td>
                </tr>""" if comment_val else ""

                client_email_row = f"""<tr>
                  <td style="padding: 3px 0; color: #8C98A4;">E-mail client</td>
                  <td style="padding: 3px 0; color: #1E244D;">{requested_email}</td>
                </tr>""" if requested_email else ""

                # Clean, pure, Mobile-First Receipt Email Template
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
    @media (prefers-color-scheme: dark) {{
      .email-bg {{ background-color: #1A1F3D !important; }}
      .receipt-card {{ background-color: #FFFFFF !important; color: #1E244D !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 20px 12px; background-color: #FFF5F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif; -webkit-font-smoothing: antialiased;" class="email-bg">
  
  <!-- CONTENEUR PRINCIPAL STYLE REÇU / TICKET PREMIUM -->
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 18px; border: 1.5px solid #FFD6DF; box-shadow: 0 4px 25px rgba(30, 36, 77, 0.07); overflow: hidden;" class="receipt-card">
    <tr>
      <td>

        <!-- 1. EN-TÊTE / LOGO TYPOGRAPHIQUE CHARTE SUSHI LIN -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding: 28px 20px 16px;">
              <h1 style="font-family: 'Shippori Mincho', 'Times New Roman', serif; font-size: 26px; font-weight: 700; letter-spacing: 5px; color: #1E244D; margin: 0; text-transform: uppercase; line-height: 1;">SUSHI LIN</h1>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: #F06292; margin: 5px 0 0;">Restaurant Japonais Artisanal</p>
              <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #64748B; margin: 10px 0 0;">Confirmation de commande à emporter</p>
            </td>
          </tr>
        </table>

        <!-- 2. BLOC INFOS COMMANDE (N°, DATE, RETRAIT) -->
        <div style="padding: 0 20px 16px;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFF5F7; border-radius: 12px; padding: 12px 16px; border: 1px solid #FFE4E8;">
            <tr>
              <td style="padding: 3px 0; font-size: 12.5px; color: #8C98A4;">N° Commande</td>
              <td style="padding: 3px 0; font-size: 13px; font-weight: 700; color: #1E244D; text-align: right; letter-spacing: 0.5px;">{order.get('id', 'N/A')}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; font-size: 12.5px; color: #8C98A4;">Date</td>
              <td style="padding: 3px 0; font-size: 12.5px; color: #1E244D; text-align: right;">{order.get('dateFormatted', '')}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; font-size: 12.5px; color: #8C98A4;">Retrait prévu</td>
              <td style="padding: 3px 0; font-size: 13px; font-weight: 600; color: #E11D48; text-align: right;">{order.get('pickupTime', 'Dès que possible')}</td>
            </tr>
          </table>
        </div>

        <!-- SÉPARATEUR TICKET EN POINTILLÉS -->
        <div style="border-top: 1.5px dashed #FFCCD5; margin: 0 20px 16px;"></div>

        <!-- 3. TITRE SECTION : DÉTAIL DE LA COMMANDE -->
        <div style="padding: 0 20px 8px;">
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; color: #8C98A4;">Détail de la commande</div>
        </div>

        <!-- TABLEAU DES ARTICLES COMMANDÉS -->
        <div style="padding: 0 20px 8px;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tbody>
              {items_html}
            </tbody>
          </table>
        </div>

        <!-- SÉPARATEUR TICKET EN POINTILLÉS -->
        <div style="border-top: 1.5px dashed #FFCCD5; margin: 12px 20px 14px;"></div>

        <!-- 4. TOTAUX & REMISE -->
        <div style="padding: 0 20px 16px;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 3px 0; color: #64748B;">Sous-total</td>
              <td style="padding: 3px 0; text-align: right; color: #1E244D;">{subtotal:.2f} €</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #10B981; font-weight: 600;">Remise à emporter (–10%)</td>
              <td style="padding: 3px 0; text-align: right; color: #10B981; font-weight: 600;">–{discount:.2f} €</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 10px; border-top: 1px solid #FFE4E8;">
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size: 14px; font-weight: 600; color: #1E244D;">Total à régler au restaurant</td>
                    <td style="font-size: 17px; font-weight: 700; color: #E11D48; text-align: right; white-space: nowrap;">{total:.2f} €</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- 5. INFORMATIONS PRATIQUES & OPTIONS (SANS ÉMOJIS) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FAFAFA; border-top: 1px solid #F1F5F9;">
          <tr>
            <td style="padding: 16px 20px; font-size: 12px; color: #64748B; line-height: 1.55;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 3px 0; width: 110px; color: #8C98A4; vertical-align: top;">Sauces & couverts</td>
                  <td style="padding: 3px 0; color: #1E244D;">{order.get('sauceChoice', 'Sauce sucrée')} · {order.get('baguettesChoice', '1 paire')}</td>
                </tr>
                {comment_row}
                {client_email_row}
                <tr>
                  <td style="padding: 3px 0; color: #8C98A4; vertical-align: top;">Lieu de retrait</td>
                  <td style="padding: 3px 0; color: #1E244D;">32 Rue des Dames, 78340 Les Clayes-sous-Bois</td>
                </tr>
                <tr>
                  <td style="padding: 3px 0; color: #8C98A4; vertical-align: top;">Téléphone direct</td>
                  <td style="padding: 3px 0;"><a href="tel:0130452848" style="color: #F06292; text-decoration: none; font-weight: 600;">01 30 45 28 48</a></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- 6. PIED DU REÇU -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding: 14px 20px 20px; font-size: 11px; color: #94A3B8; letter-spacing: 0.3px;">
              Merci pour votre commande et bon appétit.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
"""

                def call_resend(to_addr):
                    resend_payload = {
                        "from": "Sushi Lin <onboarding@resend.dev>",
                        "to": [to_addr],
                        "subject": f"Confirmation de votre commande Sushi Lin ({order.get('id', '')})",
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
                    print(f"✅ E-mail envoyé avec succès à {initial_target} (Resend ID: {resend_res.get('id')})")
                except urllib.error.HTTPError as e:
                    err_body = e.read().decode('utf-8')
                    match = re.search(r'\(([^)]+@[^)]+)\)', err_body)
                    if match:
                        allowed_email = match.group(1).strip()
                        print(f"⚠️ Resend 403 (compte gratuit) -> Envoi automatique vers le compte Resend autorisé : {allowed_email}")
                        resend_res = call_resend(allowed_email)
                        print(f"✅ E-mail envoyé avec succès à {allowed_email} (Resend ID: {resend_res.get('id')})")
                    else:
                        resend_res = call_resend("mickael.lin@icloud.com")
                        print(f"✅ E-mail envoyé avec succès à mickael.lin@icloud.com (Resend ID: {resend_res.get('id')})")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'resend': resend_res}).encode('utf-8'))

            except Exception as e:
                print(f"❌ Erreur complète traitement commande: {e}")
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        super().do_POST()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), SushiLinHandler)
    print(f"🍣 Serveur Sushi Lin prêt sur http://localhost:{PORT}")
    server.serve_forever()
