import React, { useEffect, useState } from "react";
import SongCard from "./SongCard";
import type { BSSongInfo, DetailedSong } from "./types";
import { diffMap, charMap } from "./types";
import { useSongPoolCache } from "./useSongPoolCache";
import { renderFunnyHahaPaulsSongs } from "./PoolFeatures/FunnyHahaPauls";

interface SongListProps {
  poolId: string;
}

const SongList: React.FC<SongListProps> = ({ poolId }) => {
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
          `http://localhost:3001/proxy/ranked_list_detailed/${poolId}/${page}`
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
          allSongs.map((song) => song.song_id.split("_")[0].toLowerCase())
        )
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
    song.song_id.split("_")[0].toUpperCase()
  );
  // Hashes from BeatSaver songs (uppercase)
  const beatsaverHashes = bsSongs
    .map((song) => song.versions?.[0]?.hash?.toUpperCase())
    .filter(Boolean);
  // Hashes that are in Hitbloq but not in BeatSaver
  const missingHashes = Array.from(new Set(hitbloqHashes)).filter(
    (hash) => !beatsaverHashes.includes(hash)
  );

  // Toggle difficulty selection
  const toggleDiffSelection = (
    hash: string,
    characteristic: string,
    difficulty: string
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

  const allSelectedAreRanked = Object.entries(selectedDiffs).every(([hash, chars]) =>
    Object.entries(chars).every(([characteristic, diffs]) =>
      diffs.every(
        (difficulty) =>
          starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined
      )
    )
  );

  const allSelectedAreUnranked = Object.entries(selectedDiffs).every(([hash, chars]) =>
    Object.entries(chars).every(([characteristic, diffs]) =>
      diffs.every(
        (difficulty) =>
          starRatingMap[hash]?.[characteristic]?.[difficulty] === undefined
      )
    )
  );

  return (
    <div>
      {/* Loading indicator */}
      {loading && <p className="text-cyan-400">Loading pool...</p>}
      {/* Statistics and actions */}
      {!loading && (
        <div className="mb-6 text-neutral-300 text-sm flex flex-wrap gap-4 items-center">
          <span>
            Ranked Difficulties in Pool: <b>{songs.length}</b>
          </span>
          <span>
            Songs found on BeatSaver: <b>{bsSongs.length}</b>
          </span>
          <span className="flex items-center gap-2 flex-wrap w-full">
            Songs not found: <b>{missingHashes.length}</b>
            {/* Button to collapse/expand missing hash list */}
            {missingHashes.length > 0 && (
              <button
                className="px-2 py-1 bg-neutral-700 text-neutral-200 rounded hover:bg-neutral-600 text-xs"
                onClick={() => setShowMissing((v) => !v)}
              >
                {showMissing ? "Hide List" : "Show List"}
              </button>
            )}
            {/* Button to copy missing hashes */}
            {missingHashes.length > 0 && (
              <button
                className="px-2 py-1 bg-neutral-700 text-neutral-200 rounded hover:bg-neutral-600 text-xs"
                onClick={() =>
                  navigator.clipboard.writeText(missingHashes.join("\n"))
                }
              >
                Copy Hash List
              </button>
            )}
            <div className="flex w-full mt-2">
              <button
                className="px-6 py-3 bg-green-700 text-neutral-100 rounded-lg hover:bg-green-800 text-base font-bold shadow transition-all mr-4"
                style={{ minWidth: "180px" }}
                onClick={() =>
                  (window.location.href = `/pool/${poolId}/rank-new`)
                }
              >
                Rank New Maps
              </button>
              <button
                className="px-6 py-3 bg-cyan-700 text-neutral-100 rounded-lg hover:bg-cyan-800 text-base font-bold shadow transition-all"
                style={{ minWidth: "180px" }}
                onClick={async () => {
                  const key = prompt(
                    "Please enter the API key for this pool:"
                  );
                  if (!key) return alert("No API key entered.");
                  setLoading(true);
                  const res = await fetch(
                    "http://localhost:3001/proxy/recalculate_cr",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key, pool: poolId }),
                    }
                  );
                  setLoading(false);
                  const result = await res.json();
                  alert(
                    result.status === "success"
                      ? "CR recalculated!"
                      : "Error: " + (result.error || result.status)
                  );
                }}
              >
                Recalculate CR
              </button>
              {/* Actions for selected difficulties */}
              {Object.keys(selectedDiffs).some((hash) =>
                Object.values(selectedDiffs[hash] || {}).some(
                  (arr) => arr.length > 0
                )
              ) && (
                <div className="flex gap-4 flex-wrap ml-auto mb-4">
                  <button
                    className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 font-semibold disabled:opacity-50"
                    disabled={!allSelectedAreRanked}
                    onClick={async () => {
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
                      // CR recalculate
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      alert(`${count} Difficulties unranked!`);
                      window.location.reload();
                    }}
                  >
                    Unrank All Selected
                  </button>
                  <button
                    className="px-4 py-2 bg-yellow-700 text-white rounded hover:bg-yellow-800 font-semibold"
                    onClick={async () => {
                        // Check if there are unranked diffs in the selection
                      const unrankedDiffs: { hash: string; characteristic: string; difficulty: string }[] = [];
                      for (const hash in selectedDiffs) {
                        for (const characteristic in selectedDiffs[hash]) {
                          for (const difficulty of selectedDiffs[hash][characteristic]) {
                            if (starRatingMap[hash]?.[characteristic]?.[difficulty] === undefined) {
                              unrankedDiffs.push({ hash, characteristic, difficulty });
                            }
                          }
                        }
                      }

                      if (unrankedDiffs.length > 0) {
                        const proceed = window.confirm(
                          "Your selection contains difficulties that are not ranked yet.\n" +
                          "Should these be ranked first and then the star rating be set?"
                        );
                        if (!proceed) return;
                        const key = prompt("API Key?");
                        if (!key) return;

                        // Zuerst alle ungerankten Diffs ranken
                        for (const { hash, characteristic, difficulty } of unrankedDiffs) {
                          const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                          await fetch("http://localhost:3001/proxy/rank", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ key, pool: poolId, song: formattedId }),
                          });
                        }
                        // Optional: CR recalculaten nach dem Ranken, aber vor dem Star Rating setzen
                        await fetch("http://localhost:3001/proxy/recalculate_cr", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ key, pool: poolId }),
                        });
                        alert(`${unrankedDiffs.length} Difficulties ranked first! Now the star rating will be set.`);
                        // Now continue with star rating as usual (see below)
                      }
                      const key = prompt("API Key?");
                      if (!key) return;
                      const isAutomatic = window.confirm(
                        "Calculate star rating automatically?\n\nOK = Automatic\nCancel = Manual"
                      );
                      let manualRating: number | undefined = undefined;
                      if (!isAutomatic) {
                        let rating = prompt("What star rating to set for all? (e.g. 8.5)");
                        if (!rating) return alert("No star rating entered.");
                        rating = rating.replace(",", ".");
                        manualRating = parseFloat(rating);
                        if (isNaN(manualRating) || manualRating < 0) return alert("Invalid star rating.");
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
                                body: JSON.stringify({ key, pool: poolId, song: formattedId, rating: manualRating }),
                              });
                            }
                            count++;
                          }
                        }
                      }
                      // CR recalculate
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      alert(`${count} Difficulties changed and CR recalculated!`);
                      window.location.reload();
                    }}
                  >
                    Set Star Rating for Selection
                  </button>
                  <button
                    className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 font-semibold disabled:opacity-50"
                    disabled={!allSelectedAreUnranked}
                    onClick={async () => {
                      if (!allSelectedAreUnranked) return;
                      const key = prompt("API Key?");
                      if (!key) return;
                      let count = 0;
                      for (const hash in selectedDiffs) {
                        for (const characteristic in selectedDiffs[hash]) {
                          for (const difficulty of selectedDiffs[hash][characteristic]) {
                            // Only if not ranked yet:
                            const isRanked =
                              starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined;
                            if (isRanked) continue;
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
                      // CR recalculate
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      alert(`${count} Difficulties ranked and CR recalculated!`);
                      window.location.reload();
                    }}
                  >
                    Rank All Selected
                  </button>
                </div>
              )}
            </div>
          </span>
        </div>
      )}
      {/* List missing songs (collapsible) */}
      {!loading && missingHashes.length > 0 && showMissing && (
        <div className="mt-2 text-orange-400 text-xs">
          <ul className="list-disc pl-6">
            {/* For each missing hash, display all associated songs with difficulty/characteristic */}
            {missingHashes.map((hash) => {
              const missingSongs = songs.filter((song) =>
                song.song_id.startsWith(hash)
              );
              return missingSongs.map((song) => {
                const parts = song.song_id.split("_");
                const diffShort = parts[1];
                const charShort = parts[2];
                const difficulty = diffMap[diffShort] || diffShort;
                const characteristic = charMap[charShort] || charShort;
                // Song ID in desired format for unrank API
                const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                return (
                  <li key={song.song_id}>
                    <span className="font-mono">{formattedId}</span>
                  </li>
                );
              });
            })}
          </ul>
          {/* Button: Send all missing songs as unranked to the API */}
          <button
            className="mt-4 px-3 py-2 bg-red-700 text-white rounded hover:bg-red-800 font-semibold"
            onClick={async () => {
              const key = prompt("Please enter the API key for this pool:");
              if (!key) return alert("No API key entered.");
              if (
                !confirm(
                  "Are you sure you want to send all missing songs as unranked?"
                )
              )
                return;

              setLoading(true);
              let count = 0;
              for (const hash of missingHashes) {
                const missingSongs = songs.filter((song) =>
                  song.song_id.startsWith(hash)
                );
                for (const song of missingSongs) {
                  const parts = song.song_id.split("_");
                  const diffShort = parts[1];
                  const charShort = parts[2];
                  const difficulty = diffMap[diffShort] || diffShort;
                  const characteristic = charMap[charShort] || charShort;
                  const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                  const body = {
                    key,
                    pool: poolId,
                    song: formattedId,
                  };
                  await fetch("http://localhost:3001/proxy/unrank", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  count++;
                }
              }
              setLoading(false);
              alert(`${count} Songs sent as unranked!`);
            }}
          >
            Send All Missing Songs as Unranked
          </button>
        </div>
      )}
      {/* Edit button above song list, right-aligned */}
      <div className="flex w-full justify-end mb-4">
        <button
          className={`px-4 py-2 rounded font-semibold transition ${
            editMode
              ? "bg-cyan-800 text-white"
              : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
          }`}
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? "Exit Edit Mode" : "Edit"}
        </button>
      </div>

      {/* Display BeatSaver SongCards */}
      {!loading && bsSongs.length > 0 && poolId === "funny_haha_pauls" && (
        renderFunnyHahaPaulsSongs(
          bsSongs,
          starRatingMap,
          poolId,
          selectedDiffs,
          toggleDiffSelection,
          editMode
        )
      )}
      {!loading && bsSongs.length > 0 && poolId !== "funny_haha_pauls" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bsSongs.map((song) => (
            <SongCard
              key={song.versions?.[0]?.hash || song.id}
              song={song}
              starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
              poolId={poolId}
              selectedDiffs={selectedDiffs[song.versions?.[0]?.hash?.toUpperCase()] || {}}
              onToggleDiff={(characteristic, difficulty) =>
                toggleDiffSelection(song.versions?.[0]?.hash?.toUpperCase(), characteristic, difficulty)
              }
              editMode={editMode}
            />
          ))}
        </div>
      )}
      {/* Note if no songs were found */}
      {!loading && bsSongs.length === 0 && (
        <p className="text-orange-400">No songs found.</p>
      )}
    </div>
  );
};

export default SongList;
