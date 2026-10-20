// useBeatSaverSearch.ts — the "SEARCH BEATSAVER" tab's whole search/
// browse flow: free-text search, exact-mapper-username detection,
// pasted link/ID resolution, and the debounced effect that ties them
// together. Split out of RankNewMaps.tsx along with usePlaylistImport
// and useRankQueue so that file is left with just the three panels'
// rendering, wired to these three independent concerns.
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BSSongInfo } from "./beatSaverTypes";
import {
  parseBeatSaverId,
  looksLikeIdOrLink,
  extractBeatSaverPlaylistId,
  dedupeById,
  rankByQuery,
} from "./beatSaverSearch";

interface BSMapper {
  id: number;
  name: string;
  avatar: string;
}

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

// How many pages of BeatSaver's own "Relevance" order get pulled up
// front for a text query, before the client-side re-rank even runs.
// BeatSaver's relevance sort blends text match with popularity — a
// low-play personal map with an exact title match can still land many
// pages deep, behind bigger maps that only share one loose word.
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

interface SearchResolution {
  mapper: BSMapper | null;
  resolvedDirectly: boolean;
  docs: BSSongInfo[];
  page: number;
  hasMore: boolean;
}

// The actual "what should these results be" decision — pasted link(s)/
// ID(s), then an exact mapper-username match, then a plain text
// search, in that order. Runs as a single React Query queryFn: its key
// (built from the debounced query + includeAI + forceTextSearch below)
// is what used to need the hand-rolled searchSeq ref — a stale request
// from a since-abandoned key can still resolve late, but it only ever
// updates ITS OWN cache entry, never the current one, so the UI (which
// always reads the query matching the current key) can't be clobbered
// by it.
async function resolveSearch(
  query: string,
  includeAI: boolean,
  forceTextSearch: boolean,
): Promise<SearchResolution> {
  const trimmed = query.trim();
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const looksLikeIds = tokens.length > 0 && tokens.every(looksLikeIdOrLink);

  // Pasted link(s)/ID(s) go straight to BeatSaver's per-map lookup —
  // bypasses the mapper check and text search entirely, so a pasted
  // link is never at the mercy of relevance ranking. If none of them
  // actually resolve (e.g. a stray word that just happens to look
  // hex-ish), this falls through to the normal search below instead of
  // showing "no maps found".
  if (looksLikeIds) {
    const resolved = await resolveIdsOrLinks(tokens);
    if (resolved.length > 0) {
      return { mapper: null, resolvedDirectly: true, docs: resolved, page: 0, hasMore: false };
    }
  }

  const matchedMapper = trimmed && !forceTextSearch ? await checkMapperMatch(trimmed) : null;
  if (matchedMapper) {
    const docs = await fetchMapperMapsPage(matchedMapper.id, 0);
    return {
      mapper: matchedMapper,
      resolvedDirectly: false,
      docs,
      page: 0,
      hasMore: docs.length > 0,
    };
  }

  // Browsing with an empty query has no ranking to do — left in
  // BeatSaver's own (chronological "Latest") order. An actual query
  // pulls a much wider candidate pool first — see
  // fetchTextSearchCandidates for why the first page or two alone
  // isn't enough.
  const { docs, lastPage, hasMore } = await fetchTextSearchCandidates(query, includeAI);
  return {
    mapper: null,
    resolvedDirectly: false,
    docs: trimmed ? rankByQuery(docs, trimmed) : docs,
    page: lastPage,
    hasMore,
  };
}

