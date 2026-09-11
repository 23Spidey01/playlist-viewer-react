import React, { useEffect, useState } from "react";
import SongCard from "./SongCard";
import type { BSSongInfo, DetailedSong } from "./types";
import { diffMap, charMap } from "./types";
import { useSongPoolCache } from "./useSongPoolCache";
import { renderFunnyHahaPaulsSongs } from "./PoolFeatures/FunnyHahaPauls";
import PoolHeader from "./PoolHeader";
import type { PoolDetailed, LeaderEntry } from "./PoolHeader";

interface SongListProps {
  poolId: string;
  pool: PoolDetailed;
}

type SongSortKey = "stars" | "name" | "newest" | "diffs";

const SONG_SORTS: { key: SongSortKey; label: string }[] = [
  { key: "stars", label: "STAR RATING" },
  { key: "name", label: "A–Z" },
  { key: "newest", label: "NEWEST" },
  { key: "diffs", label: "MOST DIFFS" },
];

const SongList: React.FC<SongListProps> = ({ poolId, pool }) => {
  // State for all songs from Hitbloq (ranked_list_detailed)
  const [songs, setSongs] = useState<DetailedSong[]>([]);
  // State for all songs found from BeatSaver
  const [bsSongs, setBsSongs] = useState<BSSongInfo[]>([]);
  // Loading indicator
  const [loading, setLoading] = useState(false);
  // Map for star ratings: hash -> characteristic -> difficulty -> stars
  const [starRatingMap, setStarRatingMap] = useState<
    Record<string, Record<string, Record<string, number>>>
  >({});
  // Indicates whether the list of missing songs is displayed
  const [showMissing, setShowMissing] = useState(false);
  const { cache, setCache } = useSongPoolCache();

  // State for selected difficulties
  const [selectedDiffs, setSelectedDiffs] = useState<{
    [hash: string]: { [characteristic: string]: string[] };
  }>({});

  // State for edit mode
  const [editMode, setEditMode] = useState(false);

  // State for the song search + sort controls
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SongSortKey>("stars");

  // Leaving edit mode clears any selected difficulties
  const toggleEditMode = () => {
    setEditMode((v) => {
      if (v) setSelectedDiffs({});
      return !v;
    });
  };

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

  const handleRecalculateCR = async () => {
    const key = prompt("Please enter the API key for this pool:");
    if (!key) return alert("No API key entered.");
    setLoading(true);
    const res = await fetch("http://localhost:3001/proxy/recalculate_cr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId }),
    });
    setLoading(false);
    const result = await res.json();
    alert(
      result.status === "success"
        ? "CR recalculated!"
        : "Error: " + (result.error || result.status),
    );
  };

  // Load all songs from the selected pool (Hitbloq API)
  useEffect(() => {
    if (!poolId) return;
    // Check if songs are already in cache
    if (cache[poolId]?.songs?.length) {
      setSongs(cache[poolId].songs);
      setBsSongs(cache[poolId].bsSongs);
      setStarRatingMap(cache[poolId].starRatingMap);
      setLoading(false);
      return;
    }
    setLoading(true);

    const fetchAllSongs = async () => {
      let page = 0;
      let allSongs: DetailedSong[] = [];
      while (true) {
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
      const loadedBsSongs = await fetchBeatSaverSongs(hashes);

      setBsSongs(loadedBsSongs);
      setLoading(false);
      setStarRatingMap(buildStarRatingMap(allSongs));
      setCache((old) => ({
        ...old,
        [poolId]: {
          songs: allSongs,
          bsSongs: loadedBsSongs,
          starRatingMap: buildStarRatingMap(allSongs),
        },
      }));
    };

    fetchAllSongs();
  }, [poolId, cache, setCache]);

  // Fetch BeatSaver info for all hashes (in chunks to avoid rate limits)
  const fetchBeatSaverSongs = async (hashes: string[]) => {
    const CHUNK_SIZE = 50;
    const DELAY_MS = 50;
    const results: BSSongInfo[] = [];
    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
      const chunk = hashes.slice(i, i + CHUNK_SIZE);
      const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
      results.push(...songsArray);
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
    return results;
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
    const key = prompt("API Key?");
    if (!key) return;
    let count = 0;
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          if (starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined)
            continue;
          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
          await fetch("http://localhost:3001/proxy/rank", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, pool: poolId, song: formattedId }),
          });
          count++;
        }
      }
    }
    await fetch("http://localhost:3001/proxy/recalculate_cr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId }),
    });
    alert(`${count} Difficulties ranked and CR recalculated!`);
    window.location.reload();
  };

  // Unrank every selected difficulty (only allowed when all are currently ranked)
  const unrankAllSelected = async () => {
    if (!allSelectedAreRanked) return;
    const key = prompt("API Key?");
    if (!key) return;
    let count = 0;
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
          await fetch("http://localhost:3001/proxy/unrank", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, pool: poolId, song: formattedId }),
          });
          count++;
        }
      }
    }
    await fetch("http://localhost:3001/proxy/recalculate_cr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId }),
    });
    alert(`${count} Difficulties unranked!`);
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
      const proceed = window.confirm(
        "Your selection contains difficulties that are not ranked yet.\n" +
          "Should these be ranked first and then the star rating be set?",
      );
      if (!proceed) return;
      const rankKey = prompt("API Key?");
      if (!rankKey) return;
      for (const { hash, characteristic, difficulty } of unrankedDiffs) {
        const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
        await fetch("http://localhost:3001/proxy/rank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: rankKey,
            pool: poolId,
            song: formattedId,
          }),
        });
      }
      await fetch("http://localhost:3001/proxy/recalculate_cr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rankKey, pool: poolId }),
      });
      alert(
        `${unrankedDiffs.length} Difficulties ranked first! Now the star rating will be set.`,
      );
    }

    const key = prompt("API Key?");
    if (!key) return;
    const isAutomatic = window.confirm(
      "Calculate star rating automatically?\n\nOK = Automatic\nCancel = Manual",
    );
    let manualRating: number | undefined = undefined;
    if (!isAutomatic) {
      let rating = prompt("What star rating to set for all? (e.g. 8.5)");
      if (!rating) return alert("No star rating entered.");
      rating = rating.replace(",", ".");
      manualRating = parseFloat(rating);
      if (isNaN(manualRating) || manualRating < 0)
        return alert("Invalid star rating.");
    }
    let count = 0;
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
          if (isAutomatic) {
            await fetch("http://localhost:3001/proxy/set_automatic", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key, pool: poolId, song: formattedId }),
            });
          } else {
            await fetch("http://localhost:3001/proxy/set_manual", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key,
                pool: poolId,
                song: formattedId,
                rating: manualRating,
              }),
            });
          }
          count++;
        }
      }
    }
    await fetch("http://localhost:3001/proxy/recalculate_cr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId }),
    });
    alert(`${count} Difficulties changed and CR recalculated!`);
    window.location.reload();
  };

  return (
    <div>
      {/* Loading indicator */}
      {loading && <p className="text-cyan-400">Loading pool...</p>}
      {!loading && (
        <PoolHeader
          pool={pool}
          rankedDiffs={songs.length}
          foundOnBeatSaver={bsSongs.length}
          missingCount={missingHashes.length}
          showMissing={showMissing}
          onToggleMissing={() => setShowMissing((v) => !v)}
          onRankNewMaps={() =>
            (window.location.href = `/pool/${poolId}/rank-new`)
          }
          onRecalculateCR={handleRecalculateCR}
          editMode={editMode}
          onToggleEditMode={toggleEditMode}
          leaders={leaders}
        />
      )}
      {/* Actions for the current difficulty selection (edit mode) */}
      {!loading && editMode && (
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
      )}
      {/* List missing songs (collapsible, toggled from the header) */}
      {!loading && missingHashes.length > 0 && showMissing && (
        <div className="pixel-missing-panel">
          <div className="flex flex-wrap items-center gap-3">
            <span className="pixel-font text-[10px] text-red-400">
              {missingHashes.length} SONGS NOT FOUND ON BEATSAVER
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
            {missingHashes.map((hash) => {
              const missingSongs = songs.filter((song) =>
                song.song_id.startsWith(hash),
              );
              return missingSongs.map((song) => {
                const parts = song.song_id.split("_");
                const diffShort = parts[1];
                const charShort = parts[2];
                const difficulty = diffMap[diffShort] || diffShort;
                const characteristic = charMap[charShort] || charShort;
                const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                return (
                  <div key={song.song_id} className="pixel-missing-row">
                    {formattedId}
                  </div>
                );
              });
            })}
          </div>
          <button
            className="pixel-btn danger"
            onClick={async () => {
              const key = prompt("Please enter the API key for this pool:");
              if (!key) return alert("No API key entered.");
              if (
                !confirm(
                  "Are you sure you want to send all missing songs as unranked?",
                )
              )
                return;

              setLoading(true);
              let count = 0;
              for (const hash of missingHashes) {
                const missingSongs = songs.filter((song) =>
                  song.song_id.startsWith(hash),
                );
                for (const song of missingSongs) {
                  const parts = song.song_id.split("_");
                  const diffShort = parts[1];
                  const charShort = parts[2];
                  const difficulty = diffMap[diffShort] || diffShort;
                  const characteristic = charMap[charShort] || charShort;
                  const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                  await fetch("http://localhost:3001/proxy/unrank", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      key,
                      pool: poolId,
                      song: formattedId,
                    }),
                  });
                  count++;
                }
              }
              setLoading(false);
              alert(`${count} Songs sent as unranked!`);
            }}
          >
            Unrank All Missing Songs
          </button>
        </div>
      )}
      {/* Search + sort for the song list below */}
      {!loading && bsSongs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
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
          {visibleSongs.map((song) => (
            <SongCard
              key={song.versions?.[0]?.hash || song.id}
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
          ))}
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
