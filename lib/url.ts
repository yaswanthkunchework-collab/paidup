/**
 * Public base URL used in client links and the Claude connector link.
 * On Vercel production we always use the project's public production domain, because
 * per-deployment URLs (paidup-abc123-team.vercel.app) sit behind Vercel's login wall.
 */
export function baseUrl(req?: Request | { headers: Headers }) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const h = req?.headers;
  const host = h?.get("x-forwarded-host") ?? h?.get("host");
  if (host) {
    const proto = h?.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}
