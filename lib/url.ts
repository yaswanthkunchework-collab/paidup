export function baseUrl(req?: Request | { headers: Headers }) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = req?.headers;
  const host = h?.get("x-forwarded-host") ?? h?.get("host");
  if (host) {
    const proto = h?.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
