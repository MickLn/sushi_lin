import os
import json
import time

DB_HOST = os.environ.get('POSTGRES_HOST') or os.environ.get('DB_HOST') or 'db'
DB_PORT = int(os.environ.get('POSTGRES_PORT') or os.environ.get('DB_PORT') or 5432)
DB_NAME = os.environ.get('POSTGRES_DB') or 'sushilin_db'
DB_USER = os.environ.get('POSTGRES_USER') or 'sushilin_user'
DB_PASSWORD = os.environ.get('POSTGRES_PASSWORD') or 'sushilin_secret_password'

def get_connection():
    try:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=3
        )
        return conn
    except Exception:
        return None

def init_db():
    conn = get_connection()
    if not conn:
        print("[DB] PostgreSQL non accessible au démarrage (mode local ou hors Docker).", flush=True)
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(50) PRIMARY KEY,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    first_name VARCHAR(100) NOT NULL DEFAULT '',
                    last_name VARCHAR(100) NOT NULL DEFAULT '',
                    email VARCHAR(255) UNIQUE NOT NULL,
                    phone VARCHAR(50) DEFAULT '',
                    address TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    orders_count INTEGER DEFAULT 0,
                    total_spent NUMERIC(10, 2) DEFAULT 0.00
                );

                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
                CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

                CREATE TABLE IF NOT EXISTS orders (
                    id VARCHAR(50) PRIMARY KEY,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    date_formatted VARCHAR(50),
                    customer_email VARCHAR(255),
                    items JSONB NOT NULL,
                    item_count INTEGER NOT NULL DEFAULT 1,
                    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
                    sauce_choice VARCHAR(100) DEFAULT 'Sauce sucrée',
                    baguettes_choice VARCHAR(100) DEFAULT '1 paire',
                    pickup_time VARCHAR(50) DEFAULT 'Dès que possible',
                    comment TEXT DEFAULT '',
                    status VARCHAR(50) DEFAULT 'new'
                );

                CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
                CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

                CREATE TABLE IF NOT EXISTS reservations (
                    id VARCHAR(50) PRIMARY KEY,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    customer_name VARCHAR(255) NOT NULL,
                    customer_phone VARCHAR(50) NOT NULL,
                    customer_email VARCHAR(255) DEFAULT '',
                    reservation_date VARCHAR(50) NOT NULL,
                    service_time VARCHAR(50) NOT NULL,
                    guests_count INTEGER NOT NULL DEFAULT 2,
                    notes TEXT DEFAULT '',
                    status VARCHAR(50) DEFAULT 'confirmed'
                );

                CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
                CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
                CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at DESC);
            """)
            conn.commit()
            print("[DB] Connecté avec succès à PostgreSQL — Tables (users, orders, reservations) vérifiées.", flush=True)
            return True
    except Exception as e:
        print(f"[DB] Erreur initialisation tables PostgreSQL: {e}", flush=True)
        return False
    finally:
        conn.close()

# --- UTILISATEURS / CLIENTS (USERS) ---

def save_user(user_data):
    conn = get_connection()
    if not conn:
        return False
    try:
        email = (user_data.get('email') or '').strip().lower()
        if not email:
            return False
        user_id = user_data.get('id') or f"USR-{int(time.time()*1000)}"
        first_name = user_data.get('firstName') or user_data.get('first_name') or user_data.get('name', '').split(' ')[0] or ''
        last_name = user_data.get('lastName') or user_data.get('last_name') or (' '.join(user_data.get('name', '').split(' ')[1:]) if ' ' in user_data.get('name', '') else '')
        phone = user_data.get('phone') or user_data.get('contact') or ''
        address = user_data.get('address') or ''
        notes = user_data.get('notes') or ''

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (
                    id, first_name, last_name, email, phone, address, notes, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (email) DO UPDATE SET
                    first_name = CASE WHEN EXCLUDED.first_name <> '' THEN EXCLUDED.first_name ELSE users.first_name END,
                    last_name = CASE WHEN EXCLUDED.last_name <> '' THEN EXCLUDED.last_name ELSE users.last_name END,
                    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE users.phone END,
                    address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE users.address END,
                    notes = CASE WHEN EXCLUDED.notes <> '' THEN EXCLUDED.notes ELSE users.notes END,
                    updated_at = NOW();
            """, (user_id, first_name, last_name, email, phone, address, notes))
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB] Erreur enregistrement utilisateur: {e}", flush=True)
        return False
    finally:
        conn.close()

