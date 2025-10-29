export const SUPPORT_EMAIL =
  import.meta?.env?.VITE_SUPPORT_EMAIL || process.env.REACT_APP_SUPPORT_EMAIL || "support@example.com";

export const PARTNER_EMAIL =
  import.meta?.env?.VITE_PARTNER_EMAIL || process.env.REACT_APP_PARTNER_EMAIL || "partners@example.com";

export function mailto(to, subject, body) {
  const q = new URLSearchParams({ subject: subject || "", body: body || "" }).toString();
  return `mailto:${to}?${q}`;
}
