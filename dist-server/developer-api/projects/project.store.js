"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectMemoryStore = void 0;
exports.insertProject = insertProject;
exports.listProjectsForUser = listProjectsForUser;
exports.findProjectForUser = findProjectForUser;
exports.findProjectByName = findProjectByName;
exports.renameProject = renameProject;
exports.deleteProject = deleteProject;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../../db");
const persistence_1 = require("../persistence");
const PROJECT_COLUMNS = `id, user_id, name, created_at, updated_at`;
function normalize(row) {
    return {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        created_at: (0, persistence_1.toIso)(row.created_at),
        updated_at: (0, persistence_1.toIso)(row.updated_at),
    };
}
class ProjectMemoryStore {
    records = new Map();
    insert(userId, name) {
        const existing = this.findByName(userId, name);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        const record = {
            id: `prj_${crypto_1.default.randomBytes(10).toString('hex')}`,
            user_id: userId,
            name,
            created_at: now,
            updated_at: now,
        };
        this.records.set(record.id, record);
        return { ...record };
    }
    listForUser(userId) {
        return Array.from(this.records.values())
            .filter((record) => record.user_id === userId)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((record) => ({ ...record }));
    }
    findForUser(id, userId) {
        const record = this.records.get(id);
        if (!record || record.user_id !== userId)
            return null;
        return { ...record };
    }
    findByName(userId, name) {
        const normalized = name.trim().toLowerCase();
        const record = Array.from(this.records.values()).find((entry) => entry.user_id === userId && entry.name.trim().toLowerCase() === normalized);
        return record ? { ...record } : null;
    }
    rename(id, userId, name) {
        const record = this.records.get(id);
        if (!record || record.user_id !== userId)
            return { ok: false, reason: 'not_found' };
        const duplicate = Array.from(this.records.values()).find((entry) => entry.id !== id &&
            entry.user_id === userId &&
            entry.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (duplicate)
            return { ok: false, reason: 'duplicate' };
        record.name = name;
        record.updated_at = new Date().toISOString();
        return { ok: true, project: { ...record } };
    }
    remove(id, userId) {
        const record = this.records.get(id);
        if (!record || record.user_id !== userId)
            return false;
        return this.records.delete(id);
    }
    clearForTests() {
        this.records.clear();
    }
}
exports.projectMemoryStore = new ProjectMemoryStore();
/** Creates a project, returning the existing one when the name already exists. */
async function insertProject(userId, name) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.projectMemoryStore.insert(userId, name);
    }
    const existing = await (0, db_1.query)(`SELECT ${PROJECT_COLUMNS} FROM developer_projects
     WHERE user_id = $1 AND lower(name) = lower($2)
     LIMIT 1`, [userId, name]);
    if (existing.length > 0)
        return normalize(existing[0]);
    try {
        const rows = await (0, db_1.query)(`INSERT INTO developer_projects (user_id, name)
       VALUES ($1, $2)
       RETURNING ${PROJECT_COLUMNS}`, [userId, name]);
        return normalize(rows[0]);
    }
    catch (err) {
        // Concurrent creation of the same project: return the winning row.
        if (err?.code === '23505') {
            const raced = await (0, db_1.query)(`SELECT ${PROJECT_COLUMNS} FROM developer_projects
         WHERE user_id = $1 AND lower(name) = lower($2)
         LIMIT 1`, [userId, name]);
            if (raced.length > 0)
                return normalize(raced[0]);
        }
        throw err;
    }
}
async function listProjectsForUser(userId) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.projectMemoryStore.listForUser(userId);
    }
    const rows = await (0, db_1.query)(`SELECT ${PROJECT_COLUMNS} FROM developer_projects
     WHERE user_id = $1
     ORDER BY created_at DESC`, [userId]);
    return rows.map(normalize);
}
async function findProjectForUser(id, userId) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.projectMemoryStore.findForUser(id, userId);
    }
    try {
        const rows = await (0, db_1.query)(`SELECT ${PROJECT_COLUMNS} FROM developer_projects
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
async function findProjectByName(userId, name) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.projectMemoryStore.findByName(userId, name);
    }
    const rows = await (0, db_1.query)(`SELECT ${PROJECT_COLUMNS} FROM developer_projects
     WHERE user_id = $1 AND lower(name) = lower($2)
     LIMIT 1`, [userId, name]);
    return rows.length > 0 ? normalize(rows[0]) : null;
}
async function renameProject(id, userId, name) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.projectMemoryStore.rename(id, userId, name);
    }
    try {
        const rows = await (0, db_1.query)(`UPDATE developer_projects
       SET name = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING ${PROJECT_COLUMNS}`, [id, userId, name]);
        if (rows.length === 0)
            return { ok: false, reason: 'not_found' };
        return { ok: true, project: normalize(rows[0]) };
    }
    catch (err) {
        if (err?.code === '23505')
            return { ok: false, reason: 'duplicate' };
        if ((0, persistence_1.isInvalidUuidError)(err))
            return { ok: false, reason: 'not_found' };
        throw err;
    }
}
async function deleteProject(id, userId) {
    if ((0, persistence_1.useMemoryStore)()) {
        return exports.projectMemoryStore.remove(id, userId);
    }
    try {
        const rows = await (0, db_1.query)(`DELETE FROM developer_projects
       WHERE id = $1 AND user_id = $2
       RETURNING id`, [id, userId]);
        return rows.length > 0;
    }
    catch (err) {
        if ((0, persistence_1.isInvalidUuidError)(err))
            return false;
        throw err;
    }
}
