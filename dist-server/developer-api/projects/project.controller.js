"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keysForProject = keysForProject;
exports.toProjectView = toProjectView;
exports.listProjects = listProjects;
exports.createProject = createProject;
exports.getProject = getProject;
exports.updateProject = updateProject;
exports.deleteDeveloperProject = deleteDeveloperProject;
const body_1 = require("../http/body");
const envelope_1 = require("../http/envelope");
const validation_1 = require("../dto/validation");
const persistence_1 = require("../persistence");
const api_key_presenter_1 = require("../keys/api-key.presenter");
const api_key_store_1 = require("../keys/api-key.store");
const project_dto_1 = require("./project.dto");
const project_store_1 = require("./project.store");
const PROJECT_NOT_FOUND = 'Project not found.';
function sendPersistenceFailure(res, err) {
    if (err instanceof persistence_1.PersistenceUnavailableError) {
        (0, envelope_1.sendError)(res, 503, 'DATABASE_NOT_CONFIGURED', 'Developer dashboard persistence is not configured on this server.');
        return true;
    }
    return false;
}
async function runWithPersistenceErrors(res, operation) {
    try {
        return await operation();
    }
    catch (err) {
        if (sendPersistenceFailure(res, err))
            return null;
        throw err;
    }
}
function parseProjectId(res, rawId) {
    const parsed = (0, validation_1.parseResourceId)(rawId);
    if (!parsed.ok) {
        (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', parsed.message);
        return null;
    }
    return parsed.value;
}
/** Keys belonging to a project, including legacy rows matched by name. */
function keysForProject(project, keys) {
    const name = project.name.trim().toLowerCase();
    return keys.filter((key) => key.project_id === project.id ||
        (key.project_id === null && key.project_name.trim().toLowerCase() === name));
}
function isActive(key) {
    return (key.status === 'active' &&
        (!key.expires_at || new Date(key.expires_at).getTime() > Date.now()));
}
function toProjectView(project, keys) {
    const projectKeys = keysForProject(project, keys);
    const environments = new Set();
    for (const key of projectKeys)
        environments.add(key.environment);
    let lastUsedAt = null;
    for (const key of projectKeys) {
        if (!key.last_used_at)
            continue;
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
        environments: ['test', 'live'].filter((environment) => environments.has(environment)),
        lastUsedAt,
    };
}
/** GET /api/developer/projects */
async function listProjects(user, res) {
    const data = await runWithPersistenceErrors(res, async () => {
        const [projects, keys] = await Promise.all([
            (0, project_store_1.listProjectsForUser)(user.id),
            (0, api_key_store_1.listApiKeysForUser)(user.id),
        ]);
        return { projects: projects.map((project) => toProjectView(project, keys)) };
    });
    if (!data)
        return;
    return (0, envelope_1.sendSuccess)(res, 200, 'Projects retrieved successfully', {
        projects: data.projects,
        total: data.projects.length,
    });
}
/** POST /api/developer/projects */
async function createProject(user, req, res) {
    const body = await (0, body_1.readJsonBody)(req);
    if (!body.ok) {
        return (0, envelope_1.sendError)(res, body.status, body.code, body.message);
    }
    const dto = (0, project_dto_1.parseProjectDto)(body.value);
    if (!dto.ok) {
        return (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', dto.message);
    }
    const existing = await runWithPersistenceErrors(res, () => (0, project_store_1.findProjectByName)(user.id, dto.value.name));
    if (existing) {
        return (0, envelope_1.sendError)(res, 409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists.');
    }
    const project = await runWithPersistenceErrors(res, () => (0, project_store_1.insertProject)(user.id, dto.value.name));
    if (!project)
        return;
    return (0, envelope_1.sendSuccess)(res, 201, 'Project created successfully', toProjectView(project, []));
}
/** GET /api/developer/projects/:id */
async function getProject(user, res, rawId) {
    const id = parseProjectId(res, rawId);
    if (!id)
        return;
    const data = await runWithPersistenceErrors(res, async () => {
        const [project, keys] = await Promise.all([
            (0, project_store_1.findProjectForUser)(id, user.id),
            (0, api_key_store_1.listApiKeysForUser)(user.id),
        ]);
        return { project, keys };
    });
    if (!data)
        return;
    if (!data.project) {
        return (0, envelope_1.sendError)(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
    }
    const projectKeys = keysForProject(data.project, data.keys).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return (0, envelope_1.sendSuccess)(res, 200, 'Project retrieved successfully', {
        project: toProjectView(data.project, data.keys),
        keys: projectKeys.map(api_key_presenter_1.toApiKeyMetadata),
    });
}
/** PATCH /api/developer/projects/:id */
async function updateProject(user, req, res, rawId) {
    const id = parseProjectId(res, rawId);
    if (!id)
        return;
    const body = await (0, body_1.readJsonBody)(req);
    if (!body.ok) {
        return (0, envelope_1.sendError)(res, body.status, body.code, body.message);
    }
    const dto = (0, project_dto_1.parseProjectDto)(body.value);
    if (!dto.ok) {
        return (0, envelope_1.sendError)(res, 400, 'VALIDATION_ERROR', dto.message);
    }
    const result = await runWithPersistenceErrors(res, () => (0, project_store_1.renameProject)(id, user.id, dto.value.name));
    if (!result)
        return;
    if (!result.ok) {
        if (result.reason === 'duplicate') {
            return (0, envelope_1.sendError)(res, 409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists.');
        }
        return (0, envelope_1.sendError)(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
    }
    return (0, envelope_1.sendSuccess)(res, 200, 'Project updated successfully', toProjectView(result.project, []));
}
/** DELETE /api/developer/projects/:id */
async function deleteDeveloperProject(user, res, rawId) {
    const id = parseProjectId(res, rawId);
    if (!id)
        return;
    const data = await runWithPersistenceErrors(res, async () => {
        const [project, keys] = await Promise.all([
            (0, project_store_1.findProjectForUser)(id, user.id),
            (0, api_key_store_1.listApiKeysForUser)(user.id),
        ]);
        return { project, keys };
    });
    if (!data)
        return;
    if (!data.project) {
        return (0, envelope_1.sendError)(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
    }
    const projectKeys = keysForProject(data.project, data.keys);
    if (projectKeys.length > 0) {
        return (0, envelope_1.sendError)(res, 409, 'PROJECT_NOT_EMPTY', 'Revoke and remove the API keys in this project before deleting it.');
    }
    const deleted = await runWithPersistenceErrors(res, () => (0, project_store_1.deleteProject)(id, user.id));
    if (!deleted) {
        return (0, envelope_1.sendError)(res, 404, 'PROJECT_NOT_FOUND', PROJECT_NOT_FOUND);
    }
    return (0, envelope_1.sendSuccess)(res, 200, 'Project deleted successfully', { id });
}
