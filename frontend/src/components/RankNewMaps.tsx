import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { askApiKey, alertDialog, confirmDialog, promptText } from "./dialogStore";
import AccountMenu from "./AccountMenu";
import { useSongPoolCache } from "./useSongPoolCache";
import type { BSSongInfo, BSDifficulty } from "./types";
import { characteristicIcons, characteristicLabels } from "./types";
import logo from "../assets/Logo.png";
import "./pixel-ui.css";

const parseBeatSaverId = (urlOrId: string) => {
  // Extract map ID from a BeatSaver link or return it directly
  const match = urlOrId.match(/([0-9a-fA-F]{1,8})$/);
  return match ? match[1] : urlOrId.trim();
};


export interface BSMapper {
  id: number;
  name: string;
  avatar: string;
}

// Module-level (not component closures) on purpose: they only depend on
// their own arguments, so calling them from inside the debounced search
// effect below doesn't need to be listed in that effect's deps array —
// same reason parseBeatSaverId above is a plain function instead of
// something defined inside the component.

// BeatSaver's free-text search indexes song/level metadata (title,
// subtitle, description, level author name) — it's a relevance search,
// not an exact lookup, so searching an uploader's exact username can
// come back thin or empty even when they've got dozens of maps up.
// checkMapperMatch (below) is tried first for that reason; this is the
// fallback once that comes back empty.
async function fetchBeatSaverSearchPage(
  page: number,
  query: string,
  includeAI: boolean,
): Promise<BSSongInfo[]> {
  // BeatSaver's automapper filter isn't a plain "show/hide AI maps"
  // toggle: confirmed empirically (real search responses, not docs)
  // that automapper=false means "ONLY AI maps", automapper=true means
  // "normal maps, with AI ones mixed back in when they're relevant",
  // and omitting it entirely is the cleanest "exclude AI" — closer to
  // 0% AI than automapper=true's small leak. So this isn't a boolean
  // pass-through: only send the param at all once the box is actually
  // checked.
  const automapperParam = includeAI ? "&automapper=true" : "";
  const url =
    `https://api.beatsaver.com/search/text/${page}?q=${encodeURIComponent(query.trim())}` +
    `&sortOrder=${query.trim() ? "Relevance" : "Latest"}${automapperParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`BeatSaver search failed: ${res.status}`);
  const data = await res.json();
  return (data.docs || []) as BSSongInfo[];
}

// Resolves the query as an exact BeatSaver account username — if it
// matches one, every map they've ever uploaded is available directly
// (not subject to the text search's relevance ranking or thin
// matching), via the dedicated per-uploader endpoint below.
async function checkMapperMatch(username: string): Promise<BSMapper | null> {
  try {
    const res = await fetch(
      `https://api.beatsaver.com/users/name/${encodeURIComponent(username)}`,
    );
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return { id: user.id, name: user.name, avatar: user.avatar };
  } catch {
    return null;
  }
}

async function fetchMapperMapsPage(mapperId: number, page: number): Promise<BSSongInfo[]> {
  const res = await fetch(`https://api.beatsaver.com/maps/uploader/${mapperId}/${page}`);
  if (!res.ok) throw new Error(`BeatSaver uploader maps failed: ${res.status}`);
  const data = await res.json();
  // The docs say this returns a bare array rather than search's
  // { docs, info } wrapper — handled defensively either way.
  return (Array.isArray(data) ? data : data.docs || []) as BSSongInfo[];
}

// A token counts as a link/ID (not a text search) if it's a BeatSaver
// URL, or if it's plausibly a bare map ID — a short hex string. Song
// searches routinely fail this (spaces, non-hex letters), so this
// rarely misfires; on the rare occasion a search word happens to be
// pure hex ("Cafe", "Dead"), resolveIdsOrLinks below just comes back
// empty and the caller falls through to the normal search.
function looksLikeIdOrLink(token: string): boolean {
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
function extractBeatSaverPlaylistId(text: string): string | null {
  const match = text.match(/beatsaver\.com\/playlists\/(\d+)/i);
  return match ? match[1] : null;
}

// Resolves one or more pasted links/IDs directly, in parallel — lets
// the main search bar double as the old "paste links, one per line"
// box instead of that living in a separate hidden-away tab. Tokens
// that don't resolve (typo, deleted map) are just dropped, same as the
// old bulk-paste flow silently skipped them.
async function resolveIdsOrLinks(tokens: string[]): Promise<BSSongInfo[]> {
  const ids = tokens.map(parseBeatSaverId).filter(Boolean);
  const resolved = await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`https://api.beatsaver.com/maps/id/${id}`);
        if (!res.ok) return null;
        return (await res.json()) as BSSongInfo;
      } catch {
        return null;
      }
    }),
  );
  return dedupeById(resolved.filter((song): song is BSSongInfo => song !== null));
}

function dedupeById(songs: BSSongInfo[]): BSSongInfo[] {
  const seen = new Set<string>();
  const out: BSSongInfo[] = [];
  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    out.push(song);
  }
  return out;
}

export interface ImportedPlaylist {
  title: string;
  author: string;
  image: string | null;
  resolved: BSSongInfo[];
  unresolvedCount: number;
  // Hash (uppercase) -> "characteristic|difficulty" keys, matching the
  // `selected` state's own key format — the difficulties a playlist
  // entry actually lists, i.e. the ones BeatSaver highlights when you
  // pick that playlist there. See addSongFromPlaylist.
  diffsByHash: Record<string, string[]>;
}

// .bplist/.json playlist files (BeatSaver, GuildSaber, PlaylistManager,
// ScoreSaber, and every other Beat Saber playlist tool all export this
// same shape) only carry a hash per song, not the map data itself —
// fetchSongsByHashes below does the actual BeatSaver lookup.
function parsePlaylistSongHashes(fileText: string): {
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

// Same chunked-hash-lookup pattern SongList.tsx uses to resolve a
// pool's own songs — BeatSaver's hash endpoint takes up to ~50 at once.
async function fetchSongsByHashes(hashes: string[]): Promise<BSSongInfo[]> {
  const CHUNK_SIZE = 50;
  const results: BSSongInfo[] = [];
  for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
    const chunk = hashes.slice(i, i + CHUNK_SIZE).map((h) => h.toLowerCase());
    const res = await fetch(`https://api.beatsaver.com/maps/hash/${chunk.join(",")}`);
    if (!res.ok) continue;
    const data = await res.json();
    results.push(...(Object.values(data).filter(Boolean) as BSSongInfo[]));
  }
  return dedupeById(results);
}

