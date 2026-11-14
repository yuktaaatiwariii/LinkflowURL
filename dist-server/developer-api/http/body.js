"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_BODY_BYTES = void 0;
exports.readJsonBody = readJsonBody;
/** Maximum accepted JSON request body for the developer API (64 KiB). */
exports.MAX_BODY_BYTES = 64 * 1024;
function failure(status, code, message) {
    return { ok: false, status, code, message };
}
/**
 * Reads a request body with a hard size cap.
 *
 * The user-facing routes use an unbounded reader; the public API gets its own
 * bounded reader so an external caller cannot stream an arbitrarily large
 * payload into memory.
 */
function readJsonBody(req) {
    return new Promise((resolve) => {
        const declaredLength = Number(req.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > exports.MAX_BODY_BYTES) {
            resolve(failure(413, 'PAYLOAD_TOO_LARGE', `Request body must not exceed ${exports.MAX_BODY_BYTES} bytes.`));
            return;
        }
        const chunks = [];
        let size = 0;
        let settled = false;
        const settle = (result) => {
            if (settled)
                return;
            settled = true;
            resolve(result);
        };
        req.on('data', (chunk) => {
            if (settled)
                return;
            const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            size += buffer.length;
            if (size > exports.MAX_BODY_BYTES) {
                chunks.length = 0;
                settle(failure(413, 'PAYLOAD_TOO_LARGE', `Request body must not exceed ${exports.MAX_BODY_BYTES} bytes.`));
                return;
            }
            chunks.push(buffer);
        });
        req.on('end', () => {
            if (settled)
                return;
            const raw = Buffer.concat(chunks).toString('utf8').trim();
            if (!raw) {
                settle({ ok: true, value: {} });
                return;
            }
            try {
                settle({ ok: true, value: JSON.parse(raw) });
            }
            catch {
                settle(failure(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
            }
        });
        req.on('error', () => {
            settle(failure(400, 'INVALID_JSON', 'Unable to read the request body.'));
        });
    });
}
