"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_MIGRATION_SQL = void 0;
exports.runMigrations = runMigrations;
const db_1 = require("./db");
exports.INITIAL_MIGRATION_SQL = `
-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Links Table
CREATE TABLE IF NOT EXISTS links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  short_code VARCHAR(50) UNIQUE NOT NULL,
  custom_alias VARCHAR(50),
  title VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  clicks_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);

-- QR Codes Table
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_id UUID REFERENCES links(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  target_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);

-- Device Push Tokens (Expo push; fans out to FCM on Android / APNs on iOS)
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
  device_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(expo_push_token);

-- Per-User Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  master_enabled BOOLEAN DEFAULT TRUE,
  milestones BOOLEAN DEFAULT TRUE,
  performance BOOLEAN DEFAULT TRUE,
  expiration BOOLEAN DEFAULT TRUE,
  qr_activity BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sent Notification History
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id, created_at DESC);

-- Click Milestone dedupe (one notification per link per milestone, forever)
CREATE TABLE IF NOT EXISTS link_milestones (
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  milestone INTEGER NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (link_id, milestone)
);

-- Performance notification dedupe (once per link per day)
CREATE TABLE IF NOT EXISTS link_performance_notifications (
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (link_id, day)
);

-- Expiration reminder dedupe (once per link per expiry timestamp)
CREATE TABLE IF NOT EXISTS link_expiration_notifications (
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (link_id, expires_at)
);

-- Daily click aggregates (powers performance notifications; one row per link per day)
CREATE TABLE IF NOT EXISTS link_daily_clicks (
  link_id UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  PRIMARY KEY (link_id, day)
);
`;
async function runMigrations() {
    try {
        await (0, db_1.query)(exports.INITIAL_MIGRATION_SQL);
        return { success: true, message: 'Database schema and migrations applied successfully.' };
    }
    catch (error) {
        console.error('[Migrations Error]:', error.message);
        return { success: false, message: error.message };
    }
}
