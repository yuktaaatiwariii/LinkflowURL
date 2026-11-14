import type { IncomingMessage } from 'http';

/** Maximum accepted JSON request body for the developer API (64 KiB). */
export const MAX_BODY_BYTES = 64 * 1024;

export type BodyReadResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; code: string; message: string };

function failure(status: 400 | 413, code: string, message: string): BodyReadResult {
  return { ok: false, status, code, message };
}

/**
 * Reads a request body with a hard size cap.
 *
 * The user-facing routes use an unbounded reader; the public API gets its own
 * bounded reader so an external caller cannot stream an arbitrarily large
 * payload into memory.
 */
export function readJsonBody(req: IncomingMessage): Promise<BodyReadResult> {
  return new Promise((resolve) => {
    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      resolve(
        failure(413, 'PAYLOAD_TOO_LARGE', `Request body must not exceed ${MAX_BODY_BYTES} bytes.`)
      );
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const settle = (result: BodyReadResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    req.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        settle(
          failure(413, 'PAYLOAD_TOO_LARGE', `Request body must not exceed ${MAX_BODY_BYTES} bytes.`)
        );
        return;
      }
      chunks.push(buffer);
    });

    req.on('end', () => {
      if (settled) return;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        settle({ ok: true, value: {} });
        return;
      }
      try {
        settle({ ok: true, value: JSON.parse(raw) });
      } catch {
        settle(failure(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      }
    });

    req.on('error', () => {
      settle(failure(400, 'INVALID_JSON', 'Unable to read the request body.'));
    });
  });
}
