/**
 * Base API client for Lumentra Dashboard
 * Handles all HTTP requests to the backend API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface ApiError {
  message: string;
  status: number;
}

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

/**
 * Generic API client function
 */
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorJson.message || errorText;
    } catch {
      errorMessage =
        errorText || `Request failed with status ${response.status}`;
    }

    throw new ApiClientError(errorMessage, response.status);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * GET request helper
 */
export function get<T>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = params
    ? `${endpoint}?${new URLSearchParams(params).toString()}`
    : endpoint;

  return apiClient<T>(url, { method: "GET" });
}

/**
 * POST request helper
 */
export function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT request helper
 */
export function put<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request helper
 */
export function patch<T>(endpoint: string, data?: unknown): Promise<T> {
  return apiClient<T>(endpoint, {
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper
 */
export function del<T>(endpoint: string): Promise<T> {
  return apiClient<T>(endpoint, { method: "DELETE" });
}

export { API_BASE };
