// src/lib/api.ts
//
// WHY A CUSTOM FETCH WRAPPER INSTEAD OF AXIOS OR REACT QUERY?
// The spec said to avoid unnecessary libraries. A thin wrapper around the
// native fetch API gives us automatic auth header injection without adding a
// dependency. If the project grows, wrapping this in React Query would be a
// natural next step.

import { getToken } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

/**
 * Makes an authenticated (or unauthenticated) request to the API.
 * Automatically:
 *   - Attaches `Content-Type: application/json`
 *   - Attaches `Authorization: Bearer <token>` when a token exists
 *   - Parses the JSON response
 *
 * Returns the parsed response data.
 * Throws an Error with the server's error message if the response is not ok.
 */
export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Parse JSON regardless of status so we can read the error message
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    // Throw with the server's error message so UI can display it
    throw new Error(data.error ?? "An unexpected error occurred");
  }

  return data;
}
