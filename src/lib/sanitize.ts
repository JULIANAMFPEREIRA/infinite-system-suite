/**
 * Sanitize text fields to uppercase before saving to the database.
 * Skips email fields (keys containing "email") and non-string values.
 */
const ENUM_KEYS = ["origem", "status_crm", "status", "tipo", "status_visita", "status_pagamento", "acao", "status_compra"];

export function sanitizePayload<T extends Record<string, any>>(
  payload: T,
  emailKeys: string[] = ["email"]
): T {
  const result = { ...payload };
  for (const key in result) {
    const val = result[key];
    if (typeof val === "string" && !emailKeys.includes(key)) {
      (result as any)[key] = val.toUpperCase();
    }
  }
  return result;
}
