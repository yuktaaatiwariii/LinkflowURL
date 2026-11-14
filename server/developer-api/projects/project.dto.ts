import { invalid, isPlainObject, type ValidationResult } from '../dto/validation';

/** Shared name validation for project create/update payloads. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export interface ProjectNameDto {
  name: string;
}

export function parseProjectName(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string') {
    return invalid('name must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1) {
    return invalid('name is required.');
  }
  if (trimmed.length > 100) {
    return invalid('name must not exceed 100 characters.');
  }
  if (CONTROL_CHARACTERS.test(trimmed)) {
    return invalid('name must not contain control characters.');
  }
  return { ok: true, value: trimmed };
}

/** DTO for `POST /api/developer/projects` and `PATCH /api/developer/projects/:id`. */
export function parseProjectDto(body: unknown): ValidationResult<ProjectNameDto> {
  if (!isPlainObject(body)) {
    return invalid('Request body must be a JSON object.');
  }
  const name = parseProjectName(body.name);
  if (!name.ok) return name;
  return { ok: true, value: { name: name.value } };
}
