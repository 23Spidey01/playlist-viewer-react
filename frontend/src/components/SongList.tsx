import React, { useEffect, useState } from "react";
import SongCard from "./SongCard";
import type { BSSongInfo, DetailedSong } from "./types";
import { diffMap, charMap } from "./types";
import { useSongPoolCache } from "./useSongPoolCache";
import { renderFunnyHahaPaulsSongs } from "./PoolFeatures/FunnyHahaPauls";
import PoolHeader from "./PoolHeader";
import type { PoolDetailed, LeaderEntry } from "./PoolHeader";
import { askApiKey, alertDialog, confirmDialog, promptText } from "./dialogStore";

interface SongListProps {
  poolId: string;
  pool: PoolDetailed;
  // Owned by PoolSongListPage (App.tsx) instead of here, so its topbar
  // (with the site logo) can show its own "EDIT MODE!!" call-out —
  // see .pixel-editmode-banner.
  editMode: boolean;
  onToggleEditMode: () => void;
}

type SongSortKey = "stars" | "name" | "newest" | "diffs";

const SONG_SORTS: { key: SongSortKey; label: string }[] = [
  { key: "stars", label: "STAR RATING" },
  { key: "name", label: "A–Z" },
  { key: "newest", label: "NEWEST" },
  { key: "diffs", label: "MOST DIFFS" },
];

