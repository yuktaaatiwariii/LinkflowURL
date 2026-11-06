import { Platform } from 'react-native';

/**
 * Resolves the backend API base URL depending on runtime environment
 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // When running on physical device / emulator, adjust host accordingly
  if (Platform.OS === 'android') {
    // Android emulator alias for host machine localhost
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export async function authenticatedFetch<T = any>(
  path: string,
  token: string | null | undefined,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    return {
      data,
      error: !res.ok ? data.error || data.message || `HTTP ${res.status}` : undefined,
      message: data.message,
      status: res.status,
    };
  } catch (err: any) {
    // If backend is currently not running or unreachable, return a handled failure response
    return {
      error: 'Backend API unreachable',
      message: err.message,
      status: 0,
    };
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