def serialize_row(row):
    import datetime
    from decimal import Decimal
    result = {}
    for k, v in row.items():
        if isinstance(v, (datetime.datetime, datetime.date)):
            result[k] = v.isoformat()
        elif isinstance(v, Decimal):
            result[k] = float(v)
        else:
            result[k] = v
    return result

def get_users(limit=200):
    conn = get_connection()
    if not conn:
        return []
    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    created_at,
                    updated_at,
                    first_name AS "firstName",
                    last_name AS "lastName",
                    email,
                    phone,
                    address,
                    notes,
                    orders_count AS "ordersCount",
                    total_spent::float AS "totalSpent"
                FROM users
                ORDER BY created_at DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            return [serialize_row(r) for r in rows]
    except Exception as e:
        print(f"[DB] Erreur lecture utilisateurs: {e}", flush=True)
        return []
    finally:
        conn.close()

# --- COMMANDES (ORDERS) ---

def save_order(order_data):
    conn = get_connection()
    if not conn:
        return False
    try:
        customer_email = (order_data.get('customerEmail') or order_data.get('email') or '').strip().lower()
        total_amount = float(order_data.get('total', 0))

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO orders (
                    id, date_formatted, customer_email, items, item_count,
                    subtotal, discount, total, sauce_choice, baguettes_choice,
                    pickup_time, comment, status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    items = EXCLUDED.items,
                    total = EXCLUDED.total;
            """, (
                order_data.get('id'),
                order_data.get('dateFormatted') or order_data.get('date', ''),
                customer_email,
                json.dumps(order_data.get('items', [])),
                int(order_data.get('itemCount') or len(order_data.get('items', [])) or 1),
                float(order_data.get('subtotal', 0)),
                float(order_data.get('discount', 0)),
                total_amount,
                order_data.get('sauceChoice', 'Sauce sucrée'),
                order_data.get('baguettesChoice', '1 paire'),
                order_data.get('pickupTime', 'Dès que possible'),
                order_data.get('comment', ''),
                order_data.get('status', 'new')
            ))

            # Si un e-mail est associé, mettre à jour les statistiques de l'utilisateur
            if customer_email:
                user_id = f"USR-{int(time.time()*1000)}"
                cur.execute("""
                    INSERT INTO users (id, email, orders_count, total_spent, updated_at)
                    VALUES (%s, %s, 1, %s, NOW())
                    ON CONFLICT (email) DO UPDATE SET
                        orders_count = COALESCE(users.orders_count, 0) + 1,
                        total_spent = COALESCE(users.total_spent, 0) + %s,
                        updated_at = NOW();
                """, (user_id, customer_email, total_amount, total_amount))

            conn.commit()
            print(f"[DB] Commande #{order_data.get('id')} enregistrée dans PostgreSQL.", flush=True)
            return True
    except Exception as e:
        print(f"[DB] Erreur enregistrement commande: {e}", flush=True)
        return False
    finally:
        conn.close()

def get_orders(limit=200):
    conn = get_connection()
    if not conn:
        return []
    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id, 
                    created_at,
                    date_formatted AS "dateFormatted",
                    customer_email AS "customerEmail",
                    items,
                    item_count AS "itemCount",
                    subtotal::float,
                    discount::float,
                    total::float,
                    sauce_choice AS "sauceChoice",
                    baguettes_choice AS "baguettesChoice",
                    pickup_time AS "pickupTime",
                    comment,
                    status
                FROM orders
                ORDER BY created_at DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            for r in rows:
                if not isinstance(r.get('created_at'), (str, type(None))):
                    r['timestamp'] = r['created_at'].isoformat()
                    r['created_at'] = r['created_at'].isoformat()
            return rows
    except Exception as e:
        print(f"[DB] Erreur lecture commandes: {e}", flush=True)
        return []
    finally:
        conn.close()

def update_order_status(order_id, status):
    conn = get_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE orders SET status = %s WHERE id = %s;", (status, order_id))
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB] Erreur mise à jour statut commande {order_id}: {e}", flush=True)
        return False
    finally:
        conn.close()

# --- RÉSERVATIONS (RESERVATIONS) ---

def save_reservation(res_data):
    conn = get_connection()
    if not conn:
        return False
    try:
        customer_email = (res_data.get('email') or res_data.get('customer_email') or '').strip().lower()
        customer_name = (res_data.get('name') or res_data.get('customer_name') or '').strip()
        customer_phone = (res_data.get('phone') or res_data.get('customer_phone') or '').strip()

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO reservations (
                    id, customer_name, customer_phone, customer_email,
                    reservation_date, service_time, guests_count, notes, status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status;
            """, (
                res_data.get('id'),
                customer_name,
                customer_phone,
                customer_email,
                res_data.get('date') or res_data.get('reservation_date', ''),
                res_data.get('service') or res_data.get('service_time', ''),
                int(res_data.get('guests') or res_data.get('guests_count') or 2),
                res_data.get('notes', ''),
                res_data.get('status', 'confirmed')
            ))

            # Enregistrer ou mettre à jour le profil client
            if customer_email:
                user_id = f"USR-{int(time.time()*1000)}"
                first_name = customer_name.split(' ')[0] if customer_name else ''
                last_name = ' '.join(customer_name.split(' ')[1:]) if ' ' in customer_name else ''
                cur.execute("""
                    INSERT INTO users (id, first_name, last_name, email, phone, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (email) DO UPDATE SET
                        first_name = CASE WHEN users.first_name = '' THEN EXCLUDED.first_name ELSE users.first_name END,
                        last_name = CASE WHEN users.last_name = '' THEN EXCLUDED.last_name ELSE users.last_name END,
                        phone = CASE WHEN users.phone = '' THEN EXCLUDED.phone ELSE users.phone END,
                        updated_at = NOW();
                """, (user_id, first_name, last_name, customer_email, customer_phone))

            conn.commit()
            print(f"[DB] Réservation #{res_data.get('id')} enregistrée dans PostgreSQL.", flush=True)
            return True
    except Exception as e:
        print(f"[DB] Erreur enregistrement réservation: {e}", flush=True)
        return False
    finally:
        conn.close()

