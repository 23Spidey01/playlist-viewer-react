// hitbloqApi.ts — shared helpers for the backend's Hitbloq proxy
// (/proxy/*). Every call here uses a relative path, not an absolute
// http://localhost:3001 origin: the frontend is always served by the
// same Spring Boot app that serves /proxy (either directly in
// production, or via the Vite dev server's proxy config — see
// vite.config.ts). Hardcoding port 3001 only ever worked by
// coincidence of the one dev setup this was written against; any real
// deployment where the backend isn't on exactly that port would have
// silently sent every request to the wrong place.
import type { DetailedSong } from "./hitbloqTypes";

async function proxyFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/proxy/${path}`, init);
}

// Posts to one of the Hitbloq proxy endpoints and actually checks
// whether it worked. The backend proxy forwards Hitbloq's response
// body as-is with its own 200 OK regardless of whether Hitbloq itself
// accepted the request — a wrong API key, for instance, still comes
// back as an HTTP-level success with a JSON body like
// { status: "error", error: "..." }. So res.ok alone can't tell
// success from failure here; only the body's own status field can.
// Callers building an error message should fall back through
// result?.error || result?.status (not straight to a hardcoded
// string) — Hitbloq doesn't always send a separate `error` message,
// and status alone (e.g. "invalid key") is often the only text
// describing what actually went wrong.
export async function postToPool(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; result: { status?: string; error?: string } | null }> {
  const res = await proxyFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let result: { status?: string; error?: string } | null = null;
  try {
    result = await res.json();
  } catch {
    // Non-JSON body (e.g. a raw-text 500) — ok below still resolves
    // to false via res.ok.
  }
  return { ok: res.ok && result?.status === "success", result };
}

// Fetches every ranked difficulty in a pool via Hitbloq's paginated
// ranked_list_detailed. Hitbloq paginates at 30 entries/page with no
// way to know the total up front, so pages used to be fetched one at
// a time — each a ~0.7-1s round trip to hitbloq.com, which adds up to
// minutes for a big pool (crv2 runs ~97 pages). Fetch PAGE_CONCURRENCY
// pages at once instead: a page short of 30 entries (including empty)
// marks the end, so within a batch we keep everything up to and
// including the first short page, then stop — any pages after it in
// the same batch were spare/wasted requests, not data loss, since a
// short page can't be followed by a full one.
export async function fetchPoolRankedSongs(
  poolId: string,
  onBatchStart?: (fromPage: number, toPage: number) => void,
): Promise<DetailedSong[]> {
  const PAGE_CONCURRENCY = 6;
  const PAGE_SIZE = 30;
  let allSongs: DetailedSong[] = [];
  let nextPage = 0;
  let reachedEnd = false;
  while (!reachedEnd) {
    const batch = Array.from({ length: PAGE_CONCURRENCY }, (_, i) => nextPage + i);
    onBatchStart?.(batch[0], batch[batch.length - 1]);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        const res = await proxyFetch(`ranked_list_detailed/${poolId}/${page}`);
        if (!res.ok) {
          throw new Error(`Hitbloq returned ${res.status} on page ${page + 1}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? (data as DetailedSong[]) : [];
      }),
    );
    for (const pageData of batchResults) {
      allSongs = allSongs.concat(pageData);
      if (pageData.length < PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
    }
    nextPage += PAGE_CONCURRENCY;
  }
  return allSongs;
}
