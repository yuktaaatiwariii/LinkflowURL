"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachApiDeveloper = attachApiDeveloper;
exports.getApiDeveloper = getApiDeveloper;
/**
 * Request-scoped developer decoration.
 *
 * The project has no NestJS execution context, so the authenticated developer
 * is attached with a `WeakMap` keyed by the request object. Nothing leaks
 * between requests and no property is added to the shared `IncomingMessage`
 * prototype.
 */
const requestDevelopers = new WeakMap();
function attachApiDeveloper(req, developer) {
    requestDevelopers.set(req, developer);
}
function getApiDeveloper(req) {
    return requestDevelopers.get(req);
}
