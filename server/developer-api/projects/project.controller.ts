import type { IncomingMessage, ServerResponse } from 'http';
import type { DeveloperApiKeyRecord, DeveloperProjectRecord, UserRecord } from '../../types';
import { readJsonBody } from '../http/body';
import { sendError, sendSuccess } from '../http/envelope';
import { parseResourceId } from '../dto/validation';
import { PersistenceUnavailableError } from '../persistence';
import { toApiKeyMetadata, type ApiKeyMetadata } from '../keys/api-key.presenter';
import { listApiKeysForUser } from '../keys/api-key.store';
import { parseProjectDto } from './project.dto';
import {
  deleteProject,
  findProjectByName,
  findProjectForUser,
  insertProject,
  listProjectsForUser,
  renameProject,
} from './project.store';

/**
 * JWT-authenticated project management.
 *
 * Ownership is enforced by passing `user.id` into every store predicate. A
 * project can only be deleted when it has no keys, so no credential can be
 * orphaned or silently lost.
 */

export interface ProjectView {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  keyCount: number;
  activeKeyCount: number;
  testKeyCount: number;
  liveKeyCount: number;
  environments: Array<'test' | 'live'>;
  lastUsedAt: string | null;
}

const PROJECT_NOT_FOUND = 'Project not found.';

function sendPersistenceFailure(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PersistenceUnavailableError) {
    sendError(
      res,
      503,
      'DATABASE_NOT_CONFIGURED',
      'Developer dashboard persistence is not configured on this server.'
    );
    return true;
  }
  return false;
}

async function runWithPersistenceErrors<T>(
  res: ServerResponse,
  operation: () => Promise<T>
): Promise<T | null> {
  try {
    return await operation();
  } catch (err) {
    if (sendPersistenceFailure(res, err)) return null;
    throw err;
  }
}

function parseProjectId(res: ServerResponse, rawId: string): string | null {
  const parsed = parseResourceId(rawId);
  if (!parsed.ok) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.message);
    return null;
  }
  return parsed.value;
}

/** Keys belonging to a project, including legacy rows matched by name. */
export function keysForProject(
  project: DeveloperProjectRecord,
  keys: DeveloperApiKeyRecord[]
): DeveloperApiKeyRecord[] {
  const name = project.name.trim().toLowerCase();
  return keys.filter(
    (key) =>
      key.project_id === project.id ||
      (key.project_id === null && key.project_name.trim().toLowerCase() === name)
  );
}

function isActive(key: DeveloperApiKeyRecord): boolean {
  return (
    key.status === 'active' &&
    (!key.expires_at || new Date(key.expires_at).getTime() > Date.now())
  );
}

export function toProjectView(
  project: DeveloperProjectRecord,
  keys: DeveloperApiKeyRecord[]
): ProjectView {
  const projectKeys = keysForProject(project, keys);
  const environments = new Set<'test' | 'live'>();
  for (const key of projectKeys) environments.add(key.environment);

  let lastUsedAt: string | null = null;
  for (const key of projectKeys) {
    if (!key.last_used_at) continue;
    if (!lastUsedAt || new Date(key.last_used_at).getTime() > new Date(lastUsedAt).getTime()) {
      lastUsedAt = key.last_used_at;
    }
  }

  return {
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    keyCount: projectKeys.length,
    activeKeyCount: projectKeys.filter(isActive).length,
    testKeyCount: projectKeys.filter((key) => key.environment === 'test').length,
    liveKeyCount: projectKeys.filter((key) => key.environment === 'live').length,
    environments: (['test', 'live'] as const).filter((environment) => environments.has(environment)),
    lastUsedAt,
  };
}

/** GET /api/developer/projects */
export async function listProjects(user: UserRecord, res: ServerResponse): Promise<void> {
  const data = await runWithPersistenceErrors(res, async () => {
    const [projects, keys] = await Promise.all([
      listProjectsForUser(user.id),
      listApiKeysForUser(user.id),
    ]);
    return { projects: projects.map((project) => toProjectView(project, keys)) };
  });
  if (!data) return;

  return sendSuccess(res, 200, 'Projects retrieved successfully', {
    projects: data.projects,
    total: data.projects.length,
  });
}

/** POST /api/developer/projects */
export async function createProject(
  user: UserRecord,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body.ok) {
    return sendError(res, body.status, body.code, body.message);
  }

  const dto = parseProjectDto(body.value);
  if (!dto.ok) {
    return sendError(res, 400, 'VALIDATION_ERROR', dto.message);
  }

  const existing = await runWithPersistenceErrors(res, () =>
    findProjectByName(user.id, dto.value.name)
  );
  if (existing) {
    return sendError(res, 409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists.');
  }

  const project = await runWithPersistenceErrors(res, () =>
    insertProject(user.id, dto.value.name)
  );
  if (!project) return;

  return sendSuccess(res, 201, 'Project created successfully', toProjectView(project, []));
}

/** GET /api/developer/projects/:id */
export async function getProject(
  user: UserRecord,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const id = parseProjectId(res, rawId);
  if (!id) return;

  const data = await runWithPersistenceErrors(res, async () => {
    const [project, keys] = await Promise.all([
      findProjectForUser(id, user.id),
      listApiKeysForUser(user.id),
    ]);
    return { project, keys };
  });
  if (!data) return;
  if (!data.project) {
    return sendError(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
  }

  const projectKeys = keysForProject(data.project, data.keys).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sendSuccess(res, 200, 'Project retrieved successfully', {
    project: toProjectView(data.project, data.keys),
    keys: projectKeys.map<ApiKeyMetadata>(toApiKeyMetadata),
  });
}

/** PATCH /api/developer/projects/:id */
export async function updateProject(
  user: UserRecord,
  req: IncomingMessage,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const id = parseProjectId(res, rawId);
  if (!id) return;

  const body = await readJsonBody(req);
  if (!body.ok) {
    return sendError(res, body.status, body.code, body.message);
  }
  const dto = parseProjectDto(body.value);
  if (!dto.ok) {
    return sendError(res, 400, 'VALIDATION_ERROR', dto.message);
  }

  const result = await runWithPersistenceErrors(res, () =>
    renameProject(id, user.id, dto.value.name)
  );
  if (!result) return;

  if (!result.ok) {
    if (result.reason === 'duplicate') {
      return sendError(res, 409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists.');
    }
    return sendError(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
  }

  return sendSuccess(res, 200, 'Project updated successfully', toProjectView(result.project, []));
}

/** DELETE /api/developer/projects/:id */
export async function deleteDeveloperProject(
  user: UserRecord,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const id = parseProjectId(res, rawId);
  if (!id) return;

  const data = await runWithPersistenceErrors(res, async () => {
    const [project, keys] = await Promise.all([
      findProjectForUser(id, user.id),
      listApiKeysForUser(user.id),
    ]);
    return { project, keys };
  });
  if (!data) return;
  if (!data.project) {
    return sendError(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
  }

  const projectKeys = keysForProject(data.project, data.keys);
  if (projectKeys.length > 0) {
    return sendError(
      res,
      409,
      'PROJECT_NOT_EMPTY',
      'Revoke and remove the API keys in this project before deleting it.'
    );
  }

  const deleted = await runWithPersistenceErrors(res, () => deleteProject(id, user.id));
  if (!deleted) {
    return sendError(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
  }

  return sendSuccess(res, 200, 'Project deleted successfully', { id });
}