// Loads a BeatSaver-hosted playlist (beatsaver.com/playlists/<id>) via
// the paginated /playlists/id/{id}/{page} API — NOT the site's
// "download" link (…/playlists/id/{id}/download), which is meant for
// a browser to navigate straight to as a file save and isn't set up
// for cross-origin fetch()/XHR the way the rest of api.beatsaver.com
// is, so it fails with an opaque "Failed to fetch" no matter what
// playlist you point it at. This endpoint already hands back full map
// objects per entry (not just hashes), so there's no extra
// fetchSongsByHashes round trip needed the way the file-upload path
// requires.
async function fetchBeatSaverPlaylistMaps(playlistId: string): Promise<{
  title: string;
  author: string;
  image: string | null;
  resolved: BSSongInfo[];
  diffsByHash: Record<string, string[]>;
}> {
  let title = "Imported playlist";
  let author = "";
  let image: string | null = null;
  const resolved: BSSongInfo[] = [];
  const diffsByHash: Record<string, Set<string>> = {};

  // Paged the same way BeatSaver's other listing endpoints are;
  // capped so a malformed/looping response can't hang forever.
  for (let page = 0; page < 50; page++) {
    const res = await fetch(`https://api.beatsaver.com/playlists/id/${playlistId}/${page}`);
    if (!res.ok) {
      if (page === 0) throw new Error(`Couldn't load that BeatSaver playlist (${res.status}).`);
      break;
    }
    const data = await res.json();
    if (page === 0) {
      title = data?.playlist?.name || data?.playlist?.title || title;
      author = data?.playlist?.owner?.name || data?.playlist?.curator?.name || author;
      image = data?.playlist?.playlistImage || data?.playlist?.playlistImage512 || null;
    }
    const entries: unknown[] = Array.isArray(data?.maps) ? data.maps : [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const record = entry as Record<string, unknown>;
      const map = (record?.map ?? entry) as BSSongInfo;
      if (!map?.id) continue;
      resolved.push(map);

      // The playlist can highlight specific difficulties per song —
      // same idea as a .bplist file's own per-song `difficulties`
      // list (see parsePlaylistSongHashes) — carried over here too so
      // adding a song from this panel auto-selects the same ones.
      const hash = map.versions?.[0]?.hash?.toUpperCase();
      const diffs = record?.difficulties;
      if (hash && Array.isArray(diffs)) {
        for (const d of diffs) {
          const diffRecord = d as Record<string, unknown>;
          const characteristic = diffRecord?.characteristic;
          const name = diffRecord?.name ?? diffRecord?.difficulty;
          if (typeof characteristic === "string" && typeof name === "string") {
            (diffsByHash[hash] ??= new Set()).add(`${characteristic}|${name}`);
          }
        }
      }
    }
  }

  return {
    title,
    author,
    image,
    resolved: dedupeById(resolved),
    diffsByHash: Object.fromEntries(
      Object.entries(diffsByHash).map(([hash, keys]) => [hash, Array.from(keys)]),
    ),
  };
}

// How many pages of BeatSaver's own "Relevance" order get pulled up
// front for a text query, before the client-side re-rank below even
// runs. BeatSaver's relevance sort blends text match with popularity —
// a low-play personal map with an exact title match can still land
// many pages deep, behind bigger maps that only share one loose word.
// Fetched in parallel (Promise.all below), so this costs about one
// request's worth of latency, not five — not a sequential crawl.
const TEXT_SEARCH_PAGES = 5;

