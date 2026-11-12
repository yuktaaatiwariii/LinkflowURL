import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

/**
 * Central LinkFlow API configuration.
 *
 * Resolution order for the backend base URL:
 *   1. EXPO_PUBLIC_API_URL (explicit override, required for production builds
 *      and for tunnels where Metro is not served from the backend host).
 *   2. Expo dev server host from `Constants.expoConfig.hostUri`, so a physical
 *      phone automatically talks to the computer that serves the bundle.
 *   3. Emulator/simulator aliases when the host machine is not reachable through
 *      the dev-server address (`10.0.2.2` on Android, `localhost` on iOS).
 *   4. The origin of EXPO_PUBLIC_SHORT_URL_BASE (the same backend serves short
 *      links) when no dev-server host exists (standalone builds).
 *
 * Never put server secrets here: only EXPO_PUBLIC_* values are bundled.
 */

const DEFAULT_API_PORT = 3000;

/**
 * 15s is long enough for a slow mobile network round-trip (including Neon
 * cold starts) but short enough that an unreachable host cannot leave the UI
 * spinning. The previous 20s timeout only masked the real misconfiguration.
 */
const REQUEST_TIMEOUT_MS = 15000;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function isTunnelHost(hostname: string): boolean {
  return (
    hostname.endsWith('.exp.direct') ||
    hostname.endsWith('.ngrok.io') ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.tunnel.dev')
  );
}

/**
 * Host (LAN IP) that the Expo dev server is being served from.
 * Examples: "192.168.1.24:8081", "localhost:8081", "xxxx.exp.direct".
 */
function getExpoDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;

  try {
    const parsed = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`);
    return parsed.hostname || null;
  } catch {
    const host = hostUri.split('/')[0].split('?')[0].split(':')[0];
    return host || null;
  }
}

function getConfiguredPublicOrigin(): string | null {
  const configured = process.env.EXPO_PUBLIC_SHORT_URL_BASE?.trim();
  if (!configured) return null;

  try {
    const parsed = new URL(configured);
    if (!isLocalHost(parsed.hostname)) {
      return stripTrailingSlash(parsed.origin);
    }
  } catch {
    // Ignore malformed values and fall back to defaults.
  }
  return null;
}

/** Resolved backend base URL (no trailing slash). */
export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    return stripTrailingSlash(configured);
  }

  const devHost = getExpoDevHost();

  // Expo web can be opened from another device on the LAN (and expo-device
  // reports isDevice=true in browsers), so derive the API host from the page.
  if (Platform.OS === 'web') {
    const webHost =
      typeof window !== 'undefined' ? window.location.hostname : '';
    if (webHost && !isTunnelHost(webHost) && !isLocalHost(webHost)) {
      const protocol =
        typeof window !== 'undefined' && window.location.protocol === 'https:'
          ? 'https:'
          : 'http:';
      return `${protocol}//${webHost}:${DEFAULT_API_PORT}`;
    }
  }

  // Emulators/simulators cannot use the phone's own localhost.
  if (Platform.OS !== 'web' && !Device.isDevice) {
    if (Platform.OS === 'android') {
      // Android emulator alias for the host machine's loopback interface.
      return `http://10.0.2.2:${DEFAULT_API_PORT}`;
    }
    if (Platform.OS === 'ios') {
      // iOS simulator shares the Mac's network stack.
      return `http://localhost:${DEFAULT_API_PORT}`;
    }
  }

  // Physical device (or web) served by Expo over the LAN: use the same host
  // that served the bundle, with the backend port.
  if (devHost && !isTunnelHost(devHost) && !isLocalHost(devHost)) {
    return `http://${devHost}:${DEFAULT_API_PORT}`;
  }

  // Expo tunnel only proxies Metro, so fall back to a configured public
  // backend origin if one exists.
  const publicOrigin = getConfiguredPublicOrigin();
  if (publicOrigin) {
    return publicOrigin;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}

/**
 * Public base used to display/copy/share short links.
 * If someone left EXPO_PUBLIC_SHORT_URL_BASE pointing at localhost while the
 * app is actually talking to a LAN/public backend, using the API origin keeps
 * copied links usable on the device that copied them.
 */