// One missing song's section in the "not found" panel — grouped by
// hash (not per-diff, see .pixel-missing-song in pixel-ui.css). The
// map itself isn't on BeatSaver so there's no cover/name to fetch
// there, but Hitbloq's own ranked-list data still carries a name/
// cover/star-rating per difficulty from when it was ranked — used
// here instead of showing nothing but the bare hash.
const MissingSongCard: React.FC<{
  hash: string;
  entries: DetailedSong[];
  selected: Set<string>;
  onToggleDiff: (songId: string) => void;
}> = ({ hash, entries, selected, onToggleDiff }) => {
  // Own state (not lifted) so one broken cover across a long "not
  // found" list only ever affects its own row.
  const [coverBroken, setCoverBroken] = useState(false);
  const songName = entries.find((s) => s.song_name)?.song_name;
  const songCover = entries.find((s) => s.song_cover)?.song_cover;

  // Same idea as SongCard's own diff grouping — several missing diffs
  // across a couple of characteristics read as one section instead of
  // that many indistinguishable rows.
  const byCharacteristic: Record<string, DetailedSong[]> = {};
  entries.forEach((song) => {
    const charShort = song.song_id.split("_")[2];
    const characteristic = charMap[charShort] || charShort;
    (byCharacteristic[characteristic] ??= []).push(song);
  });

  return (
    <div className="pixel-missing-song">
      <div className="pixel-missing-song-head">
        {songCover && !coverBroken ? (
          <img
            src={songCover}
            alt=""
            className="pixel-missing-song-cover"
            onError={() => setCoverBroken(true)}
          />
        ) : (
          <div className="pixel-missing-song-cover pixel-thumb" />
        )}
        <div className="flex-1 min-w-0">
          {songName ? (
            <>
              <div className="name" title={songName}>
                {songName}
              </div>
              <div className="hash" title={hash}>
                {hash}
              </div>
            </>
          ) : (
            // No name on record either — the hash stands in as the
            // headline instead of a secondary line under nothing.
            <div className="hash as-name" title={hash}>
              {hash}
            </div>
          )}
        </div>
        <span className="count">
          {entries.length} diff{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pixel-missing-song-diffs">
        {Object.entries(byCharacteristic).map(([characteristic, songsForChar]) => (
          <div key={characteristic} className="char-row">
            <span className="char-label">{characteristic}</span>
            {songsForChar.map((song) => {
              const diffShort = song.song_id.split("_")[1];
              const difficulty = diffMap[diffShort] || diffShort;
              const starred = typeof song.song_stars === "number";
              const isSelected = selected.has(song.song_id);
              return (
                <span
                  key={song.song_id}
                  className={`${
                    starred ? "pixel-badge starred" : `pixel-badge diff-${difficulty}`
                  } pixel-badge-selectable${isSelected ? " selected" : ""}`}
                  onClick={() => onToggleDiff(song.song_id)}
                >
                  {difficulty}
                  {starred && <b className="ml-1">★ {song.song_stars}</b>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// One song's section in the "duplicate rankings" panel — a song this
// pool has ranked under more than one real hash at once (its current
// version, plus at least one older re-upload hash still separately
// ranked). Unlike MissingSongCard, the song itself IS on BeatSaver, so
// its cover/name come straight from that live data instead of
// Hitbloq's own (possibly stale) copy — only the older hash(es)'
// difficulties are listed below, grouped by which hash they're each
// still tracked under, since that's specifically what's worth
// unranking (the current hash's own ranking should stay).
const DuplicateSongCard: React.FC<{
  song: BSSongInfo;
  entries: DetailedSong[];
  selected: Set<string>;
  onToggleDiff: (songId: string) => void;
}> = ({ song, entries, selected, onToggleDiff }) => {
  const [coverBroken, setCoverBroken] = useState(false);
  const cover = song.versions?.[0]?.coverURL;
  const currentHash = song.versions?.[0]?.hash?.toUpperCase();

  const byHash: Record<string, DetailedSong[]> = {};
  entries.forEach((entry) => {
    const hash = entry.song_id.split("_")[0].toUpperCase();
    (byHash[hash] ??= []).push(entry);
  });

  return (
    <div className="pixel-missing-song">
      <div className="pixel-missing-song-head">
        {cover && !coverBroken ? (
          <img
            src={cover}
            alt=""
            className="pixel-missing-song-cover"
            onError={() => setCoverBroken(true)}
          />
        ) : (
          <div className="pixel-missing-song-cover pixel-thumb" />
        )}
        <div className="flex-1 min-w-0">
          <div className="name" title={song.metadata.songName}>
            {song.metadata.songName}
          </div>
          <div className="hash" title={currentHash}>
            current version: {currentHash}
          </div>
        </div>
        <span className="count">
          {entries.length} diff{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pixel-missing-song-diffs">
        {Object.entries(byHash).map(([hash, hashEntries]) => {
          const byCharacteristic: Record<string, DetailedSong[]> = {};
          hashEntries.forEach((entry) => {
            const charShort = entry.song_id.split("_")[2];
            const characteristic = charMap[charShort] || charShort;
            (byCharacteristic[characteristic] ??= []).push(entry);
          });
          return (
            <div key={hash} className="flex flex-col gap-1.5">
              <span className="text-[9px] font-mono text-[#6a7690]">
                OLDER VERSION: {hash}
              </span>
              {Object.entries(byCharacteristic).map(([characteristic, charEntries]) => (
                <div key={characteristic} className="char-row">
                  <span className="char-label">{characteristic}</span>
                  {charEntries.map((entry) => {
                    const diffShort = entry.song_id.split("_")[1];
                    const difficulty = diffMap[diffShort] || diffShort;
                    const starred = typeof entry.song_stars === "number";
                    const isSelected = selected.has(entry.song_id);
                    return (
                      <span
                        key={entry.song_id}
                        className={`${
                          starred ? "pixel-badge starred" : `pixel-badge diff-${difficulty}`
                        } pixel-badge-selectable${isSelected ? " selected" : ""}`}
                        onClick={() => onToggleDiff(entry.song_id)}
                      >
                        {difficulty}
                        {starred && <b className="ml-1">★ {entry.song_stars}</b>}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SongList: React.FC<SongListProps> = ({
  poolId,
  pool,
  editMode,
  onToggleEditMode,
}) => {
  // State for all songs from Hitbloq (ranked_list_detailed)
  const [songs, setSongs] = useState<DetailedSong[]>([]);
  // State for all songs found from BeatSaver — one entry per resolved
  // hash, NOT deduped by map id: a mapper re-upload can leave both the
  // old and new hash ranked in the same pool, and since BeatSaver's
  // hash lookup always resolves to the map's current version data
  // regardless of which hash you queried with, both entries look
  // identical (same versions[0].hash, same cover, same everything) —
  // isDuplicateSong below flags that case, and queryHashByEntry is
  // what actually tells the two ranked hashes apart despite that.
  const [bsSongs, setBsSongs] = useState<BSSongInfo[]>([]);
  // Which hash was actually queried to resolve each bsSongs entry —
  // see fetchBeatSaverSongs for why this (not the entry's own
  // versions[0].hash) is what's needed to tell a re-upload's two
  // ranked hashes apart. Keyed by object reference since each fetched
  // entry is distinct even when its content matches another's.
  const [queryHashByEntry, setQueryHashByEntry] = useState<Map<BSSongInfo, string>>(new Map());
  // Loading indicator
  const [loading, setLoading] = useState(false);
  // What the loading indicator is currently doing, and its progress
  // (null while the total isn't known yet, e.g. paging through Hitbloq)
  const [loadStage, setLoadStage] = useState("");
  const [loadProgress, setLoadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  // Map for star ratings: hash -> characteristic -> difficulty -> stars
  const [starRatingMap, setStarRatingMap] = useState<
    Record<string, Record<string, Record<string, number>>>
  >({});
  // Indicates whether the list of missing songs is displayed
  const [showMissing, setShowMissing] = useState(false);
  // Which missing difficulties (by their Hitbloq song_id, unique per
  // diff) are checked in the "not found" panel — lets "Unrank
  // Selected" target just these instead of every missing song.
  const [selectedMissingIds, setSelectedMissingIds] = useState<Set<string>>(new Set());
  const toggleMissingDiff = (songId: string) => {
    setSelectedMissingIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };
  // Same idea, for the "duplicate rankings" panel below (older/re-
  // upload hash versions still ranked alongside the current one).
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const toggleDuplicateDiff = (songId: string) => {
    setSelectedDuplicateIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };
  const { cache, setCache } = useSongPoolCache();

  // State for selected difficulties
  const [selectedDiffs, setSelectedDiffs] = useState<{
    [hash: string]: { [characteristic: string]: string[] };
  }>({});

  // State for the song search + sort controls
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SongSortKey>("stars");

  // editMode itself lives in the parent now (see SongListProps above);
  // this just reacts to it turning off by clearing any selection —
  // same behavior the old local toggle used to do inline.
  useEffect(() => {
    if (!editMode) setSelectedDiffs({});
  }, [editMode]);

  // Leaderboard data for the pool header
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/proxy/ladder/${poolId}/players/0`,
        );
        const data = await res.json();
        setLeaders(
          data.ladder.slice(0, 5).map((p: any) => ({
            rank: p.rank,
            name: p.username ?? p.name,
            cr: p.cr ?? 0,
          })),
        );
      } catch {
        setLeaders([]);
      }
    };

    fetchLeaders();
  }, [poolId]);

  // Posts to one of the Hitbloq proxy endpoints and actually checks
  // whether it worked. The backend proxy forwards Hitbloq's response
  // body as-is with its own 200 OK regardless of whether Hitbloq
  // itself accepted the request — a wrong API key, for instance, still
  // comes back as an HTTP-level success with a JSON body like
  // { status: "error", error: "..." }. So res.ok alone can't tell
  // success from failure here; only the body's own status field can.
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
      // Non-JSON body (e.g. a raw-text 500) — ok below still resolves
      // to false via res.ok.
    }
    return { ok: res.ok && result?.status === "success", result };
  };

  const handleRecalculateCR = async () => {
    const key = await askApiKey();
    if (!key) return alertDialog("No API key entered.");
    setLoading(true);
    setLoadStage("Recalculating CR...");
    setLoadProgress(null);
    const { ok, result } = await postToPool("recalculate_cr", { key, pool: poolId });
    setLoading(false);
    await alertDialog(
      ok ? "CR recalculated!" : "Error: " + (result?.error || result?.status || "unknown error"),
    );
  };

  // Load all songs from the selected pool (Hitbloq API)
  useEffect(() => {
    if (!poolId) return;
    // Check if songs are already in cache
    if (cache[poolId]?.songs?.length) {
      setSongs(cache[poolId].songs);
      setBsSongs(cache[poolId].bsSongs);
      setQueryHashByEntry(cache[poolId].queryHashByEntry || new Map());
      setStarRatingMap(cache[poolId].starRatingMap);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadStage("Loading ranked songs from Hitbloq...");
    setLoadProgress(null);

    const fetchAllSongs = async () => {
      let page = 0;
      let allSongs: DetailedSong[] = [];
      while (true) {
        setLoadStage(
          `Loading ranked songs from Hitbloq (page ${page + 1})...`,
        );
        const res = await fetch(
          `http://localhost:3001/proxy/ranked_list_detailed/${poolId}/${page}`,
        );
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        allSongs = allSongs.concat(data);
        if (data.length < 30) break; // Last page reached
        page++;
      }
      setSongs(allSongs);

      // Load BeatSaver songs and write everything to cache!
      const hashes = Array.from(
        new Set(
          allSongs.map((song) => song.song_id.split("_")[0].toLowerCase()),
        ),
      );
      setLoadStage("Fetching song data from BeatSaver...");
      setLoadProgress({ current: 0, total: hashes.length });
      const { songs: loadedBsSongs, queryHashByEntry: loadedQueryHashByEntry } =
        await fetchBeatSaverSongs(hashes);

      setBsSongs(loadedBsSongs);
      setQueryHashByEntry(loadedQueryHashByEntry);
      setLoading(false);
      setStarRatingMap(buildStarRatingMap(allSongs));
      setCache((old) => ({
        ...old,
        [poolId]: {
          songs: allSongs,
          bsSongs: loadedBsSongs,
          queryHashByEntry: loadedQueryHashByEntry,
          starRatingMap: buildStarRatingMap(allSongs),
        },
      }));
    };

    fetchAllSongs();
  }, [poolId, cache, setCache]);

  // Fetch BeatSaver info for all hashes (in chunks to avoid rate
  // limits). Every chunk is retried a few times with backoff before
  // being given up on — there was no error handling here at all
  // before: no res.ok check, no retry, so a single rate-limited or
  // briefly-failing chunk (up to CHUNK_SIZE hashes at once) either
  // silently dropped its songs as "not found" or threw and aborted
  // every chunk after it, depending on how BeatSaver's response
  // failed. That's what was actually behind the "Not Found"/duplicate
  // counts changing on every reload — it wasn't the data that was
  // random, it was how much of it a given page load managed to fetch.
  // Returns the resolved songs AND, separately, which hash was actually
  // QUERIED to get each one — not the same thing! When a map has been
  // re-uploaded, BeatSaver's hash lookup resolves the OLD hash to the
  // same MapDetail as the NEW one, and that object's own
  // versions[0].hash always reports the current/live version — so two
  // results fetched via two genuinely different ranked hashes (old +
  // new) can come back reporting the identical versions[0].hash,
  // making them look like one plain duplicate rather than two distinct
  // ranked entries. queryHashByEntry (keyed by object reference — each
  // fetched entry is its own distinct object even when content is
  // identical) is what actually distinguishes them, used below for the
  // "duplicate rankings" panel.
  const fetchBeatSaverSongs = async (
    hashes: string[],
  ): Promise<{ songs: BSSongInfo[]; queryHashByEntry: Map<BSSongInfo, string> }> => {
    const CHUNK_SIZE = 50;
    const DELAY_MS = 150;
    const MAX_ATTEMPTS = 4;
    const results: BSSongInfo[] = [];
    const queryHashByEntry = new Map<BSSongInfo, string>();
    const failedChunks: string[][] = [];
    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
      const chunk = hashes.slice(i, i + CHUNK_SIZE);
      const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
      let data: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`BeatSaver hash lookup failed: ${res.status}`);
          data = await res.json();
          break;
        } catch {
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          }
        }
      }
      if (data) {
        Object.entries(data).forEach(([queryHash, info]) => {
          if (!info) return;
          const song = info as BSSongInfo;
          results.push(song);
          queryHashByEntry.set(song, queryHash.toUpperCase());
        });
      } else {
        // Every retry failed — these hashes go missing from this run
        // rather than silently taking the rest of the pool down with
        // them; reported once at the end instead of per-chunk.
        failedChunks.push(chunk);
      }
      setLoadProgress({
        current: Math.min(i + CHUNK_SIZE, hashes.length),
        total: hashes.length,
      });
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
    if (failedChunks.length > 0) {
      const failedCount = failedChunks.reduce((sum, c) => sum + c.length, 0);
      console.warn(
        `BeatSaver hash lookup failed for ${failedCount} hash(es) after ${MAX_ATTEMPTS} attempts each — ` +
          `they'll show as "not found" for this page load. Reloading may pick them up if it was transient.`,
      );
    }
    return { songs: results, queryHashByEntry };
  };

  // Build a map: hash -> characteristic -> difficulty -> starRating
  const buildStarRatingMap = (songs: DetailedSong[]) => {
    const map: Record<string, Record<string, Record<string, number>>> = {};
    songs.forEach((song) => {
      const parts = song.song_id.split("_");
      const hash = parts[0].toUpperCase();
      const diffShort = parts[1];
      const charShort = parts[2];
      const difficulty = diffMap[diffShort] || diffShort;
      const characteristic = charMap[charShort] || charShort;

      if (!map[hash]) map[hash] = {};
      if (!map[hash][characteristic]) map[hash][characteristic] = {};
      if (typeof song.song_stars === "number") {
        map[hash][characteristic][difficulty] = song.song_stars;
      }
    });
    return map;
  };

  // Hashes from Hitbloq songs (uppercase)
  const hitbloqHashes = songs.map((song) =>
    song.song_id.split("_")[0].toUpperCase(),
  );
  // Hashes from BeatSaver songs (uppercase)
  const beatsaverHashes = bsSongs
    .map((song) => song.versions?.[0]?.hash?.toUpperCase())
    .filter(Boolean);
  // Hashes that are in Hitbloq but not in BeatSaver
  const missingHashes = Array.from(new Set(hitbloqHashes)).filter(
    (hash) => !beatsaverHashes.includes(hash),
  );

  // Songs whose BeatSaver map id shows up more than once in bsSongs —
  // this pool's ranked list resolved the same map from more than one
  // hash lookup, confirmed to happen for real re-uploads: BeatSaver
  // keeps the map id across a re-upload but issues a new hash, and if
  // the old hash is still ranked here too, both entries come back
  // looking identical (same versions[0].hash, cover, everything —
  // BeatSaver's hash lookup always resolves to the current version's
  // own data, regardless of which hash you queried with) even though
  // they're two distinct ranked entries. Cards get a small tag; the
  // section below separately checks — via queryHashByEntry, not
  // versions[0].hash — whether there's actually something distinct to
  // unrank, since a duplicate result can also just be the exact same
  // hash coming back twice, which has nothing to unrank.
  const idCounts: Record<string, number> = {};
  bsSongs.forEach((song) => {
    idCounts[song.id] = (idCounts[song.id] || 0) + 1;
  });
  const isDuplicateSong = (song: BSSongInfo) => (idCounts[song.id] || 0) > 1;
  const duplicateGroups: Record<string, BSSongInfo[]> = {};
  bsSongs.forEach((song) => {
    if (idCounts[song.id] > 1) (duplicateGroups[song.id] ??= []).push(song);
  });

  // Of those duplicate groups, only the ones whose entries were
  // actually queried by different hashes have anything to unrank — a
  // re-upload's old and new hash both resolve to the map's current
  // version data, so every entry's own versions[0].hash is identical
  // regardless of which hash it came from; queryHashByEntry (the hash
  // actually used to look each one up) is what tells them apart. If
  // BeatSaver's lookup just returned the exact same hash's data twice,
  // there's only ever been one real ranked entry despite the repeated
  // result, and nothing here is safe to touch.
  const duplicateEntriesBySongId: Record<string, DetailedSong[]> = {};
  Object.entries(duplicateGroups).forEach(([id, group]) => {
    const distinctHashes = Array.from(
      new Set(
        group.map((s) => queryHashByEntry.get(s)).filter((h): h is string => Boolean(h)),
      ),
    );
    if (distinctHashes.length <= 1) return;
    const currentHash = group[0].versions?.[0]?.hash?.toUpperCase();
    const olderHashes = distinctHashes.filter((h) => h !== currentHash);
    const entries = songs.filter((entry) =>
      olderHashes.includes(entry.song_id.split("_")[0].toUpperCase()),
    );
    if (entries.length > 0) duplicateEntriesBySongId[id] = entries;
  });
  const duplicateHashSongs = Object.keys(duplicateEntriesBySongId).map(
    (id) => duplicateGroups[id][0],
  );
  const duplicateEntries: DetailedSong[] = Object.values(duplicateEntriesBySongId).flat();
  const selectedDuplicateEntries = duplicateEntries.filter((e) =>
    selectedDuplicateIds.has(e.song_id),
  );

  // Every missing difficulty, flattened — shared by both "Unrank All"
  // and "Unrank Selected" below, which just each pass a different
  // slice of this same list to unrankEntries.
  const allMissingEntries = missingHashes.flatMap((hash) =>
    songs.filter((song) => song.song_id.startsWith(hash)),
  );
  const selectedMissingEntries = allMissingEntries.filter((song) =>
    selectedMissingIds.has(song.song_id),
  );

  // Sends a batch of difficulties to Hitbloq as unranked — shared by
  // the "not found" panel's Unrank All/Selected and the "duplicate
  // rankings" panel's below, which differ only in which entries and
  // wording they pass in.
  const unrankEntries = async (
    entries: DetailedSong[],
    scope: "all" | "selected",
    noun: string,
    onDone: () => void,
  ) => {
    if (entries.length === 0) return;
    const key = await askApiKey();
    if (!key) return alertDialog("No API key entered.");
    const proceed = await confirmDialog(
      scope === "all"
        ? `Are you sure you want to send all ${noun} as unranked?`
        : `Are you sure you want to send ${entries.length} selected difficult${
            entries.length === 1 ? "y" : "ies"
          } as unranked?`,
      { okLabel: "Unrank", cancelLabel: "Cancel", danger: true },
    );
    if (!proceed) return;

    setLoading(true);
    setLoadStage("Unranking...");
    setLoadProgress({ current: 0, total: entries.length });
    let count = 0;
    let processed = 0;
    const errors: string[] = [];
    for (const song of entries) {
      const parts = song.song_id.split("_");
      const hash = parts[0];
      const diffShort = parts[1];
      const charShort = parts[2];
      const difficulty = diffMap[diffShort] || diffShort;
      const characteristic = charMap[charShort] || charShort;
      const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
      const { ok, result } = await postToPool("unrank", { key, pool: poolId, song: formattedId });
      if (ok) count++;
      else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to unrank"}`);
      processed++;
      setLoadProgress({ current: processed, total: entries.length });
    }
    setLoading(false);
    if (count === 0) {
      await alertDialog(
        `Nothing was unranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} difficult${count === 1 ? "y" : "ies"} sent as unranked!` +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    onDone();
  };

  // Highest star rating among a song's ranked difficulties (-Infinity
  // for a song with none, so unranked songs sort to the bottom).
  const getMaxStars = (song: BSSongInfo) => {
    const hash = song.versions?.[0]?.hash?.toUpperCase();
    const charStars = hash ? starRatingMap[hash] : undefined;
    if (!charStars) return -Infinity;
    let max = -Infinity;
    Object.values(charStars).forEach((diffs) => {
      Object.values(diffs).forEach((star) => {
        if (star > max) max = star;
      });
    });
    return max;
  };

  // Search + sort applied on top of the full BeatSaver song list —
  // missingHashes/counts above stay based on the unfiltered data.
  const visibleSongs = bsSongs
    .filter((song) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        song.metadata.songName.toLowerCase().includes(q) ||
        song.metadata.songAuthorName.toLowerCase().includes(q) ||
        song.uploader.name.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === "stars") {
        return getMaxStars(b) - getMaxStars(a);
      }
      if (sort === "newest") {
        return new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime();
      }
      if (sort === "diffs") {
        const aDiffs = a.versions?.[0]?.diffs?.length ?? 0;
        const bDiffs = b.versions?.[0]?.diffs?.length ?? 0;
        return bDiffs - aDiffs;
      }
      return a.metadata.songName.localeCompare(b.metadata.songName);
    });

  // Toggle difficulty selection
  const toggleDiffSelection = (
    hash: string,
    characteristic: string,
    difficulty: string,
  ) => {
    setSelectedDiffs((prev) => {
      const prevChar = prev[hash]?.[characteristic] || [];
      const isSelected = prevChar.includes(difficulty);
      return {
        ...prev,
        [hash]: {
          ...prev[hash],
          [characteristic]: isSelected
            ? prevChar.filter((d) => d !== difficulty)
            : [...prevChar, difficulty],
        },
      };
    });
  };

  // Select or deselect every difficulty of one song at once
  const setSongSelection = (
    hash: string,
    select: boolean,
    diffs: { characteristic: string; difficulty: string }[],
  ) => {
    setSelectedDiffs((prev) => {
      const next = { ...prev };
      if (!select) {
        delete next[hash];
        return next;
      }
      const charMap: { [characteristic: string]: string[] } = {};
      diffs.forEach(({ characteristic, difficulty }) => {
        charMap[characteristic] = [
          ...(charMap[characteristic] || []),
          difficulty,
        ];
      });
      next[hash] = charMap;
      return next;
    });
  };

  const allSelectedAreRanked = Object.entries(selectedDiffs).every(
    ([hash, chars]) =>
      Object.entries(chars).every(([characteristic, diffs]) =>
        diffs.every(
          (difficulty) =>
            starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined,
        ),
      ),
  );

  const allSelectedAreUnranked = Object.entries(selectedDiffs).every(
    ([hash, chars]) =>
      Object.entries(chars).every(([characteristic, diffs]) =>
        diffs.every(
          (difficulty) =>
            starRatingMap[hash]?.[characteristic]?.[difficulty] === undefined,
        ),
      ),
  );

  // Total number of currently selected difficulties (across all songs)
  const selectedCount = Object.values(selectedDiffs).reduce(
    (sum, chars) =>
      sum + Object.values(chars).reduce((s, arr) => s + arr.length, 0),
    0,
  );

  // Rank every selected difficulty that is not ranked yet
  const rankAllSelected = async () => {
    if (!allSelectedAreUnranked) return;
    const key = await askApiKey();
    if (!key) return;
    let count = 0;
    const errors: string[] = [];
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          if (starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined)
            continue;
          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
          const { ok, result } = await postToPool("rank", {
            key,
            pool: poolId,
            song: formattedId,
          });
          if (ok) count++;
          else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to rank"}`);
        }
      }
    }
    let crFailed = false;
    if (count > 0) {
      const { ok } = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !ok;
    }
    if (count === 0) {
      await alertDialog(
        `Nothing was ranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} Difficult${count === 1 ? "y" : "ies"} ranked` +
        (crFailed ? " (CR recalculation failed)" : " and CR recalculated") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    window.location.reload();
  };

  // Unrank every selected difficulty (only allowed when all are currently ranked)
  const unrankAllSelected = async () => {
    if (!allSelectedAreRanked) return;
    const key = await askApiKey();
    if (!key) return;
    let count = 0;
    const errors: string[] = [];
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
          const { ok, result } = await postToPool("unrank", {
            key,
            pool: poolId,
            song: formattedId,
          });
          if (ok) count++;
          else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to unrank"}`);
        }
      }
    }
    let crFailed = false;
    if (count > 0) {
      const { ok } = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !ok;
    }
    if (count === 0) {
      await alertDialog(
        `Nothing was unranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} Difficult${count === 1 ? "y" : "ies"} unranked` +
        (crFailed ? " (CR recalculation failed)" : "") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    window.location.reload();
  };

  // Set a star rating for the whole selection; ranks unranked diffs first if needed
  const setStarRatingForSelection = async () => {
    const unrankedDiffs: {
      hash: string;
      characteristic: string;
      difficulty: string;
    }[] = [];
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          if (
            starRatingMap[hash]?.[characteristic]?.[difficulty] === undefined
          ) {
            unrankedDiffs.push({ hash, characteristic, difficulty });
          }
        }
      }
    }

    if (unrankedDiffs.length > 0) {
      const proceed = await confirmDialog(
        "Your selection contains difficulties that are not ranked yet. Should these be ranked first and then the star rating be set?",
        { okLabel: "Rank them first", cancelLabel: "Cancel" },
      );
      if (!proceed) return;
      const rankKey = await askApiKey();
      if (!rankKey) return;
      let rankedFirstCount = 0;
      const rankFirstErrors: string[] = [];
      for (const { hash, characteristic, difficulty } of unrankedDiffs) {
        const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
        const { ok, result } = await postToPool("rank", {
          key: rankKey,
          pool: poolId,
          song: formattedId,
        });
        if (ok) rankedFirstCount++;
        else rankFirstErrors.push(`${formattedId}: ${result?.error || result?.status || "failed to rank"}`);
      }
      if (rankedFirstCount > 0) {
        await postToPool("recalculate_cr", { key: rankKey, pool: poolId });
      }
      if (rankedFirstCount === 0) {
        return alertDialog(
          `Couldn't rank any of the ${unrankedDiffs.length} unranked difficulties — check the API key and try again.` +
            (rankFirstErrors.length ? `\n\n${rankFirstErrors.join("\n")}` : ""),
        );
      }
      await alertDialog(
        `${rankedFirstCount} of ${unrankedDiffs.length} difficulties ranked first! Now the star rating will be set.` +
          (rankFirstErrors.length
            ? `\n\n${rankFirstErrors.length} problem(s):\n${rankFirstErrors.join("\n")}`
            : ""),
      );
    }

    const key = await askApiKey();
    if (!key) return;
    const isAutomatic = await confirmDialog(
      "Calculate star rating automatically, or set it manually?",
      { okLabel: "Automatic", cancelLabel: "Manual" },
    );
    let manualRating: number | undefined = undefined;
    if (!isAutomatic) {
      let rating = await promptText(
        "What star rating should be set for all selected difficulties?",
        { placeholder: "e.g. 8.5" },
      );
      if (!rating) return alertDialog("No star rating entered.");
      rating = rating.replace(",", ".");
      manualRating = parseFloat(rating);
      if (isNaN(manualRating) || manualRating < 0)
        return alertDialog("Invalid star rating.");
    }
    let count = 0;
    const errors: string[] = [];
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
          const { ok, result } = isAutomatic
            ? await postToPool("set_automatic", { key, pool: poolId, song: formattedId })
            : await postToPool("set_manual", {
                key,
                pool: poolId,
                song: formattedId,
                rating: manualRating,
              });
          if (ok) count++;
          else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to set star rating"}`);
        }
      }
    }
    let crFailed = false;
    if (count > 0) {
      const { ok } = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !ok;
    }
    if (count === 0) {
      await alertDialog(
        `Nothing was changed — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} Difficult${count === 1 ? "y" : "ies"} changed` +
        (crFailed ? " (CR recalculation failed)" : " and CR recalculated") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    window.location.reload();
  };

  return (
    <div>
      {/* Fixed to the viewport (not this component's own layout), so
          the whole page reads as "in edit mode" at a glance no matter
          where you're scrolled to — not just the cards themselves.
          Always mounted (not conditional on editMode) so its opacity
          transition can fade it in/out smoothly — toggling the class
          instead of mounting/unmounting the element. */}
      <div
        className={`pixel-edit-frame${editMode ? " pixel-edit-frame-on" : ""}`}
        aria-hidden="true"
      >
        <div className="pixel-edit-frame-pulse" />
      </div>
      {/* Loading indicator: what's happening + a progress bar */}
      {loading && (
        <div className="pixel-loading">
          <span className="pixel-font text-[10px] text-cyan-300">
            {loadStage || "Loading pool..."}
          </span>
          <div className={`pixel-progress${loadProgress ? "" : " indeterminate"}`}>
            <div
              className="pixel-progress-fill"
              style={
                loadProgress
                  ? {
                      width: `${Math.min(
                        100,
                        Math.round(
                          (loadProgress.current / Math.max(loadProgress.total, 1)) *
                            100,
                        ),
                      )}%`,
                    }
                  : undefined
              }
            />
          </div>
          {loadProgress && (
            <span className="text-[11px] text-neutral-500">
              {loadProgress.current} / {loadProgress.total}
            </span>
          )}
        </div>
      )}
      {!loading && (
        <PoolHeader
          pool={pool}
          rankedDiffs={songs.length}
          foundOnBeatSaver={bsSongs.length}
          missingCount={missingHashes.length}
          showMissing={showMissing}
          onToggleMissing={() => setShowMissing((v) => !v)}
          duplicateSongCount={duplicateHashSongs.length}
          showDuplicates={showDuplicates}
          onToggleDuplicates={() => setShowDuplicates((v) => !v)}
          onRankNewMaps={() =>
            (window.location.href = `/pool/${poolId}/rank-new`)
          }
          onRecalculateCR={handleRecalculateCR}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          leaders={leaders}
        />
      )}
      {/* Actions for the current difficulty selection (edit mode).
          Always mounted (while not loading) so the height animation
          below has something to animate between — editMode only
          toggles the "open" class, it doesn't mount/unmount this. */}
      {!loading && (
        <div
          className={`pixel-collapse${editMode ? " pixel-collapse-open" : ""}`}
        >
          <div className="pixel-collapse-inner">
            <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 bg-neutral-900/95 border border-neutral-700 p-3 mb-6 shadow-lg">
              <span className="pixel-font text-[10px] text-cyan-300 mr-1">
                {selectedCount} SELECTED
              </span>
              <button
                className="pixel-btn disabled:opacity-40"
                disabled={selectedCount === 0 || !allSelectedAreUnranked}
                onClick={rankAllSelected}
              >
                Rank All Selected
              </button>
              <button
                className="pixel-btn secondary disabled:opacity-40"
                disabled={selectedCount === 0}
                onClick={setStarRatingForSelection}
              >
                Set Star Rating
              </button>
              <button
                className="pixel-btn danger disabled:opacity-40"
                disabled={selectedCount === 0 || !allSelectedAreRanked}
                onClick={unrankAllSelected}
              >
                Unrank All Selected
              </button>
              <button
                className="pixel-tab ml-auto disabled:opacity-40"
                disabled={selectedCount === 0}
                onClick={() => setSelectedDiffs({})}
              >
                CLEAR
              </button>
            </div>
          </div>
        </div>
      )}
      {/* List missing songs (collapsible, toggled from the header).
          Always mounted (while there are any missing songs) so the
          grid-rows height animation below has something to animate
          between — same technique as the edit-mode selection bar —
          instead of the panel just popping into/out of existence and
          shoving the search bar/song grid below it down instantly. */}
      {!loading && missingHashes.length > 0 && (
        <div
          className={`pixel-collapse${showMissing ? " pixel-collapse-open" : ""}`}
        >
          <div className="pixel-collapse-inner">
        <div className="pixel-missing-panel">
          <div className="flex flex-wrap items-center gap-3">
            <span className="pixel-font text-[10px] text-red-400">
              {missingHashes.length} SONGS WITH {allMissingEntries.length} RANKED
              DIFFICULT{allMissingEntries.length === 1 ? "Y" : "IES"} NOT FOUND ON BEATSAVER
            </span>
            <button
              className="pixel-tab"
              onClick={() =>
                navigator.clipboard.writeText(missingHashes.join("\n"))
              }
            >
              COPY HASHES
            </button>
          </div>
          <div className="pixel-missing-note">
            <b>i</b>
            <span>
              These maps were most likely taken down by their mapper on
              BeatSaver. Anyone who hadn't already downloaded them before
              the takedown can no longer download or play them.
            </span>
          </div>
          <div className="pixel-missing-list">
            {missingHashes.map((hash) => (
              <MissingSongCard
                key={hash}
                hash={hash}
                entries={songs.filter((song) => song.song_id.startsWith(hash))}
                selected={selectedMissingIds}
                onToggleDiff={toggleMissingDiff}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="pixel-font text-[10px] text-cyan-300">
              {selectedMissingIds.size} SELECTED
            </span>
            <button
              className="pixel-btn danger"
              onClick={() =>
                unrankEntries(allMissingEntries, "all", "missing songs", () =>
                  setSelectedMissingIds(new Set()),
                )
              }
            >
              Unrank All Missing Songs
            </button>
            <button
              className="pixel-btn danger disabled:opacity-40"
              disabled={selectedMissingIds.size === 0}
              onClick={() =>
                unrankEntries(selectedMissingEntries, "selected", "missing songs", () =>
                  setSelectedMissingIds(new Set()),
                )
              }
            >
              Unrank Selected
            </button>
            <button
              className="pixel-tab ml-auto disabled:opacity-40"
              disabled={selectedMissingIds.size === 0}
              onClick={() => setSelectedMissingIds(new Set())}
            >
              CLEAR
            </button>
          </div>
        </div>
          </div>
        </div>
      )}
      {/* Duplicate rankings: a song this pool ranked under more than
          one real hash at once (a re-upload's new hash, alongside the
          original still ranked too) — same collapsible pattern as the
          "not found" panel above; its own toggle now lives in the pool
          header next to NOT FOUND (see PoolHeader's duplicateSongCount
          etc.), not here, for the same reason the "not found" toggle
          doesn't live inside its own collapse either. */}
      {!loading && duplicateHashSongs.length > 0 && (
          <div
            className={`pixel-collapse${showDuplicates ? " pixel-collapse-open" : ""}`}
          >
          <div className="pixel-collapse-inner">
        <div className="pixel-missing-panel">
          <div className="flex flex-wrap items-center gap-3">
            <span className="pixel-font text-[10px] text-orange-400">
              {duplicateHashSongs.length} SONG{duplicateHashSongs.length === 1 ? "" : "S"} WITH{" "}
              {duplicateEntries.length} OLDER RANKED DIFFICULT
              {duplicateEntries.length === 1 ? "Y" : "IES"} — DUPLICATE RANKINGS
            </span>
          </div>
          <div className="pixel-missing-note">
            <b>i</b>
            <span>
              These songs have more than one hash version ranked in this pool at once —
              usually from a mapper re-upload whose old ranking never got cleaned up.
              BeatSaver treats each hash as its own map, so a player can set a score
              against every version separately for what's really the same chart.
              Unranking the older version(s) below leaves just the current one ranked.
            </span>
          </div>
          <div className="pixel-missing-list">
            {duplicateHashSongs.map((song) => (
              <DuplicateSongCard
                key={song.id}
                song={song}
                entries={duplicateEntriesBySongId[song.id] || []}
                selected={selectedDuplicateIds}
                onToggleDiff={toggleDuplicateDiff}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="pixel-font text-[10px] text-cyan-300">
              {selectedDuplicateIds.size} SELECTED
            </span>
            <button
              className="pixel-btn danger"
              onClick={() =>
                unrankEntries(duplicateEntries, "all", "duplicate rankings", () =>
                  setSelectedDuplicateIds(new Set()),
                )
              }
            >
              Unrank All Older Versions
            </button>
            <button
              className="pixel-btn danger disabled:opacity-40"
              disabled={selectedDuplicateIds.size === 0}
              onClick={() =>
                unrankEntries(selectedDuplicateEntries, "selected", "duplicate rankings", () =>
                  setSelectedDuplicateIds(new Set()),
                )
              }
            >
              Unrank Selected
            </button>
            <button
              className="pixel-tab ml-auto disabled:opacity-40"
              disabled={selectedDuplicateIds.size === 0}
              onClick={() => setSelectedDuplicateIds(new Set())}
            >
              CLEAR
            </button>
          </div>
        </div>
          </div>
          </div>
      )}
      {/* Search + sort for the song list below */}
      {!loading && bsSongs.length > 0 && (
        <div
          className="pixel-page-flyin flex flex-wrap items-center gap-3 mb-4"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="pixel-searchbox flex-1 min-w-[220px]">
            <span className="prompt">&gt;</span>
            <input
              type="text"
              placeholder="Search songs, mappers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="pixel-tabs">
            {SONG_SORTS.map((s) => (
              <button
                key={s.key}
                className={`pixel-tab${sort === s.key ? " active" : ""}`}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Display BeatSaver SongCards */}
      {!loading &&
        visibleSongs.length > 0 &&
        poolId === "funny_haha_pauls" &&
        renderFunnyHahaPaulsSongs(
          visibleSongs,
          starRatingMap,
          poolId,
          selectedDiffs,
          toggleDiffSelection,
          editMode,
          setSongSelection,
        )}
      {!loading && visibleSongs.length > 0 && poolId !== "funny_haha_pauls" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleSongs.map((song, index) => {
            const duplicate = isDuplicateSong(song);
            const card = (
              <SongCard
                index={index}
                song={song}
                starRatings={
                  starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}
                }
                poolId={poolId}
                selectedDiffs={
                  selectedDiffs[song.versions?.[0]?.hash?.toUpperCase()] || {}
                }
                onToggleDiff={(characteristic, difficulty) =>
                  toggleDiffSelection(
                    song.versions?.[0]?.hash?.toUpperCase(),
                    characteristic,
                    difficulty,
                  )
                }
                onToggleAllDiffs={(select, diffs) =>
                  setSongSelection(
                    song.versions?.[0]?.hash?.toUpperCase(),
                    select,
                    diffs,
                  )
                }
                editMode={editMode}
              />
            );
            // BeatSaver's hash lookup returned this same map more than
            // once for this pool (see isDuplicateSong above) — flagged
            // rather than merged into one card, since merging assumed
            // a specific cause (old ranked hash versions) that didn't
            // hold up against real data.
            // song.id alone isn't a safe React key here — that's the
            // whole point of this tag, several entries can share one.
            const key = `${song.id}-${index}`;
            if (!duplicate) return <React.Fragment key={key}>{card}</React.Fragment>;
            // A banner sitting above the card, not an overlay on top of
            // it — an absolutely-positioned tag in the corner ran
            // straight into the song title whenever it was long enough
            // to wrap that far, since SongCard's title wraps instead of
            // truncating.
            return (
              <div key={key}>
                <div
                  className="pixel-duplicate-banner"
                  title="This map came back more than once from BeatSaver's lookup for this pool's ranked songs."
                >
                  <span className="tag">DUPLICATE</span>
                  {/* The hash actually QUERIED to resolve this card, not
                      its self-reported versions[0].hash — the latter is
                      always the map's current version regardless of
                      which hash you asked with, so it looks the same on
                      every duplicate card by design and would never show
                      anything useful here. This is what actually
                      settles whether two duplicate cards are genuinely
                      different ranked hashes, at a glance. */}
                  <span className="hash">
                    {queryHashByEntry.get(song) || song.versions?.[0]?.hash?.toUpperCase()}
                  </span>
                </div>
                {card}
              </div>
            );
          })}
        </div>
      )}
      {/* Note if the search filtered out everything */}
      {!loading && bsSongs.length > 0 && visibleSongs.length === 0 && (
        <p className="text-orange-400">No songs match your search.</p>
      )}
      {/* Note if no songs were found */}
      {!loading && bsSongs.length === 0 && (
        <p className="text-orange-400">No songs found.</p>
      )}
    </div>
  );
};

export default SongList;