// `onPlaylistLinkDetected` is called (instead of this hook fetching the
// playlist itself) when the query turns out to be a beatsaver.com
// playlist link — that's usePlaylistImport's job, kept as a separate,
// independently-usable hook rather than reached into from here.
export function useBeatSaverSearch(onPlaylistLinkDetected: (playlistId: string) => Promise<void>) {
  const [query, setQuery] = useState("");
  const [includeAI, setIncludeAI] = useState(false);
  // Mirrors the playlist panel's own "only show maps not already in
  // this pool" checkbox, but as a toggle button for the search panel.
  const [hideInPool, setHideInPool] = useState(false);
  // Lets someone bypass a mapper match and fall back to the plain text
  // search instead, in case the query matched a username they didn't
  // actually mean as one.
  const [forceTextSearch, setForceTextSearch] = useState(false);

  // results/resultsPage/mapper/resolvedDirectly/hasMoreResults are kept
  // as local state (rather than read straight from the query below)
  // because handleLoadMoreResults appends further pages to them
  // directly, merging in whichever endpoint (mapper uploads vs text
  // search) the query resolved to use — a query key only identifies
  // the FIRST page's search, not the accumulated, re-ranked list.
  const [results, setResults] = useState<BSSongInfo[]>([]);
  const [resultsPage, setResultsPage] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(true);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  // Set once the current query exactly matches a BeatSaver account —
  // results then come from that account's own uploads (fetchMapperMapsPage)
  // instead of the text search, which searches map metadata and doesn't
  // reliably surface every map by a given uploader. See checkMapperMatch.
  const [mapper, setMapper] = useState<BSMapper | null>(null);
  // True when the current results came from pasting a BeatSaver
  // link/ID (or several) directly into the search bar rather than from
  // a text search or mapper lookup — see looksLikeIdOrLink below.
  const [resolvedDirectly, setResolvedDirectly] = useState(false);

  // Debounced so fast typing doesn't fire a request per keystroke —
  // the search below is keyed on this, not `query` directly.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(handle);
  }, [query]);
  const isDebouncing = query !== debouncedQuery;

  const trimmedDebounced = debouncedQuery.trim();
  const debouncedPlaylistId = extractBeatSaverPlaylistId(trimmedDebounced);

  // A beatsaver.com/playlists/<id> link (a playlist made on the site
  // itself, distinct from an uploaded .bplist file) goes straight to
  // the Import a Playlist panel instead of into these search results.
  // This has to stay a plain effect rather than folding into the query
  // below: it's a one-time action that must fire exactly once per
  // distinct pasted link, never again on a background refetch of
  // "cached" data for the same key.
  useEffect(() => {
    if (debouncedPlaylistId) onPlaylistLinkDetected(debouncedPlaylistId);
  }, [debouncedPlaylistId, onPlaylistLinkDetected]);

  const {
    data: resolved,
    isFetching: searching,
    isError: searchError,
  } = useQuery({
    queryKey: ["beatSaverSearch", trimmedDebounced, includeAI, forceTextSearch],
    queryFn: () => resolveSearch(debouncedQuery, includeAI, forceTextSearch),
    enabled: !debouncedPlaylistId,
  });

  useEffect(() => {
    if (debouncedPlaylistId) {
      setMapper(null);
      setResolvedDirectly(false);
      setResults([]);
      setResultsPage(0);
      setHasMoreResults(false);
      return;
    }
    if (searchError) {
      setResults([]);
      setMapper(null);
      setResolvedDirectly(false);
      setHasMoreResults(false);
      return;
    }
    if (!resolved) return;
    setMapper(resolved.mapper);
    setResolvedDirectly(resolved.resolvedDirectly);
    setResults(resolved.docs);
    setResultsPage(resolved.page);
    setHasMoreResults(resolved.hasMore);
  }, [resolved, searchError, debouncedPlaylistId]);

  const resultsLoading = isDebouncing || searching || loadMoreLoading;

  const handleLoadMoreResults = useCallback(async () => {
    const nextPage = resultsPage + 1;
    const trimmed = query.trim();
    setLoadMoreLoading(true);
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
      setLoadMoreLoading(false);
    }
  }, [resultsPage, query, includeAI, mapper]);

  // Only highlight when the results are actually a text-relevance
  // match against these words — not while browsing (no query), viewing
  // a specific mapper's uploads, or showing maps resolved directly from
  // a pasted link/ID (nothing meaningful to highlight in any of those).
  const highlightWords =
    !mapper && !resolvedDirectly && query.trim()
      ? query.trim().toLowerCase().split(/\s+/).filter(Boolean)
      : [];
  const pastedPlaylistId = extractBeatSaverPlaylistId(query.trim());

  return {
    query,
    setQuery,
    includeAI,
    setIncludeAI,
    hideInPool,
    setHideInPool,
    results,
    resultsLoading,
    hasMoreResults,
    searchError,
    mapper,
    setForceTextSearch,
    resolvedDirectly,
    handleLoadMoreResults,
    highlightWords,
    pastedPlaylistId,
  };
}
