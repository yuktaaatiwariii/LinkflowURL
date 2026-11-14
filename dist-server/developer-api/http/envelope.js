"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successBody = successBody;
exports.errorBody = errorBody;
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function successBody(message, data) {
    return { success: true, message, data };
}
function errorBody(code, message) {
    return { success: false, message, error: { code } };
}
function writeJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
    });
    res.end(body);
}
function sendSuccess(res, status, message, data) {
    writeJson(res, status, successBody(message, data));
}
function sendError(res, status, code, message, headers) {
    if (headers) {
        for (const [name, value] of Object.entries(headers)) {
            res.setHeader(name, value);
        }
    }
    writeJson(res, status, errorBody(code, message));
}
