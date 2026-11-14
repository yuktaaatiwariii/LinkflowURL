import type { ServerResponse } from 'http';

/**
 * Consistent envelope for every `/api/v1/*` response.
 *
 *   success: { success: true,  message, data }
 *   error:   { success: false, message, error: { code } }
 */

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  error: { code: string };
}

export function successBody<T>(message: string, data: T): ApiSuccessBody<T> {
  return { success: true, message, data };
}

export function errorBody(code: string, message: string): ApiErrorBody {
  return { success: false, message, error: { code } };
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendSuccess<T>(
  res: ServerResponse,
  status: number,
  message: string,
  data: T
): void {
  writeJson(res, status, successBody(message, data));
}

export function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): void {
  if (headers) {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
  }
  writeJson(res, status, errorBody(code, message));
}
