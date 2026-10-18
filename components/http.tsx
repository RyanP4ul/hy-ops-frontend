import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken() {
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

  let response = await fetch(path, options);

  // If not unauthorized, return the response
  if (response.status !== 401) {
    return response;
  }

  // Refresh Access Token
  const refreshed = await refreshAccessToken();

  if (!refreshed) {
    return response;
  }

  response = await fetch(path, options);

  return response;
}

export async function requestWithErrorHandling(
  response: Response,
  form: UseFormReturn<any> | null,
  onSuccess?: (result: any) => void,
  onError?: () => void,
) {
  const result = await response.json();

  if (response.ok) {
    toast.success(result?.message || "Operation successful");
    onSuccess?.(result);
  } else {
    if (form !== null && !response.ok && result?.errors) {
      Object.entries(result.errors).forEach(([field, message]) => {
        form?.setError(field as any, {
          type: "manual",
          message: message as string,
        });
      });
    } else {
      toast.error(result?.message || "Failed to update warehouse");
    }
    onError?.();
  }
}
