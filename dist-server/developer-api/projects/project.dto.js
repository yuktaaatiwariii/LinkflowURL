"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProjectName = parseProjectName;
exports.parseProjectDto = parseProjectDto;
const validation_1 = require("../dto/validation");
/** Shared name validation for project create/update payloads. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
function parseProjectName(value) {
    if (typeof value !== 'string') {
        return (0, validation_1.invalid)('name must be a string.');
    }
    const trimmed = value.trim();
    if (trimmed.length < 1) {
        return (0, validation_1.invalid)('name is required.');
    }
    if (trimmed.length > 100) {
        return (0, validation_1.invalid)('name must not exceed 100 characters.');
    }
    if (CONTROL_CHARACTERS.test(trimmed)) {
        return (0, validation_1.invalid)('name must not contain control characters.');
    }
    return { ok: true, value: trimmed };
}
/** DTO for `POST /api/developer/projects` and `PATCH /api/developer/projects/:id`. */
function parseProjectDto(body) {
    if (!(0, validation_1.isPlainObject)(body)) {
        return (0, validation_1.invalid)('Request body must be a JSON object.');
    }
    const name = parseProjectName(body.name);
    if (!name.ok)
        return name;
    return { ok: true, value: { name: name.value } };
}
