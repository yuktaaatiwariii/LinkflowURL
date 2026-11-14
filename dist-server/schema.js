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

-- Developer API keys (Phase 2). Only an HMAC-SHA256 digest of the secret is
-- stored; key_prefix is a non-secret lookup identifier. Revoked rows are
-- retained as an audit trail and reference the key they were rotated from.
CREATE TABLE IF NOT EXISTS developer_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(32) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  environment VARCHAR(10) NOT NULL CHECK (environment IN ('test', 'live')),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  rotated_from_id UUID REFERENCES developer_api_keys(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_api_keys_prefix
  ON developer_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_user
  ON developer_api_keys(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_status
  ON developer_api_keys(user_id, status);

-- Developer projects (Phase 3). A project groups API keys for one application.
-- Names are unique per developer (case-insensitive) so the auto-created project
-- from a Phase 2 projectName value behaves as expected.
CREATE TABLE IF NOT EXISTS developer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_developer_projects_user
  ON developer_projects(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_projects_user_name
  ON developer_projects(user_id, lower(name));

-- Link existing keys to projects without breaking Phase 2 records. The
-- denormalized project_name is intentionally kept as a compatibility mirror.
ALTER TABLE developer_api_keys
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES developer_projects(id) ON DELETE RESTRICT;

-- Backfill: one project per distinct (user, project_name) pair, then attach the
-- existing key rows. Safe to re-run; never deletes or rewrites key credentials.
INSERT INTO developer_projects (user_id, name)
SELECT DISTINCT ON (k.user_id, lower(k.project_name)) k.user_id, k.project_name
FROM developer_api_keys k
WHERE NOT EXISTS (
  SELECT 1 FROM developer_projects p
  WHERE p.user_id = k.user_id AND lower(p.name) = lower(k.project_name)
)
ORDER BY k.user_id, lower(k.project_name), k.created_at;

UPDATE developer_api_keys k
SET project_id = p.id
FROM developer_projects p
WHERE k.project_id IS NULL
  AND p.user_id = k.user_id
  AND lower(p.name) = lower(k.project_name);

CREATE INDEX IF NOT EXISTS idx_developer_api_keys_project
  ON developer_api_keys(project_id, created_at DESC);

-- Persistent per-request analytics (Phase 3). No credential material, headers
-- or bodies are stored: only routing/performance metadata owned by the user.
CREATE TABLE IF NOT EXISTS developer_api_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES developer_api_keys(id) ON DELETE SET NULL,
  project_id UUID REFERENCES developer_projects(id) ON DELETE SET NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  environment VARCHAR(10) NOT NULL CHECK (environment IN ('test', 'live')),
  status_code INTEGER NOT NULL CHECK (status_code BETWEEN 100 AND 599),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_developer_usage_user_created
  ON developer_api_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_usage_project_created
  ON developer_api_usage_events(user_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_usage_endpoint
  ON developer_api_usage_events(user_id, endpoint, created_at DESC);
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
