-- Fantasy Supercross Schema for Supabase (PostgreSQL)
-- Run this entire file in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE riders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER,
  team TEXT,
  class TEXT DEFAULT '450',
  image_url TEXT
);

CREATE TABLE races (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  round_number INTEGER,
  date TEXT,
  location TEXT,
  status TEXT DEFAULT 'upcoming',
  race_time TEXT,
  event_id TEXT
);

CREATE TABLE race_results (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  position INTEGER,
  points INTEGER DEFAULT 0,
  UNIQUE(race_id, rider_id)
);

CREATE TABLE user_teams (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  UNIQUE(user_id, rider_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE leagues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  commissioner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 4,
  roster_size INTEGER NOT NULL DEFAULT 8,
  lineup_450 INTEGER NOT NULL DEFAULT 3,
  lineup_250e INTEGER NOT NULL DEFAULT 2,
  lineup_250w INTEGER NOT NULL DEFAULT 2,
  draft_status TEXT NOT NULL DEFAULT 'waiting',
  draft_order JSONB,
  draft_pick_timer INTEGER DEFAULT 60,
  last_pick_at TIMESTAMPTZ,
  draft_auto_users JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE draft_picks (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  round INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  picked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, pick_number)
);

CREATE TABLE league_members (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name TEXT,
  team_logo TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE TABLE league_rosters (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  UNIQUE(league_id, user_id, rider_id)
);

CREATE TABLE weekly_lineups (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  UNIQUE(league_id, user_id, race_id, rider_id)
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  added_rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
  dropped_rider_id INTEGER REFERENCES riders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE race_bonuses (
  id SERIAL PRIMARY KEY,
  race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  rider_id INTEGER NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  bonus_type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  UNIQUE(race_id, rider_id, bonus_type)
);
