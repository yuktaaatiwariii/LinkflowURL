import type { IncomingMessage, ServerResponse } from 'http';
import type { DeveloperApiKeyRecord, DeveloperProjectRecord, UserRecord } from '../../types';
import { parseCreateApiKeyDto } from '../dto/create-api-key.dto';
import { parseResourceId } from '../dto/validation';
import { readJsonBody } from '../http/body';
import { sendError, sendSuccess } from '../http/envelope';
import {
  ApiKeyHashSecretMissingError,
  generateApiKey,
  hashApiKeySecret,
  isApiKeyHashingConfigured,
} from '../keys/api-key-crypto';
import { toApiKeyMetadata, toApiKeyWithSecret } from '../keys/api-key.presenter';
import {
  PersistenceUnavailableError,
  findApiKeyForUser,
  insertApiKey,
  listApiKeysForUser,
  revokeApiKey,
  rotateApiKey,
} from '../keys/api-key.store';
import { findProjectForUser, insertProject } from '../projects/project.store';

/**
 * JWT-authenticated API key management.
 *
 * Every handler receives the already-authenticated owner resolved from the
 * Bearer token. Ownership is enforced by passing `user.id` into every store
 * query, so a caller can never read or mutate another account's keys.
 *
 * Responses carry metadata only except `create` and `rotate`, which return the
 * full secret exactly once.
 */

const KEY_NOT_FOUND = 'API key not found.';

function sendPersistenceFailure(res: ServerResponse, err: unknown): boolean {
  if (err instanceof ApiKeyHashSecretMissingError) {
    sendError(
      res,
      503,
      'API_KEY_HASH_NOT_CONFIGURED',
      'Developer API key hashing is not configured on this server.'
    );
    return true;
  }
  if (err instanceof PersistenceUnavailableError) {
    sendError(
      res,
      503,
      'DATABASE_NOT_CONFIGURED',
      'Developer API key persistence is not configured on this server.'
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

function hashConfigured(res: ServerResponse): boolean {
  if (isApiKeyHashingConfigured()) return true;
  sendError(
    res,
    503,
    'API_KEY_HASH_NOT_CONFIGURED',
    'Developer API key hashing is not configured on this server.'
  );
  return false;
}

function parseKeyId(res: ServerResponse, rawId: string): string | null {
  const parsed = parseResourceId(rawId);
  if (!parsed.ok) {
    sendError(res, 400, 'VALIDATION_ERROR', parsed.message);
    return null;
  }
  return parsed.value;
}

/** POST /api/developer/keys */
export async function createApiKey(
  user: UserRecord,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body.ok) {
    return sendError(res, body.status, body.code, body.message);
  }

  const dto = parseCreateApiKeyDto(body.value);
  if (!dto.ok) {
    return sendError(res, 400, 'VALIDATION_ERROR', dto.message);
  }

  if (!hashConfigured(res)) return;

  let project: DeveloperProjectRecord | null = null;
  try {
    if (dto.value.projectId) {
      project = await findProjectForUser(dto.value.projectId, user.id);
      if (!project) {
        return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Project not found.');
      }
    } else if (dto.value.projectName) {
      // Phase 2 compatibility: a projectName creates the project on demand.
      project = await insertProject(user.id, dto.value.projectName);
    }
  } catch (err) {
    if (sendPersistenceFailure(res, err)) return;
    throw err;
  }

  if (!project) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'projectName or projectId is required.');
  }

  const generated = generateApiKey(dto.value.environment);

  let record: DeveloperApiKeyRecord | null = null;
  try {
    record = await insertApiKey({
      userId: user.id,
      projectId: project.id,
      projectName: project.name,
      keyPrefix: generated.prefix,
      keyHash: hashApiKeySecret(generated.secret),
      environment: dto.value.environment,
      scopes: dto.value.scopes,
      expiresAt: dto.value.expiresAt,
    });
  } catch (err) {
    if (sendPersistenceFailure(res, err)) return;
    throw err;
  }

  return sendSuccess(
    res,
    201,
    'API key created successfully',
    toApiKeyWithSecret(record, generated.fullKey)
  );
}

/** GET /api/developer/keys */
export async function listApiKeys(user: UserRecord, res: ServerResponse): Promise<void> {
  const records = await runWithPersistenceErrors(res, () => listApiKeysForUser(user.id));
  if (!records) return;

  return sendSuccess(res, 200, 'API keys retrieved successfully', {
    keys: records.map(toApiKeyMetadata),
    total: records.length,
  });
}

/** GET /api/developer/keys/:id */
export async function getApiKey(
  user: UserRecord,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const id = parseKeyId(res, rawId);
  if (!id) return;

  const record = await runWithPersistenceErrors(res, () => findApiKeyForUser(id, user.id));
  if (!record) {
    return sendError(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
  }

  return sendSuccess(res, 200, 'API key retrieved successfully', toApiKeyMetadata(record));
}

/** DELETE /api/developer/keys/:id */
export async function revokeDeveloperApiKey(
  user: UserRecord,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const id = parseKeyId(res, rawId);
  if (!id) return;

  const record = await runWithPersistenceErrors(res, () => revokeApiKey(id, user.id));
  if (!record) {
    return sendError(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
  }

  return sendSuccess(res, 200, 'API key revoked successfully', toApiKeyMetadata(record));
}

/** POST /api/developer/keys/:id/rotate */
export async function rotateDeveloperApiKey(
  user: UserRecord,
  res: ServerResponse,
  rawId: string
): Promise<void> {
  const id = parseKeyId(res, rawId);
  if (!id) return;

  if (!hashConfigured(res)) return;

  // Read the existing record first: the environment is immutable and must be
  // encoded into the replacement secret. Status/expiry are re-checked inside
  // the store's transaction so a concurrent rotation cannot be bypassed.
  const existing = await runWithPersistenceErrors(res, () => findApiKeyForUser(id, user.id));
  if (!existing) {
    return sendError(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
  }
  if (existing.status !== 'active') {
    return sendError(res, 409, 'API_KEY_REVOKED', 'This API key has been revoked.');
  }
  if (existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
    return sendError(res, 409, 'API_KEY_EXPIRED', 'This API key has expired.');
  }

  const generated = generateApiKey(existing.environment);

  const result = await runWithPersistenceErrors(res, () =>
    rotateApiKey(id, user.id, {
      keyPrefix: generated.prefix,
      keyHash: hashApiKeySecret(generated.secret),
    })
  );
  if (!result) return;

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return sendError(res, 404, 'API_KEY_NOT_FOUND', KEY_NOT_FOUND);
    }
    if (result.reason === 'revoked') {
      return sendError(res, 409, 'API_KEY_REVOKED', 'This API key has been revoked.');
    }
    return sendError(res, 409, 'API_KEY_EXPIRED', 'This API key has expired.');
  }

  return sendSuccess(
    res,
    200,
    'API key rotated successfully',
    toApiKeyWithSecret(result.created, generated.fullKey)
  );
}