// Pulls a wide net of text-search candidates for the re-rank in
// rankByQuery to actually have a shot at working: BeatSaver's own top
// page alone is often just the popularity-biased ordering, not
// necessarily where an exact-but-obscure match lives.
async function fetchTextSearchCandidates(
  query: string,
  includeAI: boolean,
): Promise<{ docs: BSSongInfo[]; lastPage: number; hasMore: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) {
    const docs = await fetchBeatSaverSearchPage(0, query, includeAI);
    return { docs, lastPage: 0, hasMore: docs.length > 0 };
  }
  const pageFetches = Array.from({ length: TEXT_SEARCH_PAGES }, (_, page) =>
    fetchBeatSaverSearchPage(page, trimmed, includeAI).catch(() => []),
  );
  // Most text search backends weight an exact quoted phrase far more
  // heavily than loose word overlap — fetched alongside the plain
  // pages in case BeatSaver's does too. If it doesn't special-case
  // quotes, this just contributes the same results again, harmlessly
  // deduped away below.
  const phraseFetch = fetchBeatSaverSearchPage(0, `"${trimmed}"`, includeAI).catch(() => []);
  const pages = await Promise.all([...pageFetches, phraseFetch]);
  const lastPlainPage = pages[TEXT_SEARCH_PAGES - 1];
  return {
    docs: dedupeById(pages.flat()),
    lastPage: TEXT_SEARCH_PAGES - 1,
    hasMore: lastPlainPage.length > 0,
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
function scoreSearchResult(song: BSSongInfo, queryWords: string[]): number {
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

function rankByQuery(songs: BSSongInfo[], query: string): BSSongInfo[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return songs;
  return songs
    .map((song, index) => ({ song, index, score: scoreSearchResult(song, words) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.song);
}

// Wraps every occurrence of any query word in `text` so a search hit is
// visually obvious at a glance — same reason as the re-ranking above:
// with a page full of loose token matches, seeing *why* each one
// matched is what actually makes the real target easy to spot.
function highlightQueryMatches(text: string, words: string[]): React.ReactNode {
  if (!text || words.length === 0) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    words.includes(part.toLowerCase()) ? (
      <mark key={i} className="pixel-search-hit">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

// One BeatSaver map, in either the search results or the playlist
// import panel — shared so both stay visually/behaviorally identical.
// Position in the currently rendered list, used to stagger the fly-in
// into a quick wave (same idea as SongCard.tsx's own index prop) —
// capped so a big playlist/result page doesn't take forever to finish.
const MapResultRow: React.FC<{
  song: BSSongInfo;
  added: boolean;
  inPool: boolean;
  highlightWords: string[];
  onAdd: () => void;
  index?: number;
}> = ({ song, added, inPool, highlightWords, onAdd, index = 0 }) => {
  // One dot per difficulty actually on this map (not per diff — a map
  // with Standard+OneSaber Expert only shows one "Expert" dot, not
  // two), in a fixed order so the same difficulty always lands in the
  // same spot across different rows.
  const availableDiffs = Array.from(
    new Set((song.versions?.[0]?.diffs || []).map((d) => d.difficulty)),
  ).sort(
    (a, b) =>
      ["Easy", "Normal", "Hard", "Expert", "ExpertPlus"].indexOf(a) -
      ["Easy", "Normal", "Hard", "Expert", "ExpertPlus"].indexOf(b),
  );

  return (
    <div
      className={`pixel-search-row pixel-page-flyin${added ? " added" : ""}`}
      style={{ animationDelay: `${0.2 + Math.min(index, 16) * 0.03}s` }}
    >
      <img
        src={song.versions?.[0]?.coverURL}
        alt={song.metadata.songName}
        className="pixel-cover w-12 h-12 object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-cyan-200 truncate">
            {highlightWords.length > 0
              ? highlightQueryMatches(song.metadata.songName, highlightWords)
              : song.metadata.songName}
          </span>
          {inPool && <span className="pool-tag">IN POOL</span>}
        </div>
        <div className="text-xs text-[#b7c0d6] truncate">
          {highlightWords.length > 0
            ? highlightQueryMatches(song.metadata.songAuthorName, highlightWords)
            : song.metadata.songAuthorName}
        </div>
        <div className="text-[11px] text-[#6a7690] truncate">
          mapped by{" "}
          {highlightWords.length > 0
            ? highlightQueryMatches(song.uploader?.name || "", highlightWords)
            : song.uploader?.name}
        </div>
        <div className="pixel-diff-dots">
          {availableDiffs.map((d) => (
            <span key={d} className={`pixel-diff-dot diff-${d}`} title={d} />
          ))}
        </div>
      </div>
      <button
        className={`pixel-add-btn${added ? " added" : ""}`}
        onClick={onAdd}
        disabled={added}
        title={added ? "Already queued" : "Add to rank queue"}
      >
        {added ? "✓" : "+"}
      </button>
    </div>
  );
};

// One queued song in the sticky rank-queue sidebar. Compact: each
// difficulty is a small badge (same .pixel-badge/.pixel-badge-
// selectable pills SongCard.tsx's own diff list uses), not a full
// tile — a selected one just widens to fit an inline rating box.
// That box IS the automatic/manual choice: left empty (shows the
// grayed-out "AUTO" placeholder), Hitbloq calculates the rating
// itself; typed a number, that's used as a manual rating instead. No
// separate automatic/manual dropdown to keep in sync with it.
const StagedSongCard: React.FC<{
  song: BSSongInfo;
  selectedDiffs: string[];
  diffOptions: Record<string, string>;
  onToggleDiff: (diffKey: string) => void;
  onOptionsChange: (diffKey: string, rating: string) => void;
  onRemove: () => void;
  index?: number;
}> = ({
  song,
  selectedDiffs,
  diffOptions,
  onToggleDiff,
  onOptionsChange,
  onRemove,
  index = 0,
}) => {
  const grouped: Record<string, BSDifficulty[]> = {};
  (song.versions?.[0]?.diffs || []).forEach((diff) => {
    (grouped[diff.characteristic] ??= []).push(diff);
  });

  return (
    <div
      className="pixel-queue-card pixel-page-flyin"
      // Each newly-added song pops into the queue with its own quick
      // fly-in, capped so adding a big batch (e.g. "Add All New" from
      // a playlist) doesn't take forever to finish landing.
      style={{ animationDelay: `${Math.min(index, 12) * 0.05}s` }}
    >
      <div className="flex items-center gap-3">
        <img
          src={song.versions?.[0]?.coverURL}
          alt={song.metadata.songName}
          className="pixel-cover w-10 h-10 object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-cyan-200 truncate">{song.metadata.songName}</div>
          <div className="text-[11px] text-[#6a7690]">
            {selectedDiffs.length} selected
          </div>
        </div>
        <button className="pixel-remove-btn" onClick={onRemove} title="Remove from queue">
          ✕
        </button>
      </div>

      {Object.entries(grouped).map(([characteristic, characteristicDiffs]) => (
        <div key={characteristic} className="pixel-queue-char-row">
          {characteristicIcons[characteristic] && (
            <img
              src={characteristicIcons[characteristic]}
              alt={characteristicLabels[characteristic] || characteristic}
              title={characteristicLabels[characteristic] || characteristic}
            />
          )}
          <div className="diffs">
            {characteristicDiffs.map((diff) => {
              const diffKey = `${characteristic}|${diff.difficulty}`;
              const checked = selectedDiffs.includes(diffKey);
              const rating = diffOptions[diffKey] ?? "";
              return (
                <span
                  key={diffKey}
                  className={`pixel-badge diff-${diff.difficulty} pixel-badge-selectable${checked ? " selected" : ""}`}
                  onClick={() => onToggleDiff(diffKey)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleDiff(diffKey);
                    }
                  }}
                >
                  {diff.difficulty}
                  {checked && (
                    // Stopping propagation (not the whole badge) so
                    // typing here doesn't also deselect the diff —
                    // clicking the badge text itself still does.
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="AUTO"
                      className="pixel-input pixel-badge-inline-input"
                      value={rating}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onOptionsChange(diffKey, e.target.value)}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const RankNewMaps: React.FC = () => {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const { cache } = useSongPoolCache();

  // -- BeatSaver search/browse: the actual replacement for manually
  //    copy-pasting links. Empty query browses the latest uploads
  //    instead of showing nothing, so there's always something to pick
  //    from without typing anything first. --
  const [activeTab, setActiveTab] = useState<"search" | "import">("search");
  const [query, setQuery] = useState("");
  const [includeAI, setIncludeAI] = useState(false);
  // Mirrors the playlist panel's own "only show maps not already in
  // this pool" checkbox, but as a toggle button for the search panel —
  // see poolHashes/isNewToPool below for the actual check.
  const [hideInPool, setHideInPool] = useState(false);
  const [results, setResults] = useState<BSSongInfo[]>([]);
  const [resultsPage, setResultsPage] = useState(0);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [searchError, setSearchError] = useState(false);
  // Set once the current query exactly matches a BeatSaver account —
  // results then come from that account's own uploads (fetchMapperMapsPage)
  // instead of the text search, which searches map metadata and doesn't
  // reliably surface every map by a given uploader. See checkMapperMatch.
  const [mapper, setMapper] = useState<BSMapper | null>(null);
  // Lets someone bypass a mapper match and fall back to the plain text
  // search instead, in case the query matched a username they didn't
  // actually mean as one. Reset whenever the query itself changes.
  const [forceTextSearch, setForceTextSearch] = useState(false);
  // True when the current results came from pasting a BeatSaver
  // link/ID (or several) directly into the search bar rather than from
  // a text search or mapper lookup — see looksLikeIdOrLink below.
  const [resolvedDirectly, setResolvedDirectly] = useState(false);
  // Bumped on every new search kicked off; a response is only applied
  // if it's still the most recent one requested, so a slow earlier
  // search landing after a newer one can't clobber its results.
  const searchSeq = useRef(0);

  // -- Songs staged to actually rank, and their per-difficulty options
  //    — fed by either the search results above or the manual paste
  //    fallback below. --
  const [songs, setSongs] = useState<BSSongInfo[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  // song.id -> diffKey -> rating text. Empty (or missing) means
  // automatic — Hitbloq calculates the rating itself; a non-empty
  // value is used as a manual rating instead. No separate automatic/
  // manual flag: whether the box has something typed in it *is* the
  // choice.
  const [diffOptions, setDiffOptions] = useState<Record<string, Record<string, string>>>({});
  const [ranking, setRanking] = useState(false);
  // What handleBatchRank is doing right now + how far through the
  // selected difficulties it is — each diff can involve a retry with a
  // multi-second delay (see postToPoolWithRetry), so a bare "Ranking..."
  // gives no sense that anything's actually happening.
  const [rankStage, setRankStage] = useState("");
  const [rankProgress, setRankProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  // -- Playlist import (.bplist/.json) --
  const playlistFileInputRef = useRef<HTMLInputElement>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<ImportedPlaylist | null>(null);
  const [isDraggingPlaylist, setIsDraggingPlaylist] = useState(false);
  const [showOnlyNewFromPlaylist, setShowOnlyNewFromPlaylist] = useState(true);

  const stagedIds = new Set(songs.map((s) => s.id));
  // Hashes already present somewhere in this pool, if its song list has
  // been loaded/cached already (SongList.tsx populates this cache) —
  // purely an informational "IN POOL" tag on search results, not a hard
  // dependency (a song can still have un-ranked diffs worth adding).
  const poolHashes = new Set(
    poolId
      ? (cache[poolId]?.bsSongs || []).map((s) => s.versions?.[0]?.hash?.toUpperCase())
      : [],
  );
  const isNewToPool = (song: BSSongInfo) => {
    const hash = song.versions?.[0]?.hash?.toUpperCase();
    return !hash || !poolHashes.has(hash);
  };
  const newFromPlaylist = playlist ? playlist.resolved.filter(isNewToPool) : [];
  const visiblePlaylistSongs = playlist
    ? showOnlyNewFromPlaylist
      ? newFromPlaylist
      : playlist.resolved
    : [];

  // Shared by both ways a playlist gets loaded — a dropped/browsed
  // .bplist/.json file, or a beatsaver.com/playlists/<id> link pasted
  // into the search bar — since BeatSaver's playlist download endpoint
  // hands back that exact same file shape (see
  // fetchBeatSaverPlaylistBplist above).
  const applyParsedPlaylist = useCallback(async (rawText: string) => {
    const parsed = parsePlaylistSongHashes(rawText);
    if (parsed.hashes.length === 0) {
      throw new Error("This playlist doesn't have any songs in it.");
    }
    const resolved = await fetchSongsByHashes(parsed.hashes);
    setPlaylist({
      title: parsed.title,
      author: parsed.author,
      image: parsed.image,
      resolved,
      unresolvedCount: parsed.hashes.length - resolved.length,
      diffsByHash: parsed.diffsByHash,
    });
  }, []);

  const handlePlaylistFile = async (file: File) => {
    setPlaylistLoading(true);
    setPlaylistError(null);
    setPlaylist(null);
    try {
      await applyParsedPlaylist(await file.text());
    } catch (err) {
      setPlaylistError(
        err instanceof Error ? err.message : "Couldn't read that playlist file.",
      );
    } finally {
      setPlaylistLoading(false);
    }
  };

  // Stabilized (useCallback) since it's called from the debounced
  // search effect below — needs a stable identity to be a legitimate
  // effect dependency instead of triggering the "missing dependency"
  // lint rule by way of just being suppressed. No shared
  // applyParsedPlaylist here (unlike handlePlaylistFile above) — the
  // JSON API used by fetchBeatSaverPlaylistMaps already hands back
  // full map objects, so there's nothing left to resolve.
  const handlePlaylistUrl = useCallback(async (playlistId: string) => {
    setPlaylistLoading(true);
    setPlaylistError(null);
    setPlaylist(null);
    try {
      const data = await fetchBeatSaverPlaylistMaps(playlistId);
      setPlaylist({
        title: data.title,
        author: data.author,
        image: data.image,
        resolved: data.resolved,
        unresolvedCount: 0,
        diffsByHash: data.diffsByHash,
      });
    } catch (err) {
      setPlaylistError(
        err instanceof Error ? err.message : "Couldn't load that BeatSaver playlist.",
      );
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  useEffect(() => {
    const seq = ++searchSeq.current;
    setResultsLoading(true);
    setSearchError(false);
    const handle = setTimeout(async () => {
      try {
        const trimmed = query.trim();

        // A beatsaver.com/playlists/<id> link (a playlist made on the
        // site itself, distinct from an uploaded .bplist file) goes
        // straight to the Import a Playlist panel above instead of
        // into these search results — same reasoning as the map
        // link/ID case below, just for a whole playlist at once.
        const pastedPlaylistId = extractBeatSaverPlaylistId(trimmed);
        if (pastedPlaylistId) {
          await handlePlaylistUrl(pastedPlaylistId);
          if (seq !== searchSeq.current) return;
          setMapper(null);
          setResolvedDirectly(false);
          setResults([]);
          setResultsPage(0);
          setHasMoreResults(false);
          return;
        }

        const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
        const looksLikeIds = tokens.length > 0 && tokens.every(looksLikeIdOrLink);

        // Pasted link(s)/ID(s) go straight to BeatSaver's per-map
        // lookup — bypasses the mapper check and text search entirely,
        // so a pasted link is never at the mercy of relevance ranking.
        // If none of them actually resolve (e.g. a stray word that
        // just happens to look hex-ish), this falls through to the
        // normal search below instead of showing "no maps found".
        if (looksLikeIds) {
          const resolved = await resolveIdsOrLinks(tokens);
          if (seq !== searchSeq.current) return;
          if (resolved.length > 0) {
            setMapper(null);
            setResolvedDirectly(true);
            setResults(resolved);
            setResultsPage(0);
            setHasMoreResults(false);
            return;
          }
        }
        setResolvedDirectly(false);

        const matchedMapper = trimmed && !forceTextSearch ? await checkMapperMatch(trimmed) : null;
        if (seq !== searchSeq.current) return;

        if (matchedMapper) {
          const docs = await fetchMapperMapsPage(matchedMapper.id, 0);
          if (seq !== searchSeq.current) return;
          setMapper(matchedMapper);
          setResults(docs);
          setResultsPage(0);
          setHasMoreResults(docs.length > 0);
          return;
        }

        // Browsing with an empty query has no ranking to do — left in
        // BeatSaver's own (chronological "Latest") order. An actual
        // query pulls a much wider candidate pool first — see
        // fetchTextSearchCandidates for why the first page or two
        // alone isn't enough.
        const { docs, lastPage, hasMore } = await fetchTextSearchCandidates(query, includeAI);
        if (seq !== searchSeq.current) return;
        setMapper(null);
        setResults(trimmed ? rankByQuery(docs, trimmed) : docs);
        setResultsPage(lastPage);
        setHasMoreResults(hasMore);
      } catch {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setMapper(null);
        setResolvedDirectly(false);
        setSearchError(true);
      } finally {
        if (seq === searchSeq.current) setResultsLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query, includeAI, forceTextSearch, handlePlaylistUrl]);

  const handleLoadMoreResults = async () => {
    const nextPage = resultsPage + 1;
    const trimmed = query.trim();
    setResultsLoading(true);
    try {
      const docs = mapper
        ? await fetchMapperMapsPage(mapper.id, nextPage)
        : await fetchBeatSaverSearchPage(nextPage, query, includeAI);
      setResultsPage(nextPage);
      setHasMoreResults(docs.length > 0);
      // Re-rank against the whole accumulated set, not just the new
      // page, so a strong match that just arrived still floats above
      // weaker ones already on screen instead of only being sorted
      // within its own page.
      setResults((old) => {
        const merged = dedupeById([...old, ...docs]);
        return mapper || !trimmed ? merged : rankByQuery(merged, trimmed);
      });
    } catch {
      setHasMoreResults(false);
    } finally {
      setResultsLoading(false);
    }
  };

  const addSong = (song: BSSongInfo) => {
    setSongs((old) => (old.some((s) => s.id === song.id) ? old : [...old, song]));
  };

  // Same as addSong, but for a song coming from the playlist panel: on
  // first add, also pre-checks whichever difficulties that playlist
  // entry actually listed — the same ones BeatSaver itself highlights
  // when you pick that playlist there — instead of leaving every diff
  // unselected the way a plain search result does.
  const addSongFromPlaylist = (song: BSSongInfo) => {
    const alreadyStaged = stagedIds.has(song.id);
    addSong(song);
    // Already queued from somewhere else — leave whatever selection is
    // already there alone rather than clobbering it.
    if (alreadyStaged) return;

    const hash = song.versions?.[0]?.hash?.toUpperCase();
    const highlighted = hash ? playlist?.diffsByHash[hash] : undefined;
    if (!highlighted || highlighted.length === 0) return;

    // Only pre-select difficulties that actually exist on the map as
    // BeatSaver has it now — a playlist can point at one that's since
    // been removed or renamed.
    const realDiffKeys = new Set(
      (song.versions?.[0]?.diffs || []).map((d) => `${d.characteristic}|${d.difficulty}`),
    );
    const toSelect = highlighted.filter((key) => realDiffKeys.has(key));
    if (toSelect.length === 0) return;

    setSelected((old) => ({ ...old, [song.id]: toSelect }));
    setDiffOptions((old) => ({
      ...old,
      [song.id]: Object.fromEntries(toSelect.map((key) => [key, ""])),
    }));
  };

  const removeSong = (id: string) => {
    setSongs((old) => old.filter((s) => s.id !== id));
    setSelected((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setDiffOptions((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  };

  const handleClearQueue = async () => {
    if (songs.length === 0) return;
    const ok = await confirmDialog(
      `Clear all ${songs.length} queued song${songs.length === 1 ? "" : "s"}? This doesn't undo any ranking already done — just empties this list.`,
      { okLabel: "Clear All", danger: true },
    );
    if (!ok) return;
    setSongs([]);
    setSelected({});
    setDiffOptions({});
  };

  // Bulk-overwrites the rating box for every difficulty currently
  // selected across the whole queue — a one-shot "apply now" action,
  // not a default that only affects future picks (that's what this
  // replaced; nothing here touches diffs picked after this runs).
  const handleSetRatingForAll = async () => {
    const selectedCount = Object.values(selected).reduce((sum, d) => sum + d.length, 0);
    if (selectedCount === 0) return;

    const input = await promptText(
      `Set a star rating for all ${selectedCount} selected difficult${selectedCount === 1 ? "y" : "ies"}:`,
      { placeholder: "e.g. 6.5" },
    );
    if (input === null) return;

    const trimmed = input.trim();
    if (trimmed) {
      const ratingNum = parseFloat(trimmed.replace(",", "."));
      if (isNaN(ratingNum) || ratingNum < 0) {
        await alertDialog("Enter a valid star rating (or leave it empty for Automatic).");
        return;
      }
    }

    setDiffOptions((old) => {
      const next = { ...old };
      for (const song of songs) {
        const diffKeys = selected[song.id] || [];
        if (diffKeys.length === 0) continue;
        next[song.id] = { ...next[song.id] };
        for (const diffKey of diffKeys) {
          next[song.id][diffKey] = trimmed;
        }
      }
      return next;
    });
  };

  // Rank all selected difficulties — unchanged from before; only where
  // `songs` comes from (search vs. manual paste) changed above.
  // Posts to one of the Hitbloq proxy endpoints and actually checks
  // whether it worked. The backend proxy forwards Hitbloq's response
  // body as-is with its own 200 OK regardless of whether Hitbloq
  // itself accepted the request (see HitbloqProxyController's
  // parseLikeOriginalExpressProxy) — a wrong API key, for instance,
  // still comes back as an HTTP-level success with a JSON body like
  // { status: "error", error: "..." }. So res.ok alone can't tell
  // success from failure here; only the body's own status field can,
  // same check SongInfo.tsx already makes for its single-diff actions.
  // Callers building an error message should fall back through
  // result?.error || result?.status (not straight to a hardcoded
  // string) — Hitbloq doesn't always send a separate `error` message,
  // and status alone (e.g. "invalid key") is often the only text
  // describing what actually went wrong.
  const postToPool = async (path: string, body: unknown) => {
    const res = await fetch(`http://localhost:3001/proxy/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let result: { status?: string; error?: string } | null = null;
    try {
      result = await res.json();
    } catch {
      // Non-JSON body (e.g. a raw-text 500) — leave result null, ok
      // below still correctly resolves to false via res.ok.
    }
    return { ok: res.ok && result?.status === "success", result };
  };

  // Hitbloq doesn't know about a map it's never seen before, and
  // rejects the very first call about it — on ANY of rank/set_automatic/
  // set_manual, not just rank — with "invalid song ID". A rank call
  // that then succeeds is apparently what makes Hitbloq go fetch/cache
  // the map, but that doesn't mean the star-rating call right after it
  // is safe: it can independently hit the exact same "just learned
  // about this" gap and fail on its own, even though the rank right
  // before it worked — leaving the map ranked but stuck at whatever
  // default star rating Hitbloq gives an unrated map, with no error
  // surfaced for the rank step itself. Retrying here, not just for
  // rank, closes that gap.
  const RETRY_DELAYS_MS = [1500, 3000];
  const postToPoolWithRetry = async (path: string, body: unknown) => {
    let result = await postToPool(path, body);
    for (const delay of RETRY_DELAYS_MS) {
      if (result.ok) break;
      const message = (result.result?.error || result.result?.status || "").toLowerCase();
      if (!message.includes("invalid song id")) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      result = await postToPool(path, body);
    }
    return result;
  };

  const handleBatchRank = async () => {
    if (!poolId) return;
    const key = await askApiKey(poolId);
    if (!key) return alertDialog("No API key entered.");
    setRanking(true);
    let count = 0;
    let processed = 0;
    const errors: string[] = [];
    const total = totalSelected;
    setRankProgress({ current: 0, total });
    const advance = () => {
      processed++;
      setRankProgress({ current: processed, total });
    };

    for (const song of songs) {
      const hash = song.versions?.[0]?.hash?.toUpperCase();
      const diffs = selected[song.id] || [];
      for (const diff of diffs) {
        const [characteristic, difficulty] = diff.split("|");
        const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
        const label = `${song.metadata.songName} ${difficulty}`;
        setRankStage(label);

        // 1. Rank
        const rankResult = await postToPoolWithRetry("rank", { key, pool: poolId, song: formattedId });
        if (!rankResult.ok) {
          errors.push(`${label}: ${rankResult.result?.error || rankResult.result?.status || "failed to rank"}`);
          advance();
          continue;
        }

        // 2. Set star rating — an empty box means automatic; anything
        // typed in it is used as a manual rating instead.
        const ratingText = (diffOptions[song.id]?.[diff] ?? "").trim();
        let starResult;
        if (!ratingText) {
          starResult = await postToPoolWithRetry("set_automatic", { key, pool: poolId, song: formattedId });
        } else {
          const ratingNum = parseFloat(ratingText.replace(",", "."));
          if (isNaN(ratingNum) || ratingNum < 0) {
            errors.push(`${label}: invalid star rating, skipped`);
            advance();
            continue;
          }
          starResult = await postToPoolWithRetry("set_manual", {
            key,
            pool: poolId,
            song: formattedId,
            rating: ratingNum,
          });
        }
        if (!starResult.ok) {
          errors.push(`${label}: ${starResult.result?.error || starResult.result?.status || "failed to set star rating"}`);
          advance();
          continue;
        }
        count++;
        advance();
      }
    }

    // CR recalculate — only worth attempting if something actually got
    // ranked above.
    let crFailed = false;
    if (count > 0) {
      setRankStage("Recalculating CR...");
      const crResult = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !crResult.ok;
      if (crFailed)
        errors.push(`CR recalculation: ${crResult.result?.error || crResult.result?.status || "failed"}`);
    }

    setRanking(false);
    setRankStage("");
    setRankProgress(null);

    if (count === 0) {
      await alertDialog(
        `Nothing was ranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }

    await alertDialog(
      `${count} difficult${count === 1 ? "y" : "ies"} ranked` +
        (crFailed ? " (CR recalculation failed)" : " and CR recalculated") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    navigate(`/pool/${poolId}`);
  };

  const totalSelected = Object.values(selected).reduce((sum, d) => sum + d.length, 0);
  // Only highlight when the results are actually a text-relevance
  // match against these words — not while browsing (no query), viewing
  // a specific mapper's uploads, or showing maps resolved directly from
  // a pasted link/ID (nothing meaningful to highlight in any of those).
  const highlightWords =
    !mapper && !resolvedDirectly && query.trim()
      ? query.trim().toLowerCase().split(/\s+/).filter(Boolean)
      : [];
  const pastedPlaylistId = extractBeatSaverPlaylistId(query.trim());
  const visibleResults = hideInPool ? results.filter(isNewToPool) : results;

  return (
    <>
      {/* Same topbar recipe as SongInfo.tsx/PoolSongListPage — logo,
          breadcrumb, a "◂ BACK TO ..." pixel-tab link pinned to the
          right — instead of a standalone Back button sitting in the
          page content, which was the one page not matching this. */}
      <div className="pixel-topbar">
        <Link to="/" className="pixel-icon-btn shrink-0">
          <img
            src={logo}
            alt="Hitbloq Pool Manager"
            className="h-9 w-auto"
            style={{ imageRendering: "pixelated" }}
          />
        </Link>
        {poolId && (
          <span className="text-xs text-[#6a7690]">
            /{" "}
            <Link to={`/pool/${poolId}`} className="text-cyan-300">
              {poolId}
            </Link>{" "}
            / <span className="text-[#b7c0d6]">Rank New Maps</span>
          </span>
        )}
        <div className="flex-1" />
        <Link
          to={poolId ? `/pool/${poolId}` : "/"}
          className="pixel-tab"
          style={{ color: "#b7c0d6" }}
        >
          ◂ BACK TO POOL
        </Link>
        <AccountMenu />
      </div>

      <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <h2 className="pixel-font text-base sm:text-lg text-cyan-300 pixel-page-flyin">
            RANK NEW MAPS
          </h2>

          <div className="pixel-ranknew-layout">
            {/* LEFT: search/import, tabbed instead of stacked so only
                one of the two ever takes up space at a time. */}
            <div className="flex flex-col gap-4 pixel-page-flyin" style={{ animationDelay: "0.08s" }}>
              <div className="pixel-tabs">
                <button
                  className={`pixel-tab${activeTab === "search" ? " active" : ""}`}
                  onClick={() => setActiveTab("search")}
                >
                  SEARCH BEATSAVER
                </button>
                <button
                  className={`pixel-tab${activeTab === "import" ? " active" : ""}`}
                  onClick={() => setActiveTab("import")}
                >
                  IMPORT PLAYLIST
                </button>
              </div>

              {activeTab === "import" && (
                <div className="pixel-rank-panel flex flex-col gap-4">
                  <div
                    className={`pixel-dropzone${isDraggingPlaylist ? " dragging" : ""}`}
                    onClick={() => playlistFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPlaylist(true);
                    }}
                    onDragLeave={() => setIsDraggingPlaylist(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPlaylist(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handlePlaylistFile(file);
                    }}
                  >
                    <span>
                      {playlistLoading
                        ? "Reading playlist..."
                        : "Drop a .bplist/.json playlist file here, or click to browse"}
                    </span>
                    <input
                      ref={playlistFileInputRef}
                      type="file"
                      accept=".bplist,.json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePlaylistFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {playlistError && <p className="text-xs text-red-400">{playlistError}</p>}

                  {playlist && (
                    <>
                      <div className="flex items-center gap-3">
                        {playlist.image && (
                          <img
                            src={playlist.image}
                            alt={playlist.title}
                            className="pixel-cover w-12 h-12 object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-cyan-200 truncate">{playlist.title}</div>
                          {playlist.author && (
                            <div className="text-xs text-[#b7c0d6] truncate">
                              by {playlist.author}
                            </div>
                          )}
                        </div>
                        <button className="pixel-toggle-link" onClick={() => setPlaylist(null)}>
                          ✕ clear
                        </button>
                      </div>

                      {playlist.unresolvedCount > 0 && (
                        <p className="text-xs text-[#6a7690]">
                          {playlist.unresolvedCount} song{playlist.unresolvedCount === 1 ? "" : "s"}{" "}
                          from this playlist couldn't be found on BeatSaver (deleted, or a hash
                          mismatch).
                        </p>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <button
                          className={`pixel-toggle-chip${showOnlyNewFromPlaylist ? " on" : ""}`}
                          onClick={() => setShowOnlyNewFromPlaylist((v) => !v)}
                        >
                          HIDE IN POOL
                        </button>
                        {newFromPlaylist.length > 0 && (
                          <button
                            className="pixel-btn secondary"
                            onClick={() => newFromPlaylist.forEach(addSongFromPlaylist)}
                          >
                            Add All New ({newFromPlaylist.length})
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6a7690]">
                        Difficulties highlighted in the playlist are auto-selected when a song's
                        added.
                      </p>

                      <div className="pixel-search-grid">
                        {visiblePlaylistSongs.length === 0 && (
                          <p className="text-xs text-[#6a7690]">
                            {showOnlyNewFromPlaylist
                              ? "Every map in this playlist is already in the pool."
                              : "No maps resolved from this playlist."}
                          </p>
                        )}
                        {visiblePlaylistSongs.map((song, index) => {
                          const hash = song.versions?.[0]?.hash?.toUpperCase();
                          return (
                            <MapResultRow
                              key={song.id}
                              index={index}
                              song={song}
                              added={stagedIds.has(song.id)}
                              inPool={hash ? poolHashes.has(hash) : false}
                              highlightWords={[]}
                              onAdd={() => addSongFromPlaylist(song)}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "search" && (
                <div className="pixel-rank-panel flex flex-col gap-4">
                  <div className="pixel-searchbox">
                    <span className="prompt">&gt;</span>
                    <input
                      type="text"
                      placeholder="song, mapper, link/ID or playlist link"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setForceTextSearch(false);
                      }}
                      onPaste={(e) => {
                        // A plain single-line <input> silently mangles a
                        // multi-line paste (several links/IDs, one per
                        // line — the old paste-a-list textarea's use
                        // case) — browsers strip/collapse newlines
                        // inconsistently. Read the clipboard ourselves
                        // and join lines with spaces so
                        // looksLikeIdOrLink's tokenizing sees every line
                        // intact, regardless of the browser's own
                        // behavior.
                        const text = e.clipboardData.getData("text");
                        if (/[\r\n]/.test(text)) {
                          e.preventDefault();
                          const joined = text
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .join(" ");
                          setQuery(joined);
                          setForceTextSearch(false);
                        }
                      }}
                    />
                  </div>

                  {mapper && (
                    <div className="pixel-mapper-banner">
                      <span className="pixel-font text-[8px] text-cyan-300">MAPPER</span>
                      <img
                        src={mapper.avatar}
                        alt={mapper.name}
                        className="pixel-cover w-8 h-8 object-cover shrink-0"
                      />
                      <span className="text-xs text-cyan-200 font-semibold flex-1">
                        {mapper.name}
                      </span>
                      <button className="pixel-toggle-link" onClick={() => setForceTextSearch(true)}>
                        search maps instead
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      className={`pixel-toggle-chip${hideInPool ? " on" : ""}`}
                      onClick={() => setHideInPool((v) => !v)}
                    >
                      HIDE IN POOL
                    </button>
                    <button
                      className={`pixel-toggle-chip${includeAI ? " on" : ""}`}
                      onClick={() => setIncludeAI((v) => !v)}
                    >
                      AI MAPS: {includeAI ? "ON" : "OFF"}
                    </button>
                  </div>

                  {resolvedDirectly && (
                    <p className="text-xs text-[#6a7690]">
                      Loaded {results.length} map{results.length === 1 ? "" : "s"} directly from the
                      pasted link{results.length === 1 ? "" : "s"}/ID{results.length === 1 ? "" : "s"}.
                    </p>
                  )}
                  {pastedPlaylistId && (
                    <p className="text-xs text-[#6a7690]">
                      {playlistLoading
                        ? "Loading that playlist from BeatSaver..."
                        : "That's a BeatSaver playlist link — switch to IMPORT PLAYLIST above."}
                    </p>
                  )}

                  {resultsLoading && results.length === 0 && !pastedPlaylistId && (
                    <p className="text-xs text-[#6a7690]">Searching BeatSaver...</p>
                  )}
                  {searchError && (
                    <p className="text-xs text-red-400">
                      Couldn't reach BeatSaver. Try again in a moment.
                    </p>
                  )}
                  {!resultsLoading && !searchError && visibleResults.length === 0 && !pastedPlaylistId && (
                    <p className="text-xs text-[#6a7690]">
                      {results.length > 0 ? "Every result is already in this pool." : "No maps found."}
                    </p>
                  )}

                  {visibleResults.length > 0 && (
                    <div className="pixel-search-grid">
                      {visibleResults.map((song, index) => {
                        const hash = song.versions?.[0]?.hash?.toUpperCase();
                        return (
                          <MapResultRow
                            key={song.id}
                            index={index}
                            song={song}
                            added={stagedIds.has(song.id)}
                            inPool={hash ? poolHashes.has(hash) : false}
                            highlightWords={highlightWords}
                            onAdd={() => addSong(song)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {results.length > 0 && hasMoreResults && (
                    <button
                      className="pixel-btn secondary self-center"
                      onClick={handleLoadMoreResults}
                      disabled={resultsLoading}
                    >
                      {resultsLoading ? "Loading..." : "Load More"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: sticky rank queue — stays in view while scrolling
                through search results on the left. */}
            <div className="pixel-ranknew-queue-col pixel-page-flyin" style={{ animationDelay: "0.16s" }}>
              <div className="pixel-rank-panel flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="pixel-section-label">RANK QUEUE</span>
                  {songs.length > 0 && (
                    <button className="pixel-toggle-link" onClick={handleClearQueue}>
                      clear all
                    </button>
                  )}
                </div>

                {songs.length === 0 ? (
                  <p className="text-xs text-[#6a7690]">
                    Nothing queued yet — add maps from the left.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-[#6a7690]">
                      {songs.length} song{songs.length === 1 ? "" : "s"} · {totalSelected} diff
                      {totalSelected === 1 ? "" : "s"} selected
                    </p>

                    <div className="flex flex-col gap-2">
                      {songs.map((song, index) => (
                        <StagedSongCard
                          key={song.id}
                          index={index}
                          song={song}
                          selectedDiffs={selected[song.id] || []}
                          diffOptions={diffOptions[song.id] || {}}
                          onToggleDiff={(diffKey) => {
                            setSelected((old) => {
                              const prev = old[song.id] || [];
                              const checked = prev.includes(diffKey);
                              return {
                                ...old,
                                [song.id]: checked
                                  ? prev.filter((d) => d !== diffKey)
                                  : [...prev, diffKey],
                              };
                            });
                            setDiffOptions((old) => ({
                              ...old,
                              [song.id]: {
                                ...old[song.id],
                                [diffKey]: old[song.id]?.[diffKey] ?? "",
                              },
                            }));
                          }}
                          onOptionsChange={(diffKey, rating) =>
                            setDiffOptions((old) => ({
                              ...old,
                              [song.id]: { ...old[song.id], [diffKey]: rating },
                            }))
                          }
                          onRemove={() => removeSong(song.id)}
                        />
                      ))}
                    </div>

                    <button
                      className="pixel-btn secondary"
                      onClick={handleSetRatingForAll}
                      disabled={totalSelected === 0}
                    >
                      Set Star Rating For All
                    </button>

                    <button
                      className="pixel-btn"
                      onClick={handleBatchRank}
                      disabled={ranking || totalSelected === 0}
                    >
                      {ranking
                        ? "Ranking..."
                        : `Rank ${totalSelected} Difficult${totalSelected === 1 ? "y" : "ies"}`}
                    </button>
                    {ranking && (
                      <div className="pixel-loading">
                        <span className="pixel-font text-[10px] text-cyan-300">
                          {rankStage || "Ranking..."}
                        </span>
                        <div className={`pixel-progress${rankProgress ? "" : " indeterminate"}`}>
                          <div
                            className="pixel-progress-fill"
                            style={
                              rankProgress
                                ? {
                                    width: `${Math.min(
                                      100,
                                      Math.round(
                                        (rankProgress.current / Math.max(rankProgress.total, 1)) *
                                          100,
                                      ),
                                    )}%`,
                                  }
                                : undefined
                            }
                          />
                        </div>
                        {rankProgress && (
                          <span className="text-[11px] text-neutral-500">
                            {rankProgress.current} / {rankProgress.total}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RankNewMaps;
