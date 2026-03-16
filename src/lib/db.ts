import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "fantasy-supercross.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS riders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number INTEGER,
      team TEXT,
      class TEXT DEFAULT '450',
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      round_number INTEGER,
      date TEXT,
      location TEXT,
      status TEXT DEFAULT 'upcoming',
      race_time TEXT,
      event_id TEXT
    );

    CREATE TABLE IF NOT EXISTS race_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      rider_id INTEGER NOT NULL,
      position INTEGER,
      points INTEGER DEFAULT 0,
      FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
      UNIQUE(race_id, rider_id)
    );

    CREATE TABLE IF NOT EXISTS user_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      rider_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
      UNIQUE(user_id, rider_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      commissioner_id INTEGER NOT NULL,
      max_members INTEGER NOT NULL DEFAULT 4,
      roster_size INTEGER NOT NULL DEFAULT 8,
      lineup_450 INTEGER NOT NULL DEFAULT 3,
      lineup_250e INTEGER NOT NULL DEFAULT 2,
      lineup_250w INTEGER NOT NULL DEFAULT 2,
      draft_status TEXT NOT NULL DEFAULT 'waiting',
      draft_order TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (commissioner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS draft_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      pick_number INTEGER NOT NULL,
      round INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rider_id INTEGER NOT NULL,
      picked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
      UNIQUE(league_id, pick_number)
    );

    CREATE TABLE IF NOT EXISTS league_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      team_name TEXT,
      team_logo TEXT,
      joined_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(league_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS league_rosters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rider_id INTEGER NOT NULL,
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
      UNIQUE(league_id, user_id, rider_id)
    );

    CREATE TABLE IF NOT EXISTS weekly_lineups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      race_id INTEGER NOT NULL,
      rider_id INTEGER NOT NULL,
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
      UNIQUE(league_id, user_id, race_id, rider_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      added_rider_id INTEGER,
      dropped_rider_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (added_rider_id) REFERENCES riders(id) ON DELETE SET NULL,
      FOREIGN KEY (dropped_rider_id) REFERENCES riders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS race_bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      rider_id INTEGER NOT NULL,
      bonus_type TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE,
      FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
      UNIQUE(race_id, rider_id, bonus_type)
    );
  `);

  // Migrations for existing databases
  const columns = db.prepare("PRAGMA table_info(races)").all() as { name: string }[];
  const colNames = new Set(columns.map((c) => c.name));
  if (!colNames.has("race_time")) {
    db.exec("ALTER TABLE races ADD COLUMN race_time TEXT");
  }
  if (!colNames.has("event_id")) {
    db.exec("ALTER TABLE races ADD COLUMN event_id TEXT");
  }

  const leagueCols = db.prepare("PRAGMA table_info(leagues)").all() as { name: string }[];
  const leagueColNames = new Set(leagueCols.map((c) => c.name));
  if (!leagueColNames.has("draft_pick_timer")) {
    db.exec("ALTER TABLE leagues ADD COLUMN draft_pick_timer INTEGER DEFAULT 60");
  }
  if (!leagueColNames.has("last_pick_at")) {
    db.exec("ALTER TABLE leagues ADD COLUMN last_pick_at TEXT");
  }
  if (!leagueColNames.has("draft_auto_users")) {
    db.exec("ALTER TABLE leagues ADD COLUMN draft_auto_users TEXT DEFAULT '[]'");
  }
}

export default getDb;