export function getShortUrlBase(): string {
  const configured = process.env.EXPO_PUBLIC_SHORT_URL_BASE?.trim();
  const apiBase = getApiBaseUrl();

  if (configured) {
    try {
      const configuredHost = new URL(configured).hostname;
      const apiHost = new URL(apiBase).hostname;
      if (isLocalHost(configuredHost) && !isLocalHost(apiHost)) {
        return `${stripTrailingSlash(apiBase)}/`;
      }
    } catch {
      // Fall through to the configured value.
    }
    return `${stripTrailingSlash(configured)}/`;
  }

  return `${stripTrailingSlash(apiBase)}/`;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

/** Maps HTTP failures to actionable, user-safe copy. */
function mapHttpError(status: number, serverMessage: string | null): string {
  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (status >= 500) {
    return 'The server ran into a problem. Please try again shortly.';
  }
  return serverMessage || `Request failed (HTTP ${status}).`;
}

let didLogApiConfig = false;

function logApiConfigOnce(baseUrl: string) {
  if (!__DEV__ || didLogApiConfig) return;
  didLogApiConfig = true;

  try {
    const hostname = new URL(baseUrl).hostname;
    console.log(`[API] Backend base URL: ${baseUrl}`);
    if (Device.isDevice && isLocalHost(hostname)) {
      console.warn(
        '[API] A physical device cannot reach localhost. Set EXPO_PUBLIC_API_URL ' +
          'to your computer\'s LAN address (e.g. http://192.168.1.20:3000) and ' +
          'make sure the phone and computer are on the same network.'
      );
    }
  } catch {
    console.warn('[API] EXPO_PUBLIC_API_URL is not a valid URL:', baseUrl);
  }
}

/**
 * Single authenticated fetch wrapper used by every screen/service.
 * Attaches the Clerk bearer token, enforces a bounded timeout, logs request
 * metadata (never tokens or payloads), and maps failures to safe messages.
 */
export async function authenticatedFetch<T = any>(
  path: string,
  token: string | null | undefined,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  const method = (options.method || 'GET').toUpperCase();

  logApiConfigOnce(baseUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;

    let data: any = {};
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }

    if (__DEV__) {
      console.log(`[API] ${method} ${normalizedPath} ${res.status} ${durationMs}ms`);
    }

    if (!res.ok) {
      const serverMessage =
        typeof data?.error === 'string'
          ? data.error
          : typeof data?.message === 'string'
            ? data.message
            : null;
      return {
        data,
        status: res.status,
        message: data?.message,
        error: mapHttpError(res.status, serverMessage),
      };
    }

    return {
      data,
      status: res.status,
      message: data?.message,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    const timedOut = err?.name === 'AbortError';
    const rawMessage =
      err?.message || (timedOut ? 'Request aborted.' : 'Network request failed.');

    if (__DEV__) {
      console.warn(
        `[API] ${method} ${normalizedPath} failed after ${durationMs}ms: ${rawMessage} (${url})`
      );
    }

    const devHint = __DEV__ ? ` Backend: ${baseUrl}.` : '';

    return {
      status: 0,
      message: rawMessage,
      error: timedOut
        ? `Cannot connect to the server (request timed out). Check that the backend is running and reachable from this device.${devHint}`
        : `Cannot connect to the server. Check your internet connection and try again.${devHint}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function syncUserWithBackend(token: string, email?: string, fullName?: string | null) {
  return authenticatedFetch('/api/users/sync', token, {
    method: 'POST',
    body: JSON.stringify({ email, fullName }),
  });
}

export async function fetchUserLinks(token: string) {
  return authenticatedFetch('/api/links', token, {
    method: 'GET',
  });
}

export async function createShortLink(token: string, originalUrl: string, title?: string, customAlias?: string) {
  return authenticatedFetch('/api/links', token, {
    method: 'POST',
    body: JSON.stringify({ originalUrl, title, customAlias }),
  });
}

export async function saveQrCode(
  token: string,
  targetUrl: string,
  title?: string,
  linkId?: string
) {
  return authenticatedFetch('/api/qr', token, {
    method: 'POST',
    body: JSON.stringify({ targetUrl, title, linkId }),
  });
}

export async function fetchQrCodes(token: string) {
  return authenticatedFetch('/api/qr', token, {
    method: 'GET',
  });
}

export async function deleteQrCode(token: string, id: string) {
  return authenticatedFetch(`/api/qr/${id}`, token, {
    method: 'DELETE',
  });
}

export async function deleteShortLink(token: string, id: string) {
  return authenticatedFetch(`/api/links/${id}`, token, {
    method: 'DELETE',
  });
}
