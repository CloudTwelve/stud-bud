/**
 * Ingest is open when no token is configured (local development) and requires
 * `Authorization: Bearer <token>` as soon as one is set.
 */
export function ingestAuthorized(request: Request): boolean {
  const token = process.env.STUDBUD_INGEST_TOKEN?.trim();
  if (!token) return true;
  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value === token;
}
