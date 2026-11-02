import { type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// export async function request(method: string, path: string, data?: object) {
//   return await fetch(path, {
//     method,
//     credentials: method !== "GET" ? "include" : undefined,
//     headers: data ? { "Content-Type": "application/json" } : undefined,
//     body: data ? JSON.stringify(data) : undefined,
//   });
// }

export async function request(method: string, path: string, data?: object) {
  const options: RequestInit = {
    method,
    credentials: "include",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  };

  const send = () => fetch(path, options).catch(() => Response.json({ message: "Unable to confirm the operation. Check your connection and refresh before retrying." }, { status: 503 }));
  let response = await send();

  // If not unauthorized, return the response
  if (response.status !== 401) {
    return response;
  }

  // Refresh Access Token
  const refreshed = await refreshAccessToken();

  if (!refreshed) {
    return response;
  }

  response = await send();

  return response;
}

export async function requestWithErrorHandling<T extends FieldValues>(
  response: Response,
  form: UseFormReturn<T> | null,
  onSuccess?: (result: Record<string, unknown>) => void,
  onError?: () => void,
) {
  // Expired sessions and proxy failures may return plain text or an empty body.
  const payload: unknown = await response.json().catch(() => null);
  const result = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown> : {};
  const serverMessage = typeof result.message === "string" ? result.message : undefined;

  if (response.ok) {
    toast.success(serverMessage || "Operation successful");
    onSuccess?.(result);
  } else {
    if (form !== null && result.errors && typeof result.errors === "object") {
      Object.entries(result.errors).forEach(([field, message]) => {
        form.setError(field as Path<T>, {
          type: "manual",
          message: typeof message === "string" ? message : "Invalid value",
        });
      });
    } else {
      const message = serverMessage || (response.status === 401
        ? "Your session expired. Sign in again to continue."
        : response.status === 409
          ? "This record changed. Refresh it and try again."
          : "Unable to save changes. Please try again.");
      form?.setError("root", { type: "server", message });
      toast.error(message);
    }
    onError?.();
  }
}
