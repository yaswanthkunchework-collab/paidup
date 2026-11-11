// Shared by the browser (Editor) and the server (email route); keep it free of server-only imports.
export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function isValidEmail(v: string | null | undefined): v is string {
  return !!v && EMAIL_RE.test(v.trim());
}
