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
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
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

                print(f"\n🍣 [COMMANDE SUSHI LIN] #{order.get('id', 'CMD-XXX')} - {len(items)} article(s):")
                rows = []
                for it in items:
                    qty = safe_int(it.get('qty', 1))
                    price = safe_float(it.get('price', 0))
                    item_total = price * qty
                    code = str(it.get('code', '')).strip()
                    name = str(it.get('name', 'Article')).strip()
                    code_badge = f'<span class="code-pill" style="display:inline-block; font-size:10.5px; font-weight:700; color:#E11D48; background:#FFF0F3; border:1px solid #FFCCD5; border-radius:4px; padding:1px 5px; margin-right:6px;">{code}</span>' if code else ''
                    
                    print(f"   • {qty}x {code} {name} -> {item_total:.2f} €")
                    rows.append(f"""<tr class="border-row" style="border-bottom: 1px solid #F5E6EA;">
                        <td style="padding: 11px 0; vertical-align: middle;">
                          <div class="text-main" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif; font-size: 13.5px; color: #0D1127; line-height: 1.4;">
                            <span style="font-weight: 700; margin-right: 4px;">{qty}x</span>{code_badge}{name}
                          </div>
                        </td>
                        <td style="padding: 11px 0; text-align: right; vertical-align: middle; white-space: nowrap;">
                          <span class="text-main" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif; font-size: 13.5px; font-weight: 600; color: #0D1127;">{item_total:.2f} €</span>
                        </td>
                    </tr>""")

                items_html = ''.join(rows)

                if not api_key:
                    print("❌ ERREUR: Pas de RESEND_API_KEY dans .env")
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Clé RESEND_API_KEY manquante dans .env'}).encode('utf-8'))
                    return

                # Formatting options & details
                sauce_choice = order.get('sauceChoice', 'Sauce sucrée')
                baguettes_choice = order.get('baguettesChoice', '1 paire')
                sauces_couverts = f"{sauce_choice} / {baguettes_choice}"

                comment_val = order.get('comment', '').strip()
                comment_row = f"""<tr>
                  <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top; width: 120px;">Remarques</td>
                  <td class="text-main" style="padding: 7px 0; color: #0D1127;">{comment_val}</td>
                </tr>""" if comment_val else ""

                client_email_row = f"""<tr>
                  <td class="text-muted" style="padding: 7px 0; color: #64748B; width: 120px;">E-mail client</td>
                  <td class="text-main" style="padding: 7px 0; color: #0D1127;">{requested_email}</td>
                </tr>""" if requested_email else ""

                # Responsive Clean Mobile-First HTML Email (Light/Dark mode compliant)
                html_content = f"""<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Confirmation de commande - Sushi Lin</title>
  <style>
    :root {{
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }}
    
    /* STYLES LIGHT PAR DÉFAUT */
    body, .email-body {{
      background-color: #FFF5F8 !important;
      color: #0D1127 !important;
    }}
    .email-card {{
      background-color: #FFFFFF !important;
      border: 1.5px solid #FFD6DF !important;
    }}
    .email-title {{
      color: #1E244D !important;
    }}
    .email-subtitle {{
      color: #F06292 !important;
    }}
    .email-meta-box {{
      background-color: #FFF5F8 !important;
      border: 1px solid #FFE4E8 !important;
    }}
    .text-main {{
      color: #0D1127 !important;
    }}
    .text-muted {{
      color: #64748B !important;
    }}
    .text-discount {{
      color: #059669 !important;
    }}
    .text-total {{
      color: #E11D48 !important;
    }}
    .border-row {{
      border-color: #F5E6EA !important;
    }}
    .code-pill {{
      background-color: #FFF0F3 !important;
      color: #E11D48 !important;
      border: 1px solid #FFCCD5 !important;
    }}
    .link-phone {{
      color: #F06292 !important;
    }}

    /* STYLES DARK MODE ADAPTATIFS */
    @media (prefers-color-scheme: dark) {{
      body, .email-body {{
        background-color: #0A0C16 !important;
        color: #F0F2FF !important;
      }}
      .email-card {{
        background-color: #14172B !important;
        border: 1.5px solid #2B1D2C !important;
      }}
      .email-title {{
        color: #FFFFFF !important;
      }}
      .email-subtitle {{
        color: #FF80AB !important;
      }}
      .email-meta-box {{
        background-color: #1C2038 !important;
        border: 1px solid #2C3358 !important;
      }}
      .text-main {{
        color: #F0F2FF !important;
      }}
      .text-muted {{
        color: #A0AEC0 !important;
      }}
      .text-discount {{
        color: #34D399 !important;
      }}
      .text-total {{
        color: #FF80AB !important;
      }}
      .border-row {{
        border-color: #24294A !important;
      }}
      .code-pill {{
        background-color: #381224 !important;
        color: #FF80AB !important;
        border: 1px solid #5C1E3A !important;
      }}
      .link-phone {{
        color: #FF80AB !important;
      }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #FFF5F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Source Sans 3', sans-serif; -webkit-font-smoothing: antialiased;" class="email-body">
  
  <!-- CARTE PRINCIPALE ÉPURÉE (MOBILE-FIRST) -->
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 460px; margin: 0 auto; background-color: #FFFFFF; border-radius: 20px; border: 1.5px solid #FFD6DF; box-shadow: 0 4px 25px rgba(30, 36, 77, 0.06); overflow: hidden;" class="email-card">
    <tr>
      <td style="padding: 28px 24px;">

        <!-- 1. EN-TÊTE TYPOGRAPHIQUE -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align: center; padding-bottom: 22px;">
              <h1 class="email-title" style="font-family: 'Shippori Mincho', 'Times New Roman', serif; font-size: 26px; font-weight: 700; letter-spacing: 5px; color: #1E244D; margin: 0; text-transform: uppercase; line-height: 1;">SUSHI LIN</h1>
              <p class="email-subtitle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #F06292; margin: 6px 0 0;">Restaurant Japonais</p>
              <p class="text-muted" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #64748B; margin: 12px 0 0;">Confirmation de commande à emporter</p>
            </td>
          </tr>
        </table>

        <!-- 2. ENCADRÉ INFOS COMMANDE (TOUTES LES DONNÉES EN GRAS COHÉRENT) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td class="email-meta-box" style="background-color: #FFF5F8; border-radius: 12px; padding: 14px 18px; border: 1px solid #FFE4E8;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">N° Commande</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 13px; font-weight: 700; color: #0D1127; text-align: right; letter-spacing: 0.5px;">{order.get('id', 'N/A')}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">Date</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 12.5px; font-weight: 700; color: #0D1127; text-align: right;">{order.get('dateFormatted', '')}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="padding: 3px 0; font-size: 12.5px; color: #64748B;">Retrait prévu</td>
                  <td class="text-main" style="padding: 3px 0; font-size: 12.5px; font-weight: 700; color: #0D1127; text-align: right;">{order.get('pickupTime', 'Dès que possible')}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- 3. TITRE SECTION : DÉTAIL DE LA COMMANDE -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom: 10px;">
              <div class="text-muted" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #8C98A4;">Détail de la commande</div>
            </td>
          </tr>
        </table>

        <!-- 4. TABLEAU DES ARTICLES -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 18px;">
          <tbody>
            {items_html}
          </tbody>
        </table>

        <!-- 5. TOTAUX & CADRE ÉPURÉ POUR LE TOTAL -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px; margin-bottom: 22px;">
          <tr>
            <td class="text-muted" style="padding: 4px 0; color: #64748B;">Sous-total</td>
            <td class="text-main" style="padding: 4px 0; text-align: right; color: #0D1127;">{subtotal:.2f} €</td>
          </tr>
          <tr>
            <td class="text-discount" style="padding: 4px 0; color: #059669; font-weight: 600;">Remise à emporter (–10%)</td>
            <td class="text-discount" style="padding: 4px 0; text-align: right; color: #059669; font-weight: 600;">–{discount:.2f} €</td>
          </tr>
          
          <!-- 1ER TRAIT DISCRET : HAUT DU CADRE TOTAL (ESPACÉ DU TEXTE AU DESSUS) -->
          <tr>
            <td colspan="2" style="padding-top: 14px;">
              <div class="border-row" style="border-top: 1px solid #F5E6EA;"></div>
            </td>
          </tr>

          <!-- LIGNE TOTAL À RÉGLER (ENCADRÉE) -->
          <tr>
            <td class="text-main" style="padding: 12px 0; font-size: 14px; font-weight: 700; color: #0D1127;">Total à régler</td>
            <td class="text-total" style="padding: 12px 0; font-size: 17px; font-weight: 700; color: #E11D48; text-align: right; white-space: nowrap;">{total:.2f} €</td>
          </tr>

          <!-- 2E TRAIT DISCRET : BAS DU CADRE TOTAL -->
          <tr>
            <td colspan="2" style="padding-bottom: 4px;">
              <div class="border-row" style="border-top: 1px solid #F5E6EA;"></div>
            </td>
          </tr>
        </table>

        <!-- 6. INFORMATIONS PRATIQUES (AÉRÉES) -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12.5px; line-height: 1.6;">
          <tr>
            <td class="text-muted" style="padding: 7px 0; width: 120px; color: #64748B; vertical-align: top;">Sauces & couverts</td>
            <td class="text-main" style="padding: 7px 0; color: #0D1127;">{sauces_couverts}</td>
          </tr>
          {comment_row}
          {client_email_row}
          <tr>
            <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top;">Lieu de retrait</td>
            <td class="text-main" style="padding: 7px 0; color: #0D1127;">
              32 Rue des Dames<br>78340 Les Clayes-sous-Bois
            </td>
          </tr>
          <tr>
            <td class="text-muted" style="padding: 7px 0; color: #64748B; vertical-align: top;">Téléphone</td>
            <td style="padding: 7px 0;"><a href="tel:0130452848" class="link-phone" style="color: #F06292; text-decoration: none; font-weight: 600;">01 30 45 28 48</a></td>
          </tr>
        </table>

        <!-- 7. PIED DU REÇU -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 22px;">
          <tr>
            <td class="text-muted" style="text-align: center; font-size: 11.5px; color: #94A3B8; letter-spacing: 0.3px;">
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
