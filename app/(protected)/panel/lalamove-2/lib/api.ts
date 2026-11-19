import { request } from "@/components/http";

export async function api<T>(method: string, path: string, body?: object): Promise<T> {
  const response = await request(method, `/api/lalamove${path}`, body);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to complete the operation. Refresh before retrying.");
  return data as T;
}
