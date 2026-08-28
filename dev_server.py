import os
import re
import json
import ssl
import html
import time
import traceback
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
from http.server import SimpleHTTPRequestHandler, HTTPServer

import db
import auth

PORT = 3000
ENV_FILE = os.path.join(os.path.dirname(__file__), '.env')

_MENU_CODE_MAP = None
_PUBLIC_SUBMISSIONS = {}

def is_public_rate_limited(ip, max_requests=15, window_sec=60):
    now = time.time()
    reqs = _PUBLIC_SUBMISSIONS.get(ip, [])
    recent = [t for t in reqs if now - t < window_sec]
    _PUBLIC_SUBMISSIONS[ip] = recent
    if len(recent) >= max_requests:
        return True
    _PUBLIC_SUBMISSIONS[ip].append(now)
    return False

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
    def get_client_ip(self):
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return self.client_address[0] if self.client_address else '127.0.0.1'

    def get_admin_token(self):
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            return auth_header[7:].strip()
        x_token = self.headers.get('X-Admin-Token', '')
        if x_token:
            return x_token.strip()
        cookie_header = self.headers.get('Cookie', '')
        for c in cookie_header.split(';'):
            c = c.strip()
            if c.startswith('sushilin_admin_session='):
                return c.split('=', 1)[1].strip()
        return None

    def require_admin_auth(self):
        # Authentification par clé d'agent d'impression sécurisée
        printer_key = self.headers.get('X-Printer-Key', '')
        expected_printer_key = os.environ.get('PRINTER_SECRET_KEY') or 'sushilin_secret_printer_2026'
        if printer_key and printer_key == expected_printer_key:
            return True

        token = self.get_admin_token()
        if not token or not auth.verify_session(token):
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'Authentification requise. Session invalide ou expirée.',
                'authenticated': False
            }).encode('utf-8'))
            return False
        return True

    def end_headers(self):
        # Security headers conformes ANSSI / OWASP
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()')
        
        # CORS & Cache control
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, X-Printer-Key')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # --- PROTECTION ANTI-FUITE : BLOCAGE DES FICHIERS SENSIBLES ET CACHÉS ---
        clean_path = urlparse(self.path).path
        forbidden_patterns = [
            r'(?:^|/)\.',           # Fichiers ou dossiers cachés (.env, .git, .admin_auth.json, etc.)
            r'\.env',               # Fichiers .env
            r'\.py$',               # Fichiers sources backend
            r'\.pyc$',              # Fichiers compilés
            r'\.sql$',              # Schémas et scripts SQL
            r'\.ya?ml$',            # Configurations docker-compose / pipelines
            r'Dockerfile',          # Configuration du conteneur
            r'\.sh$', r'\.bat$', r'\.command$', r'\.zip$',
            r'/db/',                # Répertoire de scripts BDD
            r'__pycache__'
        ]
        if any(re.search(pat, clean_path, re.IGNORECASE) for pat in forbidden_patterns):
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        # --- API : VÉRIFICATION DE SESSION ADMIN ---
        if self.path.startswith('/api/auth/verify'):
            token = self.get_admin_token()
            is_valid = bool(token and auth.verify_session(token))
            self.send_response(200 if is_valid else 401)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'authenticated': is_valid}).encode('utf-8'))
            return

        # --- API : LECTURE DES PARAMÈTRES / HORAIRES DU RESTAURANT (PUBLIC) ---
        if self.path.startswith('/api/settings'):
            settings_path = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
            settings = {
                "status": "open",
                "exceptionalMessage": "",
                "scheduleText": "7j/7 : 12h00 – 14h30 & 18h30 – 22h00",
                "midiStart": "12:00",
                "midiEnd": "14:30",
                "soirStart": "18:30",
                "soirEnd": "22:00",
                "discount": 10,
                "maxOrdersPerSlotWeek": 5,
                "maxOrdersPerSlotWeekend": 3,
                "maxOrdersPerSlot": 5,
                "maxReservationsPerSlot": 5,
                "phone": "01 30 79 00 88",
                "whatsapp": "33130790088",
                "address": "32 Rue des Dames, 78340 Les Clayes-sous-Bois",
                "mapsLink": "https://goo.gl/maps/gdgPWQZ2CxFZTC1a7"
            }
            if os.path.exists(settings_path):
                try:
                    with open(settings_path, 'r', encoding='utf-8') as sf:
                        saved = json.load(sf)
                        if isinstance(saved, dict):
                            settings.update(saved)
                except Exception as ex:
                    print(f"Warning lecture settings.json: {ex}", flush=True)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(settings, ensure_ascii=False).encode('utf-8'))
            return

        # --- API : LECTURE DES UTILISATEURS (PROTÉGÉ RGPD) ---
        if self.path.startswith('/api/users'):
            if not self.require_admin_auth():
                return
            users = db.get_users()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'users': users}, default=str).encode('utf-8'))
            return

        # --- API : LECTURE DES COMMANDES (PROTÉGÉ RGPD) ---
        if self.path.startswith('/api/orders'):
            if not self.require_admin_auth():
                return
            orders = db.get_orders()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'orders': orders}, default=str).encode('utf-8'))
            return

        # --- API : PROCHAIN ID DE COMMANDE DU JOUR (1, 2, 3...) (PUBLIC) ---
        if self.path.startswith('/api/next-order-id'):
            next_id = db.get_next_daily_order_id()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'orderId': next_id or '1'}).encode('utf-8'))
            return

        # --- API : LECTURE DES BEST-SELLERS DU MOIS (PUBLIC) ---
        if self.path.startswith('/api/bestsellers'):
            bestsellers = db.get_monthly_bestsellers(limit=10)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'bestsellers': bestsellers}, ensure_ascii=False).encode('utf-8'))
            return

        # --- API : LECTURE DES RÉSERVATIONS (PROTÉGÉ RGPD) ---
        if self.path.startswith('/api/reservations'):
            if not self.require_admin_auth():
                return
            reservations = db.get_reservations()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'reservations': reservations}, default=str).encode('utf-8'))
            return

        # --- API : FICHIER CALENDRIER ICS NATIVE APPLE / OUTLOOK ---
        if self.path.startswith('/api/reservation-calendar.ics'):
            from urllib.parse import urlparse, parse_qs
            import datetime
            query = parse_qs(urlparse(self.path).query)
            res_date = query.get('date', ['2026-08-24'])[0]
            res_service = query.get('service', ['19h00'])[0]
            res_guests = query.get('guests', ['2'])[0]
            res_name = query.get('name', ['Client'])[0]

            try:
                y, m, d = [int(x) for x in res_date.split('-')]
                clean_service = res_service.replace('h', ':')
                parts = clean_service.split(':')
                h = int(parts[0]) if len(parts) > 0 and parts[0] else 19
                mi = int(parts[1]) if len(parts) > 1 and parts[1] else 0
            except:
                y, m, d, h, mi = 2026, 8, 24, 19, 0

            dt_start = f"{y:04d}{m:02d}{d:02d}T{h:02d}{mi:02d}00"
            h_end = (h + 2) % 24
            dt_end = f"{y:04d}{m:02d}{d:02d}T{h_end:02d}{mi:02d}00"
            dt_stamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

            guests_label = '1 couvert' if res_guests == '1' else f"{res_guests} couverts"
            summary = f"🍣 Réservation Sushi Lin ({guests_label})"
            description = f"Réservation confirmée au nom de {res_name}. Restaurant SUSHI LIN - Tél: 01 30 79 00 88"
            location = "SUSHI LIN, 32 Rue des Dames, 78340 Les Clayes-sous-Bois, France"

            ics_body = f"""BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sushi Lin//Reservation System//FR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nBEGIN:VEVENT\r\nUID:res-{dt_start}@sushilin.fr\r\nDTSTAMP:{dt_stamp}\r\nDTSTART:{dt_start}\r\nDTEND:{dt_end}\r\nSUMMARY:{summary}\r\nDESCRIPTION:{description}\r\nLOCATION:{location}\r\nSTATUS:CONFIRMED\r\nBEGIN:VALARM\r\nTRIGGER:-PT2H\r\nACTION:DISPLAY\r\nDESCRIPTION:Rappel Réservation Sushi Lin dans 2 heures\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR"""

            self.send_response(200)
            self.send_header('Content-Type', 'text/calendar; charset=utf-8')
            self.send_header('Content-Disposition', 'inline; filename="reservation-sushi-lin.ics"')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(ics_body.encode('utf-8'))
            return

        super().do_GET()

    def do_PATCH(self):
        if not self.require_admin_auth():
            return
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
        if not self.require_admin_auth():
            return
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
        # Limitation de taille de requête (1 Mo max) pour prévenir les attaques DoS
        if content_length > 1024 * 1024:
            self.send_response(413)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Payload Too Large'}).encode('utf-8'))
            return

        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'

        # --- ENDPOINT AUTH : CONNEXION PAR CODE PIN (AVEC RATE LIMITING) ---
        if self.path == '/api/auth/login':
            try:
                data = json.loads(body)
                pin = str(data.get('pin', '')).strip()
                client_ip = self.get_client_ip()

                if auth.is_ip_rate_limited(client_ip):
                    self.send_response(429)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': False,
                        'error': 'Trop de tentatives erronées. Accès bloqué pendant 10 minutes.'
                    }).encode('utf-8'))
                    return

                ok, msg = auth.verify_pin(pin, client_ip)
                if ok:
                    token = auth.create_session(client_ip)
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Set-Cookie', f'sushilin_admin_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': True,
                        'token': token,
                        'message': 'Authentification réussie'
                    }).encode('utf-8'))
                else:
                    self.send_response(401)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'success': False,
                        'error': msg
                    }).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # --- ENDPOINT AUTH : DÉCONNEXION ---
        if self.path == '/api/auth/logout':
            token = self.get_admin_token()
            if token:
                auth.revoke_session(token)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Set-Cookie', 'sushilin_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
            return

        # --- ENDPOINT AUTH : CHANGEMENT DE CODE PIN ---
        if self.path == '/api/auth/change-pin':
            if not self.require_admin_auth():
                return
            try:
                data = json.loads(body)
                current_pin = str(data.get('currentPin', '')).strip()
                new_pin = str(data.get('newPin', '')).strip()
                client_ip = self.get_client_ip()

                ok, msg = auth.change_pin(current_pin, new_pin, client_ip)
                self.send_response(200 if ok else 400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': ok, 'message': msg if ok else None, 'error': None if ok else msg}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # --- ENDPOINT : PARAMÈTRES / HORAIRES DU RESTAURANT (PROTÉGÉ) ---
        if self.path == '/api/settings':
            if not self.require_admin_auth():
                return
            try:
                settings_data = json.loads(body)
                settings_path = os.path.join(os.path.dirname(__file__), 'data', 'settings.json')
                with open(settings_path, 'w', encoding='utf-8') as sf:
                    json.dump(settings_data, sf, ensure_ascii=False, indent=2)

                # Mettre à jour également data/menu.json pour cohérence
                menu_path = os.path.join(os.path.dirname(__file__), 'data', 'menu.json')
                if os.path.exists(menu_path):
                    try:
                        with open(menu_path, 'r', encoding='utf-8') as mf:
                            mdata = json.load(mf)
                        if 'restaurant' not in mdata:
                            mdata['restaurant'] = {}
                        if 'hours' not in mdata['restaurant']:
                            mdata['restaurant']['hours'] = {}
                        
                        midi_s = settings_data.get('midiStart', '12:00').replace(':', 'h')
                        midi_e = settings_data.get('midiEnd', '14:30').replace(':', 'h')
                        soir_s = settings_data.get('soirStart', '18:30').replace(':', 'h')
                        soir_e = settings_data.get('soirEnd', '22:00').replace(':', 'h')
                        
                        mdata['restaurant']['hours']['lunch'] = f"{midi_s} – {midi_e}"
                        mdata['restaurant']['hours']['dinner'] = f"{soir_s} – {soir_e}"
                        if settings_data.get('phone'):
                            mdata['restaurant']['phone'] = settings_data['phone']
                            mdata['restaurant']['phone_formatted'] = settings_data['phone']
                        if settings_data.get('address'):
                            mdata['restaurant']['address'] = settings_data['address']
                        if 'discount' in settings_data:
                            mdata['restaurant']['takeaway_discount'] = settings_data['discount']
                        
                        with open(menu_path, 'w', encoding='utf-8') as mf:
                            json.dump(mdata, mf, ensure_ascii=False, indent=2)
                    except Exception as mex:
                        print(f"Warning mise a jour menu.json avec settings: {mex}", flush=True)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'settings': settings_data}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            return

        # --- ENDPOINT : CRÉATION / MISE À JOUR UTILISATEUR (PROTÉGÉ) ---
        if self.path == '/api/users':
            if not self.require_admin_auth():
                return
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

        # --- ENDPOINT : IMPRESSION DIRECTE COMMANDE TÉLÉPHONE (SANS SAUVEGARDE DB) ---
        if self.path == '/api/print-pos-order':
            try:
                data = json.loads(body)
                order = data.get('order', data)
                order_id_clean = html.escape(str(order.get('id', 'TEL-001')).strip())
                print(f"[POS TÉLÉPHONE] 📞 Prise de commande #{order_id_clean} pour {order.get('customerName', 'Client')} ({len(order.get('items', []))} article(s))", flush=True)

                # Impression automatique directe du ticket thermique (IP: 192.168.1.210)
                print_success = False
                try:
                    import threading
                    import thermal_printer
                    threading.Thread(target=thermal_printer.send_to_thermal_printer, args=(order, "192.168.1.210", 9100), daemon=True).start()
                    print(f"[PRINT] 🖨️ Déclenchement automatique de l'impression commande téléphone #{order_id_clean} vers 192.168.1.210...", flush=True)
                    print_success = True
                except Exception as p_err:
                    print(f"[PRINT] Erreur déclenchement impression: {p_err}", flush=True)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'message': 'Ticket envoyé à l\'imprimante', 'print_success': print_success}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return

        # --- ENDPOINT 1 : ENREGISTREMENT POSTGRESQL & ENVOI EMAIL COMMANDE ---
        if self.path in ('/api/send-order-email', '/api/orders'):
            client_ip = self.get_client_ip()
            if is_public_rate_limited(client_ip, max_requests=15, window_sec=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Trop de requêtes. Veuillez patienter une minute avant de réessayer.'}).encode('utf-8'))
                return

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
            client_ip = self.get_client_ip()
            if is_public_rate_limited(client_ip, max_requests=15, window_sec=60):
                self.send_response(429)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Trop de requêtes. Veuillez patienter une minute avant de réessayer.'}).encode('utf-8'))
                return

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

                # Impression automatique directe du ticket thermique de réservation (IP: 192.168.1.210)
                try:
                    import threading
                    import thermal_printer
                    threading.Thread(target=thermal_printer.send_reservation_to_thermal_printer, args=(res_data, "192.168.1.210", 9100), daemon=True).start()
                    print(f"[PRINT] 🖨️ Déclenchement automatique de l'impression pour la réservation #{res_id_clean} vers 192.168.1.210...", flush=True)
                except Exception as p_err:
                    print(f"[PRINT] Erreur déclenchement impression réservation: {p_err}", flush=True)

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
