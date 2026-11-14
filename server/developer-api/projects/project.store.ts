import crypto from 'crypto';
import { query } from '../../db';
import type { DeveloperProjectRecord } from '../../types';
import { toIso, useMemoryStore, isInvalidUuidError } from '../persistence';

/**
 * Persistence for developer projects.
 *
 * A project is a developer-owned grouping of API keys (e.g. "My Ecommerce
 * App"). PostgreSQL is authoritative; the memory repository is only used for
 * local development and tests.
 */

type ProjectRow = Omit<DeveloperProjectRecord, 'created_at' | 'updated_at'> & {
  created_at: string | Date;
  updated_at: string | Date;
};

const PROJECT_COLUMNS = `id, user_id, name, created_at, updated_at`;

function normalize(row: ProjectRow): DeveloperProjectRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    created_at: toIso(row.created_at) as string,
    updated_at: toIso(row.updated_at) as string,
  };
}

export type ProjectMutationResult =
  | { ok: true; project: DeveloperProjectRecord }
  | { ok: false; reason: 'not_found' | 'duplicate' };

class ProjectMemoryStore {
  readonly records = new Map<string, DeveloperProjectRecord>();

  insert(userId: string, name: string): DeveloperProjectRecord {
    const existing = this.findByName(userId, name);
    if (existing) return existing;

    const now = new Date().toISOString();
    const record: DeveloperProjectRecord = {
      id: `prj_${crypto.randomBytes(10).toString('hex')}`,
      user_id: userId,
      name,
      created_at: now,
      updated_at: now,
    };
    this.records.set(record.id, record);
    return { ...record };
  }

  listForUser(userId: string): DeveloperProjectRecord[] {
    return Array.from(this.records.values())
      .filter((record) => record.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((record) => ({ ...record }));
  }

  findForUser(id: string, userId: string): DeveloperProjectRecord | null {
    const record = this.records.get(id);
    if (!record || record.user_id !== userId) return null;
    return { ...record };
  }

  findByName(userId: string, name: string): DeveloperProjectRecord | null {
    const normalized = name.trim().toLowerCase();
    const record = Array.from(this.records.values()).find(
      (entry) => entry.user_id === userId && entry.name.trim().toLowerCase() === normalized
    );
    return record ? { ...record } : null;
  }

  rename(id: string, userId: string, name: string): ProjectMutationResult {
    const record = this.records.get(id);
    if (!record || record.user_id !== userId) return { ok: false, reason: 'not_found' };

    const duplicate = Array.from(this.records.values()).find(
      (entry) =>
        entry.id !== id &&
        entry.user_id === userId &&
        entry.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (duplicate) return { ok: false, reason: 'duplicate' };

    record.name = name;
    record.updated_at = new Date().toISOString();
    return { ok: true, project: { ...record } };
  }

  remove(id: string, userId: string): boolean {
    const record = this.records.get(id);
    if (!record || record.user_id !== userId) return false;
    return this.records.delete(id);
  }

  clearForTests(): void {
    this.records.clear();
  }
}

export const projectMemoryStore = new ProjectMemoryStore();

/** Creates a project, returning the existing one when the name already exists. */
export async function insertProject(
  userId: string,
  name: string
): Promise<DeveloperProjectRecord> {
  if (useMemoryStore()) {
    return projectMemoryStore.insert(userId, name);
  }

  const existing = await query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM developer_projects
     WHERE user_id = $1 AND lower(name) = lower($2)
     LIMIT 1`,
    [userId, name]
  );
  if (existing.length > 0) return normalize(existing[0]);

  try {
    const rows = await query<ProjectRow>(
      `INSERT INTO developer_projects (user_id, name)
       VALUES ($1, $2)
       RETURNING ${PROJECT_COLUMNS}`,
      [userId, name]
    );
    return normalize(rows[0]);
  } catch (err: any) {
    // Concurrent creation of the same project: return the winning row.
    if (err?.code === '23505') {
      const raced = await query<ProjectRow>(
        `SELECT ${PROJECT_COLUMNS} FROM developer_projects
         WHERE user_id = $1 AND lower(name) = lower($2)
         LIMIT 1`,
        [userId, name]
      );
      if (raced.length > 0) return normalize(raced[0]);
    }
    throw err;
  }
}

export async function listProjectsForUser(userId: string): Promise<DeveloperProjectRecord[]> {
  if (useMemoryStore()) {
    return projectMemoryStore.listForUser(userId);
  }
  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM developer_projects
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(normalize);
}

export async function findProjectForUser(
  id: string,
  userId: string
): Promise<DeveloperProjectRecord | null> {
  if (useMemoryStore()) {
    return projectMemoryStore.findForUser(id, userId);
  }
  try {
    const rows = await query<ProjectRow>(
      `SELECT ${PROJECT_COLUMNS} FROM developer_projects
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [id, userId]
    );
    return rows.length > 0 ? normalize(rows[0]) : null;
  } catch (err) {
    if (isInvalidUuidError(err)) return null;
    throw err;
  }
}

export async function findProjectByName(
  userId: string,
  name: string
): Promise<DeveloperProjectRecord | null> {
  if (useMemoryStore()) {
    return projectMemoryStore.findByName(userId, name);
  }
  const rows = await query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} FROM developer_projects
     WHERE user_id = $1 AND lower(name) = lower($2)
     LIMIT 1`,
    [userId, name]
  );
  return rows.length > 0 ? normalize(rows[0]) : null;
}

export async function renameProject(
  id: string,
  userId: string,
  name: string
): Promise<ProjectMutationResult> {
  if (useMemoryStore()) {
    return projectMemoryStore.rename(id, userId, name);
  }

  try {
    const rows = await query<ProjectRow>(
      `UPDATE developer_projects
       SET name = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING ${PROJECT_COLUMNS}`,
      [id, userId, name]
    );
    if (rows.length === 0) return { ok: false, reason: 'not_found' };
    return { ok: true, project: normalize(rows[0]) };
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, reason: 'duplicate' };
    if (isInvalidUuidError(err)) return { ok: false, reason: 'not_found' };
    throw err;
  }
}

export async function deleteProject(id: string, userId: string): Promise<boolean> {
  if (useMemoryStore()) {
    return projectMemoryStore.remove(id, userId);
  }
  try {
    const rows = await query<{ id: string }>(
      `DELETE FROM developer_projects
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );
    return rows.length > 0;
  } catch (err) {
    if (isInvalidUuidError(err)) return false;
    throw err;
  }
}
