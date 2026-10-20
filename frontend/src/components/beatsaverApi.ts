// beatsaverApi.ts — shared helper for BeatSaver's bulk hash-lookup API
// (api.beatsaver.com/maps/hash/...), used by both SongList.tsx (to
// resolve a whole pool's ranked songs) and RankNewMaps.tsx (to resolve
// an uploaded/pasted playlist's songs). Talks to BeatSaver directly,
// not through the backend proxy — its API is CORS-open for this.
import type { BSSongInfo } from "./beatSaverTypes";

// Guards against BeatSaver's hash lookup occasionally handing back
// something that isn't a real MapDetail at all — not just the
// single-vs-multi-hash shape difference below, but any other
// unexpected body (an error payload, a partial object, etc.). Every
// render path assumes song.metadata.songName exists unconditionally,
// so letting anything else through crashes the whole page.
export function isMapDetail(value: unknown): value is BSSongInfo {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.metadata === "object" &&
    obj.metadata !== null &&
    typeof (obj.metadata as Record<string, unknown>).songName === "string"
  );
}

export interface FetchSongsByHashesResult {
  songs: BSSongInfo[];
  // Which hash was actually QUERIED to resolve each entry — not the
  // same thing as the entry's own current hash! When a map has been
  // re-uploaded, BeatSaver's hash lookup resolves the OLD hash to the
  // same MapDetail as the NEW one, and that object's own
  // versions[0].hash always reports the current/live version — so two
  // results fetched via two genuinely different hashes (old + new)
  // can come back reporting the identical versions[0].hash, making
  // them look like one plain duplicate rather than two distinct
  // entries. Keyed by object reference (each fetched entry is its own
  // distinct object even when content is identical).
  queryHashByEntry: Map<BSSongInfo, string>;
}

// Resolves a batch of hashes against BeatSaver's bulk hash-lookup
// endpoint (up to 50 hashes per request), with a small worker pool for
// concurrency and retry-with-backoff per chunk — a single rate-limited
// or briefly-failing chunk no longer silently drops its songs or
// aborts every chunk after it.
export async function fetchSongsByHashes(
  hashes: string[],
  options: {
    concurrency?: number;
    maxAttempts?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {},
): Promise<FetchSongsByHashesResult> {
  const { concurrency = 5, maxAttempts = 4, onProgress } = options;
  const CHUNK_SIZE = 50;
  const results: BSSongInfo[] = [];
  const queryHashByEntry = new Map<BSSongInfo, string>();
  const failedChunks: string[][] = [];

  const chunks: string[][] = [];
  for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
    chunks.push(hashes.slice(i, i + CHUNK_SIZE));
  }
  let completed = 0;
  let nextChunk = 0;

  const worker = async () => {
    while (true) {
      const chunkIndex = nextChunk++;
      if (chunkIndex >= chunks.length) return;
      const chunk = chunks[chunkIndex];
      const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
      let data: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`BeatSaver hash lookup failed: ${res.status}`);
          data = await res.json();
          break;
        } catch {
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          }
        }
      }
      if (data) {
        // BeatSaver's bulk hash lookup returns a {hash: MapDetail}
        // dictionary for 2+ hashes, but a BARE MapDetail (no hash
        // wrapper at all) when the chunk happens to contain exactly
        // one — which the final, smaller chunk of a hash list often
        // does. Treating that shape as a dictionary (the branch below)
        // iterates the map's own top-level fields as if each were its
        // own result, pushing garbage entries that crash every
        // .metadata.songName access on render.
        if (chunk.length === 1 && isMapDetail(data)) {
          const song = data as unknown as BSSongInfo;
          results.push(song);
          queryHashByEntry.set(song, chunk[0].toUpperCase());
        } else {
          Object.entries(data).forEach(([queryHash, info]) => {
            if (!isMapDetail(info)) return;
            const song = info as unknown as BSSongInfo;
            results.push(song);
            queryHashByEntry.set(song, queryHash.toUpperCase());
          });
        }
      } else {
        // Every retry failed — these hashes go missing from this run
        // rather than silently taking the rest of the batch down with
        // them; reported once at the end instead of per-chunk.
        failedChunks.push(chunk);
      }
      completed += chunk.length;
      onProgress?.(Math.min(completed, hashes.length), hashes.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));

  if (failedChunks.length > 0) {
    const failedCount = failedChunks.reduce((sum, c) => sum + c.length, 0);
    console.warn(
      `BeatSaver hash lookup failed for ${failedCount} hash(es) after ${maxAttempts} attempts each — ` +
        `they'll show as "not found" for this run. Reloading may pick them up if it was transient.`,
    );
  }
  return { songs: results, queryHashByEntry };
}
