import type { CreateLinkInput } from '../interfaces/api-developer.interface';
import {
  invalid,
  isPlainObject,
  parseHttpUrl,
  parseOptionalAlias,
  parseOptionalTitle,
  type ValidationResult,
} from './validation';

/**
 * DTO for `POST /api/v1/links`.
 *
 * Only business fields are read. Any `userId` / `user_id` supplied by the
 * caller is ignored: ownership always comes from the authenticated key.
 */
export function parseCreateLinkDto(body: unknown): ValidationResult<CreateLinkInput> {
  if (!isPlainObject(body)) {
    return invalid('Request body must be a JSON object.');
  }

  const originalUrl = parseHttpUrl(body.originalUrl, 'originalUrl');
  if (!originalUrl.ok) return originalUrl;

  const title = parseOptionalTitle(body.title);
  if (!title.ok) return title;

  const customAlias = parseOptionalAlias(body.customAlias);
  if (!customAlias.ok) return customAlias;

  return {
    ok: true,
    value: {
      originalUrl: originalUrl.value,
      title: title.value,
      customAlias: customAlias.value,
    },
  };
}
