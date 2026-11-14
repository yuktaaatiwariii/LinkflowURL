"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyMemoryStore = exports.PersistenceUnavailableError = void 0;
exports.insertApiKey = insertApiKey;
exports.listApiKeysForUser = listApiKeysForUser;
exports.findApiKeyForUser = findApiKeyForUser;
exports.findApiKeyByPrefix = findApiKeyByPrefix;
exports.revokeApiKey = revokeApiKey;
exports.rotateApiKey = rotateApiKey;
exports.touchApiKeyLastUsed = touchApiKeyLastUsed;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../../db");
const persistence_1 = require("../persistence");
var persistence_2 = require("../persistence");
Object.defineProperty(exports, "PersistenceUnavailableError", { enumerable: true, get: function () { return persistence_2.PersistenceUnavailableError; } });
const KEY_COLUMNS = `id, user_id, project_id, project_name, key_prefix, key_hash, environment, scopes,
  status, created_at, updated_at, last_used_at, expires_at, revoked_at, rotated_from_id`;
function normalize(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        project_name: row.project_name,
        key_prefix: row.key_prefix,
        key_hash: row.key_hash,
        environment: row.environment,
        scopes: Array.isArray(row.scopes) ? row.scopes : [],
        status: row.status,
        created_at: (0, persistence_1.toIso)(row.created_at),
        updated_at: (0, persistence_1.toIso)(row.updated_at),
        last_used_at: (0, persistence_1.toIso)(row.last_used_at),
        expires_at: (0, persistence_1.toIso)(row.expires_at),
        revoked_at: (0, persistence_1.toIso)(row.revoked_at),
        rotated_from_id: row.rotated_from_id,
    };
}
/**
 * Returns true when the in-memory fallback may be used.
 * Throws in production so a missing database is reported, never faked.
 */
class ApiKeyMemoryStore {
    records = new Map();
    insert(input) {
        const now = new Date().toISOString();
        const record = {
            id: `key_${crypto_1.default.randomBytes(10).toString('hex')}`,
            user_id: input.userId,
            project_id: input.projectId,
            project_name: input.projectName,
            key_prefix: input.keyPrefix,
            key_hash: input.keyHash,
            environment: input.environment,
            scopes: [...input.scopes],
            status: 'active',
            created_at: now,
            updated_at: now,
            last_used_at: null,
            expires_at: input.expiresAt,
            revoked_at: null,
            rotated_from_id: input.rotatedFromId || null,
        };
        this.records.set(record.id, record);
        return { ...record, scopes: [...record.scopes] };
    }
    listForUser(userId) {
        return Array.from(this.records.values())
            .filter((record) => record.user_id === userId)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((record) => ({ ...record, scopes: [...record.scopes] }));
    }
    findForUser(id, userId) {
        const record = this.records.get(id);
        if (!record || record.user_id !== userId)
            return null;
        return { ...record, scopes: [...record.scopes] };
    }
    findByPrefix(prefix) {
        const record = Array.from(this.records.values()).find((entry) => entry.key_prefix === prefix);
        return record ? { ...record, scopes: [...record.scopes] } : null;
    }
    revoke(id, userId) {
        const record = this.records.get(id);
        if (!record || record.user_id !== userId)
            return null;
        const now = new Date().toISOString();
        if (record.status === 'active') {
            record.status = 'revoked';
            record.revoked_at = now;
            record.updated_at = now;
        }
        return { ...record, scopes: [...record.scopes] };
    }
    rotate(id, userId, material) {
        const old = this.records.get(id);
        if (!old || old.user_id !== userId)
            return { ok: false, reason: 'not_found' };
        if (old.status !== 'active')
            return { ok: false, reason: 'revoked' };
        if (old.expires_at && new Date(old.expires_at).getTime() <= Date.now()) {
            return { ok: false, reason: 'expired' };
        }
        const now = new Date().toISOString();
        const revoked = {
            ...old,
            scopes: [...old.scopes],
            status: 'revoked',
            revoked_at: now,
            updated_at: now,
        };
        this.records.set(id, revoked);
        const created = this.insert({
            userId,
            projectId: old.project_id,
            projectName: old.project_name,
            keyPrefix: material.keyPrefix,
            keyHash: material.keyHash,
            environment: old.environment,
            scopes: old.scopes,
            expiresAt: old.expires_at,
            rotatedFromId: old.id,
        });
        return { ok: true, revoked: { ...revoked, scopes: [...revoked.scopes] }, created };
    }
    touch(id) {
        const record = this.records.get(id);
        if (!record)
            return;
        // Mirrors the PostgreSQL touch: usage tracking does not change `updated_at`,
        // which only reflects management changes (create/revoke/rotate).
        record.last_used_at = new Date().toISOString();
    }
}
exports.apiKeyMemoryStore = new ApiKeyMemoryStore();
async function insertApiKey(input) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.apiKeyMemoryStore.insert(input);
    }
    const rows = await (0, db_1.query)(`INSERT INTO developer_api_keys
       (user_id, project_id, project_name, key_prefix, key_hash, environment, scopes, expires_at, rotated_from_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9)
     RETURNING ${KEY_COLUMNS}`, [
        input.userId,
        input.projectId,
        input.projectName,
        input.keyPrefix,
        input.keyHash,
        input.environment,
        input.scopes,
        input.expiresAt,
        input.rotatedFromId || null,
    ]);
    return normalize(rows[0]);
}
async function listApiKeysForUser(userId) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.apiKeyMemoryStore.listForUser(userId);
    }
    const rows = await (0, db_1.query)(`SELECT ${KEY_COLUMNS} FROM developer_api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`, [userId]);
    return rows.map(normalize);
}
async function findApiKeyForUser(id, userId) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.apiKeyMemoryStore.findForUser(id, userId);
    }
    try {
        const rows = await (0, db_1.query)(`SELECT ${KEY_COLUMNS} FROM developer_api_keys
       WHERE id = $1 AND user_id = $2
       LIMIT 1`, [id, userId]);
        return rows.length > 0 ? normalize(rows[0]) : null;
    }
    catch (err) {
        if ((0, persistence_1.isInvalidUuidError)(err))
            return null;
        throw err;
    }
}
/**
 * Authentication lookup by non-secret prefix. The returned row includes the
 * stored hash so the guard can perform constant-time verification.
 */
