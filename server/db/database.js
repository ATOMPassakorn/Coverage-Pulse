import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'coverage_pulse.db');

export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      occupation TEXT,
      family_status TEXT,
      income_bracket TEXT,
      phone TEXT,
      email TEXT,
      segment TEXT DEFAULT 'Premier Wealth',
      battery_score INTEGER DEFAULT 50,
      battery_status TEXT DEFAULT 'review',
      battery_reasons TEXT,
      ai_nba TEXT,
      ai_script TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migrate existing table if columns don't exist
  try {
    const cols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
    if (!cols.includes('ai_nba')) {
      db.exec('ALTER TABLE customers ADD COLUMN ai_nba TEXT;');
    }
    if (!cols.includes('ai_script')) {
      db.exec('ALTER TABLE customers ADD COLUMN ai_script TEXT;');
    }
    if (!cols.includes('welfare')) {
      db.exec('ALTER TABLE customers ADD COLUMN welfare TEXT;');
    }
    if (!cols.includes('debt_burden')) {
      db.exec('ALTER TABLE customers ADD COLUMN debt_burden TEXT;');
    }
    if (!cols.includes('primary_concern')) {
      db.exec('ALTER TABLE customers ADD COLUMN primary_concern TEXT;');
    }
    if (!cols.includes('occupation_detail')) {
      db.exec('ALTER TABLE customers ADD COLUMN occupation_detail TEXT;');
    }
  } catch (e) {
    console.warn('Migration note:', e.message);
  }

  db.exec(`

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      coverage_amount TEXT,
      annual_premium TEXT,
      start_date TEXT,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS life_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      signal_urgency TEXT DEFAULT 'medium',
      detected_at TEXT DEFAULT (datetime('now', 'localtime')),
      verified_by_broker INTEGER DEFAULT 0,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS consent_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      consent_type TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      double_opt_in INTEGER DEFAULT 1,
      granted_at TEXT DEFAULT (datetime('now', 'localtime')),
      ip_channel TEXT DEFAULT 'Krungsri Mobile (KMA)',
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS warm_leads (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      intent_details TEXT,
      simulated_battery INTEGER,
      preferred_date TEXT,
      preferred_time TEXT,
      notes TEXT,
      status TEXT DEFAULT 'submitted',
      assigned_broker_name TEXT DEFAULT 'กิตติพงษ์ สิทธิเวช',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      tier1_profile TEXT,
      tier2_answers TEXT,
      calculated_battery INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS broker_notes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      broker_name TEXT DEFAULT 'กิตติพงษ์ สิทธิเวช',
      call_outcome TEXT,
      notes TEXT,
      confirmed_events TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);
}

export default db;
