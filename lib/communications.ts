import { request } from "@/components/http";

export type SmsTemplate = { id: number; name: string; content: string; variables: string[]; is_active: boolean; usage_count: number; created_at: string };
export type SmsDevice = { device_id: string; device_name: string; is_active: boolean; last_seen: string | null; total_sms: number; sent: number; failed: number };
export type SmsStats = { success: true; overall: { total: number; pending: number; processing: number; sent: number; delivered: number; failed: number; cancelled: number }; today: { total: number; sent: number; failed: number }; weekly_trend: { date: string; total: number; sent: number; failed: number }[]; per_device: SmsDevice[]; active_devices: number };
export function smsVariables(template: SmsTemplate) {
  return [...new Set([...template.variables, ...Array.from(template.content.matchAll(/{{\s*([\w.-]+)\s*}}/g), match => match[1])])];
}
export function smsPreview(template: SmsTemplate, values: Record<string, string>) {
  return template.content.replace(/{{\s*([\w.-]+)\s*}}/g, (placeholder, name: string) => typeof values[name] === "string" && values[name].trim() ? values[name].trim() : placeholder);
}
export const normalizePhone = (phone: string) => phone.replace(/[\s()-]/g, "");
export const validPhone = (phone: string) => /^\+?\d{7,15}$/.test(normalizePhone(phone));
export async function communicationRequest<T>(method: string, path: string, body?: object): Promise<T> {
  const response = await request(method, path, body);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.success !== true) throw new Error(typeof result?.message === "string" ? result.message : method === "GET" ? "This service is unavailable. Please try again." : "Submission was not confirmed. Check the sending service before trying again.");
  return result as T;
}
