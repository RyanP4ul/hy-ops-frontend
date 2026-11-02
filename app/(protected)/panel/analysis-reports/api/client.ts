import type { Filters } from "./contract";
import { toQuery } from "../lib/filters";

const API_URL = "/api";

async function request(path: string, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}${path}`, {
    signal,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? body?.error ?? `Request failed (${res.status})`);
  }
  return res;
}

/** GET /reports/<path>?<filters>[&extra]. */
export async function getReport<T>(
  path: string,
  f: Filters,
  extra: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  return (await request(`/reports${path}?${toQuery(f, extra)}`, signal)).json();
}

/** Downloads a generated file and hands it to the browser. */
export async function downloadReport(
  path: string,
  f: Filters,
  extra: Record<string, string>,
) {
  const res = await request(`/reports${path}?${toQuery(f, extra)}`);
  const name =
    /filename="([^"]+)"/.exec(
      res.headers.get("Content-Disposition") ?? "",
    )?.[1] ?? "report";
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: name,
  });
  a.click();
  URL.revokeObjectURL(url);
  return name;
}
