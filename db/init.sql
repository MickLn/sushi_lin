-- ==========================================================
-- SCHÉMA DE BASE DE DONNÉES SUSHI LIN (POSTGRESQL)
-- ==========================================================

-- Table des utilisateurs / clients
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

-- Index pour les utilisateurs
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Table des commandes à emporter
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
    status VARCHAR(50) DEFAULT 'new' -- 'new', 'preparing', 'ready', 'completed', 'cancelled'
);

-- Index sur le statut et la date de commande
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Table des réservations de tables
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
    status VARCHAR(50) DEFAULT 'confirmed' -- 'confirmed', 'cancelled', 'completed'
);

-- Index sur la date de réservation et le statut
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at DESC);
