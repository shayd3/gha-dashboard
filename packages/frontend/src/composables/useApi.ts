import { useAuthStore } from "../stores/auth.js";
import { router } from "../router/index.js";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options?.body !== undefined && options.body !== null
        ? { "Content-Type": "application/json" }
        : {}),
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    const auth = useAuthStore();
    auth.$reset();
    router.push({ name: "login" });
    throw new Error("Not authenticated");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ||
        `API error: ${response.status}`
    );
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