async function findApiKeyByPrefix(prefix) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.apiKeyMemoryStore.findByPrefix(prefix);
    }
    const rows = await (0, db_1.query)(`SELECT ${KEY_COLUMNS} FROM developer_api_keys
     WHERE key_prefix = $1
     LIMIT 1`, [prefix]);
    return rows.length > 0 ? normalize(rows[0]) : null;
}
async function revokeApiKey(id, userId) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.apiKeyMemoryStore.revoke(id, userId);
    }
    try {
        const rows = await (0, db_1.query)(`UPDATE developer_api_keys
       SET status = 'revoked',
           revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING ${KEY_COLUMNS}`, [id, userId]);
        return rows.length > 0 ? normalize(rows[0]) : null;
    }
    catch (err) {
        if ((0, persistence_1.isInvalidUuidError)(err))
            return null;
        throw err;
    }
}
/**
 * Atomically revokes the old key and inserts its replacement.
 *
 * The old row is locked FOR UPDATE so two concurrent rotation requests cannot
 * both succeed. The revoked row is retained as the audit trail and the new row
 * points back to it through `rotated_from_id`.
 */
async function rotateApiKey(id, userId, material) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.apiKeyMemoryStore.rotate(id, userId, material);
    }
    const pool = (0, db_1.getDatabasePool)();
    if (!pool)
        throw new persistence_1.PersistenceUnavailableError();
    const client = await pool.connect();
    try {
        let existing = null;
        try {
            await client.query('BEGIN');
            existing = await client.query(`SELECT ${KEY_COLUMNS} FROM developer_api_keys
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`, [id, userId]);
        }
        catch (err) {
            if (!(0, persistence_1.isInvalidUuidError)(err))
                throw err;
            try {
                await client.query('ROLLBACK');
            }
            catch {
                // The malformed id failed before any state changed.
            }
            return { ok: false, reason: 'not_found' };
        }
        if (!existing || existing.rowCount === 0) {
            await client.query('ROLLBACK');
            return { ok: false, reason: 'not_found' };
        }
        const old = normalize(existing.rows[0]);
        if (old.status !== 'active') {
            await client.query('ROLLBACK');
            return { ok: false, reason: 'revoked' };
        }
        if (old.expires_at && new Date(old.expires_at).getTime() <= Date.now()) {
            await client.query('ROLLBACK');
            return { ok: false, reason: 'expired' };
        }
        const revokedRows = await client.query(`UPDATE developer_api_keys
       SET status = 'revoked',
           revoked_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING ${KEY_COLUMNS}`, [id, userId]);
        const createdRows = await client.query(`INSERT INTO developer_api_keys
         (user_id, project_id, project_name, key_prefix, key_hash, environment, scopes, expires_at, rotated_from_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, $9)
       RETURNING ${KEY_COLUMNS}`, [
            userId,
            old.project_id,
            old.project_name,
            material.keyPrefix,
            material.keyHash,
            old.environment,
            old.scopes,
            old.expires_at,
            old.id,
        ]);
        await client.query('COMMIT');
        return {
            ok: true,
            revoked: normalize(revokedRows.rows[0]),
            created: normalize(createdRows.rows[0]),
        };
    }
    catch (err) {
        try {
            await client.query('ROLLBACK');
        }
        catch {
            // Ignore rollback failures; the original error is more useful.
        }
        throw err;
    }
    finally {
        client.release();
    }
}
const LAST_TOUCH = new Map();
const TOUCH_INTERVAL_MS = 60_000;
/**
 * Updates `last_used_at` at most once per minute per key per process.
 * Fire-and-forget: a metadata write must never fail an API request.
 */
function touchApiKeyLastUsed(id) {
    const now = Date.now();
    if (now - (LAST_TOUCH.get(id) || 0) < TOUCH_INTERVAL_MS)
        return;
    LAST_TOUCH.set(id, now);
    if ((0, db_1.getDatabasePool)()) {
        void (0, db_1.query)(`UPDATE developer_api_keys
       SET last_used_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND (last_used_at IS NULL OR last_used_at < CURRENT_TIMESTAMP - INTERVAL '60 seconds')`, [id]).catch((err) => {
            console.warn('[PostgreSQL touchApiKeyLastUsed]:', err.message);
        });
        return;
    }
    if (process.env.NODE_ENV !== 'production') {
        exports.apiKeyMemoryStore.touch(id);
    }
}
