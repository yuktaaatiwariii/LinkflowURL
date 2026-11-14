"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasScope = hasScope;
exports.requireScope = requireScope;
const envelope_1 = require("../http/envelope");
/**
 * Reusable scope enforcement for public developer endpoints.
 *
 * Scopes come from the persisted key record resolved by the API-key guard;
 * they are never read from the request body.
 */
function hasScope(developer, scope) {
    return developer.scopes.includes(scope);
}
function requireScope(developer, scope, res) {
    if (hasScope(developer, scope))
        return true;
    (0, envelope_1.sendError)(res, 403, 'INSUFFICIENT_SCOPE', `This API key lacks the required scope: ${scope}.`);
    return false;
}
