import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import SongCard from "./SongCard";
import type { BSSongInfo } from "./beatSaverTypes";
import HitbloqSongCard from "./HitbloqSongCard";
import DuplicateSongCard from "./DuplicateSongCard";
import SelectedSongChip from "./SelectedSongChip";
import FunnyHahaPaulsSongs from "./PoolFeatures/FunnyHahaPauls";
import PoolHeader from "./PoolHeader";
import type { PoolDetailed } from "./hitbloqTypes";
import { usePoolSongs } from "./usePoolSongs";
import { useDiffSelection } from "./useDiffSelection";
import { useLeaderboard } from "./useLeaderboard";

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

const SongList: React.FC<SongListProps> = ({
  poolId,
  pool,
  editMode,
  onToggleEditMode,
}) => {
  const navigate = useNavigate();
  const {
    songs,
    bsSongs,
    queryHashByEntry,
    starRatingMap,
    loading,
    loadStage,
    loadProgress,
    loadError,
    retry,
    handleRecalculateCR,
    unrankEntries,
    rankAllSelected,
    unrankAllSelected,
    setStarRatingForSelection,
  } = usePoolSongs(poolId);

  const {
    selectedDiffs,
    toggleDiffSelection,
    setSongSelection,
    clearSelection,
    selectedCount,
    allSelectedAreRanked,
    allSelectedAreUnranked,
  } = useDiffSelection(editMode, starRatingMap);

  const leaders = useLeaderboard(poolId);

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

  // State for the song search + sort controls
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SongSortKey>("stars");

  // Hashes from Hitbloq songs (uppercase)
  const hitbloqHashes = songs.map((song) =>
    song.song_id.split("_")[0].toUpperCase(),
  );

  // hash -> its resolved BeatSaver data, for looking up cover/name
  // of a selected song without scanning bsSongs every time — used by
  // the "selected maps" tray in the edit-mode action bar below.
  const bsSongByHash: Record<string, BSSongInfo> = {};
  bsSongs.forEach((s) => {
    const hash = s.versions?.[0]?.hash?.toUpperCase();
    if (hash) bsSongByHash[hash] = s;
  });

  // Hardest ranked difficulty in the pool — used to turn the pool's raw
  // cr_curve (an accuracy -> multiplier curve) into real CR numbers for
  // the header chart. See CrCurveChart.tsx.
  const poolStars = songs
    .map((song) => song.song_stars)
    .filter((stars): stars is number => typeof stars === "number");
  const maxStars = poolStars.length > 0 ? Math.max(...poolStars) : undefined;
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
  const duplicateEntriesBySongId: Record<string, typeof songs> = {};
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
  const duplicateEntries = Object.values(duplicateEntriesBySongId).flat();
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
      {!loading && loadError && (
        <div className="pixel-card pixel-card-static pixel-page-flyin" style={{ padding: 24, maxWidth: 480 }}>
          <div className="text-sm text-[#b7c0d6] mb-3">
            Couldn't load this pool: {loadError}
          </div>
          <button className="pixel-btn" onClick={retry}>
            Retry
          </button>
        </div>
      )}
      {!loading && !loadError && (
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
          onRankNewMaps={() => navigate(`/pool/${poolId}/rank-new`)}
          onRecalculateCR={handleRecalculateCR}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          leaders={leaders}
          poolId={poolId}
          maxStars={maxStars}
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
            <div className="sticky top-2 z-20 bg-neutral-900/95 border border-neutral-700 p-3 mb-6 shadow-lg">
              <div className="flex flex-wrap items-center gap-3">
                <span className="pixel-font text-[10px] text-cyan-300 mr-1">
                  {selectedCount} SELECTED
                </span>
                <button
                  className="pixel-btn disabled:opacity-40"
                  disabled={selectedCount === 0 || !allSelectedAreUnranked}
                  onClick={() => rankAllSelected(selectedDiffs)}
                >
                  Rank All Selected
                </button>
                <button
                  className="pixel-btn secondary disabled:opacity-40"
                  disabled={selectedCount === 0}
                  onClick={() => setStarRatingForSelection(selectedDiffs)}
                >
                  Set Star Rating
                </button>
                <button
                  className="pixel-btn danger disabled:opacity-40"
                  disabled={selectedCount === 0 || !allSelectedAreRanked}
                  onClick={() => unrankAllSelected(selectedDiffs)}
                >
                  Unrank All Selected
                </button>
                <button
                  className="pixel-tab ml-auto disabled:opacity-40"
                  disabled={selectedCount === 0}
                  onClick={clearSelection}
                >
                  CLEAR
                </button>
                <button
                  className="pixel-tab"
                  style={{ color: "#f3c542" }}
                  onClick={onToggleEditMode}
                >
                  EXIT EDIT MODE
                </button>
              </div>

              {/* Every currently selected song, collected here instead
                  of staying wherever it happens to be scrolled to in
                  the grid below — the whole point being that a
                  selection made hundreds of cards apart stays visible
                  as one place to review before acting on it. Clicking
                  a diff badge here deselects it, same as clicking its
                  twin down in the grid (they're the same selection
                  state, just two views of it). */}
              {selectedCount > 0 && (
                <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto mt-3 pt-3 border-t border-neutral-700">
                  {Object.entries(selectedDiffs).map(([hash, chars]) => (
                    <div key={hash} className="w-full sm:w-[calc(50%-4px)] lg:w-[calc(33.333%-6px)]">
                      <SelectedSongChip
                        hash={hash}
                        song={bsSongByHash[hash]}
                        selectedByChar={chars}
                        starsByChar={starRatingMap[hash]}
                        onToggleDiff={(characteristic, difficulty) =>
                          toggleDiffSelection(hash, characteristic, difficulty)
                        }
                        onRemoveSong={() => setSongSelection(hash, false, [])}
                      />
                    </div>
                  ))}
                </div>
              )}
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
              <HitbloqSongCard
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
      {!loading && visibleSongs.length > 0 && poolId === "funny_haha_pauls" && (
        <FunnyHahaPaulsSongs
          bsSongs={visibleSongs}
          starRatingMap={starRatingMap}
          poolId={poolId}
          selectedDiffs={selectedDiffs}
          toggleDiffSelection={toggleDiffSelection}
          editMode={editMode}
          setSongSelection={setSongSelection}
        />
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
