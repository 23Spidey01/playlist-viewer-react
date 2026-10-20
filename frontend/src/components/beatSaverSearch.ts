// beatSaverSearch.ts — pure, fetch-free logic behind RankNewMaps.tsx's
// search/playlist-import flow: parsing pasted links/ids, parsing
// .bplist/.json playlist files, and re-ranking BeatSaver's own search
// results. Split out from RankNewMaps.tsx itself (which also exports
// the page's default-exported component) because a file that exports
// both breaks Vite's Fast Refresh — react-refresh/only-export-
// components flags exactly this — and because these being standalone
// functions is what makes them unit-testable without rendering
// anything. See beatSaverSearch.test.ts.
import type { BSSongInfo } from "./beatSaverTypes";

export const parseBeatSaverId = (urlOrId: string) => {
  // Extract map ID from a BeatSaver link or return it directly
  const match = urlOrId.match(/([0-9a-fA-F]{1,8})$/);
  return match ? match[1] : urlOrId.trim();
};

// A token counts as a link/ID (not a text search) if it's a BeatSaver
// URL, or if it's plausibly a bare map ID — a short hex string. Song
// searches routinely fail this (spaces, non-hex letters), so this
// rarely misfires; on the rare occasion a search word happens to be
// pure hex ("Cafe", "Dead"), resolveIdsOrLinks (RankNewMaps.tsx) just
// comes back empty and the caller falls through to the normal search.
export function looksLikeIdOrLink(token: string): boolean {
  if (/beatsaver\.com/i.test(token)) return true;
  return /^[0-9a-fA-F]{1,8}$/.test(token);
}

// BeatSaver playlists (made on the site itself, distinct from a
// .bplist/.json file) live at beatsaver.com/playlists/<numeric id> —
// checked against the whole query rather than per-token, since pasting
// one of these only really makes sense on its own. Matched separately
// from (and before) looksLikeIdOrLink above: a playlist link also
// contains "beatsaver.com", but its numeric id isn't a valid map id
// and would otherwise just fail to resolve as one.
export function extractBeatSaverPlaylistId(text: string): string | null {
  const match = text.match(/beatsaver\.com\/playlists\/(\d+)/i);
  return match ? match[1] : null;
}

export function dedupeById(songs: BSSongInfo[]): BSSongInfo[] {
  const seen = new Set<string>();
  const out: BSSongInfo[] = [];
  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    out.push(song);
  }
  return out;
}

// .bplist/.json playlist files (BeatSaver, GuildSaber, PlaylistManager,
// ScoreSaber, and every other Beat Saber playlist tool all export this
// same shape) only carry a hash per song, not the map data itself —
// fetchSongsByHashes (beatsaverApi.ts) does the actual BeatSaver lookup.
export function parsePlaylistSongHashes(fileText: string): {
  title: string;
  author: string;
  image: string | null;
  hashes: string[];
  diffsByHash: Record<string, string[]>;
} {
  const data = JSON.parse(fileText);
  if (!Array.isArray(data?.songs)) {
    throw new Error("That doesn't look like a playlist file (no songs list).");
  }
  const hashes = new Set<string>();
  const diffsByHash: Record<string, Set<string>> = {};
  for (const entry of data.songs) {
    const hash = typeof entry?.hash === "string" ? entry.hash.toUpperCase() : null;
    if (!hash) continue;
    hashes.add(hash);
    if (!Array.isArray(entry.difficulties)) continue;
    for (const diff of entry.difficulties) {
      const characteristic = diff?.characteristic;
      const name = diff?.name;
      if (typeof characteristic !== "string" || typeof name !== "string") continue;
      (diffsByHash[hash] ??= new Set()).add(`${characteristic}|${name}`);
    }
  }
  // The `image` field is a bare base64 blob (sometimes with a stray
  // "base64," prefix already on it, per the format's actual exports),
  // not a data: URI — normalized here so it can go straight into <img src>.
  let image: string | null = null;
  if (typeof data.image === "string" && data.image.length > 0) {
    image = data.image.startsWith("data:")
      ? data.image
      : `data:image/png;base64,${data.image.replace(/^base64,/, "")}`;
  }
  return {
    title: typeof data.playlistTitle === "string" ? data.playlistTitle : "Imported playlist",
    author: typeof data.playlistAuthor === "string" ? data.playlistAuthor : "",
    image,
    hashes: Array.from(hashes),
    diffsByHash: Object.fromEntries(
      Object.entries(diffsByHash).map(([hash, keys]) => [hash, Array.from(keys)]),
    ),
  };
}

// BeatSaver's own "Relevance" sort is token-level (any word anywhere in
// the metadata counts), which is exactly why "Emty Bed" comes back full
// of maps that only happen to contain "Empty" *or* "Bed" somewhere —
// buried among them, not necessarily near the top. This re-ranks the
// already-fetched results client-side: a map matching every query word
// (in the song name especially) jumps to the top, single-word
// coincidences sink toward the bottom, and BeatSaver's own order breaks
// ties — so it doesn't fight their relevance signal, just fixes the
// "which of these many hits is the one I meant" problem.
export function scoreSearchResult(song: BSSongInfo, queryWords: string[]): number {
  const fields: [string, number][] = [
    [(song.metadata?.songName || "").toLowerCase(), 8],
    [(song.metadata?.songSubName || "").toLowerCase(), 5],
    [(song.metadata?.songAuthorName || "").toLowerCase(), 3],
    [(song.metadata?.levelAuthorName || "").toLowerCase(), 2],
  ];
  let score = 0;
  for (const [text, weight] of fields) {
    if (!text) continue;
    const matchedWords = queryWords.filter((w) => text.includes(w));
    if (matchedWords.length === 0) continue;
    score += matchedWords.length * weight;
    // All query words present together in one field — much stronger
    // signal than the same total count spread thinly across fields.
    if (matchedWords.length === queryWords.length) score += weight * 6 + 25;
  }
  return score;
}

export function rankByQuery(songs: BSSongInfo[], query: string): BSSongInfo[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return songs;
  return songs
    .map((song, index) => ({ song, index, score: scoreSearchResult(song, words) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.song);
}