def get_reservations(limit=200):
    conn = get_connection()
    if not conn:
        return []
    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    created_at,
                    customer_name AS "name",
                    customer_phone AS "phone",
                    customer_email AS "email",
                    reservation_date AS "date",
                    service_time AS "service",
                    guests_count AS "guests",
                    notes,
                    status
                FROM reservations
                ORDER BY created_at DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            for r in rows:
                if not isinstance(r.get('created_at'), (str, type(None))):
                    r['timestamp'] = r['created_at'].isoformat()
                    r['created_at'] = r['created_at'].isoformat()
            return rows
    except Exception as e:
        print(f"[DB] Erreur lecture réservations: {e}", flush=True)
        return []
    finally:
        conn.close()

def update_reservation_status(res_id, status):
    conn = get_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE reservations SET status = %s WHERE id = %s;", (status, res_id))
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB] Erreur mise à jour statut réservation {res_id}: {e}", flush=True)
        return False
    finally:
        conn.close()

def delete_order(order_id):
    conn = get_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            if order_id == '__ALL__':
                cur.execute("TRUNCATE TABLE orders;")
                print("[DB] Toutes les commandes ont été effacées de PostgreSQL.", flush=True)
            else:
                cur.execute("DELETE FROM orders WHERE id = %s;", (order_id,))
                print(f"[DB] Commande #{order_id} supprimée de PostgreSQL.", flush=True)
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB] Erreur suppression commande {order_id}: {e}", flush=True)
        return False
    finally:
        conn.close()

def delete_reservation(res_id):
    conn = get_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            if res_id == '__ALL__':
                cur.execute("TRUNCATE TABLE reservations;")
                print("[DB] Toutes les réservations ont été effacées de PostgreSQL.", flush=True)
            else:
                cur.execute("DELETE FROM reservations WHERE id = %s;", (res_id,))
                print(f"[DB] Réservation #{res_id} supprimée de PostgreSQL.", flush=True)
            conn.commit()
            return True
    except Exception as e:
        print(f"[DB] Erreur suppression réservation {res_id}: {e}", flush=True)
        return False
    finally:
        conn.close()

