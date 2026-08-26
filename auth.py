import os
import json
import time
import secrets
import hashlib
import hmac

AUTH_FILE = os.path.join(os.path.dirname(__file__), 'data', '.admin_auth.json')
SESSION_DURATION_SEC = 12 * 3600  # 12 heures
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SEC = 10 * 60  # 10 minutes

# Sessions actives en mémoire : {token: {'created_at': float, 'expires_at': float, 'ip': str}}
_ACTIVE_SESSIONS = {}

# Tentatives de connexion par IP : {ip: [timestamp1, timestamp2, ...]}
_FAILED_ATTEMPTS = {}

def _hash_pin(pin_str, salt_bytes=None):
    if salt_bytes is None:
        salt_bytes = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac('sha256', pin_str.encode('utf-8'), salt_bytes, 100_000)
    return key.hex(), salt_bytes.hex()

def _load_auth_data():
    if os.path.exists(AUTH_FILE):
        try:
            with open(AUTH_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'pin_hash' in data and 'salt' in data:
                    return data
        except Exception as e:
            print(f"[AUTH] Erreur lecture fichier auth: {e}", flush=True)

    # Initialisation sécurisée par défaut
    default_pin = os.environ.get('ADMIN_PIN') or '1234'
    pin_hash, salt_hex = _hash_pin(default_pin)
    auth_data = {
        'pin_hash': pin_hash,
        'salt': salt_hex,
        'updated_at': time.time()
    }
    _save_auth_data(auth_data)
    return auth_data

def _save_auth_data(data):
    try:
        os.makedirs(os.path.dirname(AUTH_FILE), exist_ok=True)
        with open(AUTH_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        try:
            os.chmod(AUTH_FILE, 0o600)
        except Exception:
            pass
    except Exception as e:
        print(f"[AUTH] Erreur sauvegarde auth: {e}", flush=True)

def is_ip_rate_limited(ip):
    now = time.time()
    attempts = _FAILED_ATTEMPTS.get(ip, [])
    recent = [t for t in attempts if now - t < LOCKOUT_WINDOW_SEC]
    _FAILED_ATTEMPTS[ip] = recent
    return len(recent) >= MAX_FAILED_ATTEMPTS

def record_failed_login(ip):
    now = time.time()
    if ip not in _FAILED_ATTEMPTS:
        _FAILED_ATTEMPTS[ip] = []
    _FAILED_ATTEMPTS[ip].append(now)

def reset_failed_login(ip):
    if ip in _FAILED_ATTEMPTS:
        del _FAILED_ATTEMPTS[ip]

def verify_pin(entered_pin, ip="127.0.0.1"):
    if is_ip_rate_limited(ip):
        return False, "Trop de tentatives erronées. Accès bloqué pendant 10 minutes."

    if not entered_pin or not isinstance(entered_pin, str):
        record_failed_login(ip)
        return False, "Code PIN invalide."

    auth_data = _load_auth_data()
    salt_bytes = bytes.fromhex(auth_data['salt'])
    computed_hash, _ = _hash_pin(entered_pin.strip(), salt_bytes)

    if hmac.compare_digest(computed_hash, auth_data['pin_hash']):
        reset_failed_login(ip)
        return True, "Authentification réussie."
    else:
        record_failed_login(ip)
        attempts_left = max(0, MAX_FAILED_ATTEMPTS - len(_FAILED_ATTEMPTS.get(ip, [])))
        if attempts_left == 0:
            return False, "Code PIN incorrect. Accès bloqué pendant 10 minutes."
        return False, f"Code PIN incorrect. {attempts_left} essai(s) restant(s)."

def change_pin(current_pin, new_pin, ip="127.0.0.1"):
    ok, msg = verify_pin(current_pin, ip)
    if not ok:
        return False, f"Ancien code PIN incorrect : {msg}"

    if not new_pin or not str(new_pin).isdigit() or len(str(new_pin)) < 4 or len(str(new_pin)) > 8:
        return False, "Le nouveau code PIN doit comporter entre 4 et 8 chiffres."

    pin_hash, salt_hex = _hash_pin(str(new_pin).strip())
    auth_data = {
        'pin_hash': pin_hash,
        'salt': salt_hex,
        'updated_at': time.time()
    }
    _save_auth_data(auth_data)
    return True, "Code PIN modifié avec succès."

def create_session(ip="127.0.0.1"):
    token = secrets.token_hex(32)
    now = time.time()
    _ACTIVE_SESSIONS[token] = {
        'created_at': now,
        'expires_at': now + SESSION_DURATION_SEC,
        'ip': ip
    }
    _clean_expired_sessions()
    return token

def verify_session(token):
    if not token or not isinstance(token, str):
        return False
    session = _ACTIVE_SESSIONS.get(token)
    if not session:
        return False
    now = time.time()
    if now > session['expires_at']:
        del _ACTIVE_SESSIONS[token]
        return False
    session['expires_at'] = now + SESSION_DURATION_SEC
    return True

def revoke_session(token):
    if token in _ACTIVE_SESSIONS:
        del _ACTIVE_SESSIONS[token]
        return True
    return False

def _clean_expired_sessions():
    now = time.time()
    expired = [t for t, s in _ACTIVE_SESSIONS.items() if now > s['expires_at']]
    for t in expired:
        del _ACTIVE_SESSIONS[t]
