import { API_BASE_URL } from '@/constants/env';
import { authedFetch } from '@/services/auth/deviceAuth';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await authedFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: { message?: string; code?: string; details?: unknown } = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parse errors
    }
    throw new ApiError(
      errorData.message || `Request failed with status ${response.status}`,
      response.status,
      errorData.code,
      errorData.details
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, init?: RequestInit) =>
    request<T>(endpoint, { method: 'GET', ...init }),

  post: <T>(endpoint: string, body: unknown, init?: RequestInit) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...init,
    }),

  put: <T>(endpoint: string, body: unknown, init?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...init,
    }),

  patch: <T>(endpoint: string, body: unknown, init?: RequestInit) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...init,
    }),

  delete: <T>(endpoint: string, init?: RequestInit) =>
    request<T>(endpoint, { method: 'DELETE', ...init }),
};

export { ApiError };