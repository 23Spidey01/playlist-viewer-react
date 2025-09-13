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
  // State für alle Songs aus Hitbloq (ranked_list_detailed)
  const [songs, setSongs] = useState<DetailedSong[]>([]);
  // State für alle Songs, die von BeatSaver gefunden wurden
  const [bsSongs, setBsSongs] = useState<BSSongInfo[]>([]);
  // Ladeanzeige
  const [loading, setLoading] = useState(false);
  // Map für Star-Ratings: hash -> characteristic -> difficulty -> stars
  const [starRatingMap, setStarRatingMap] = useState<
    Record<string, Record<string, Record<string, number>>>
  >({});
  // Zeigt an, ob die Liste der fehlenden Songs angezeigt wird
  const [showMissing, setShowMissing] = useState(false);
  const { cache, setCache } = useSongPoolCache();

  // State für ausgewählte Schwierigkeitsgrade
  const [selectedDiffs, setSelectedDiffs] = useState<{
    [hash: string]: { [characteristic: string]: string[] };
  }>({});

  // State für Bearbeitungsmodus
  const [editMode, setEditMode] = useState(false);

  // Lädt alle Songs aus dem gewählten Pool (Hitbloq API)
  useEffect(() => {
    if (!poolId) return;
    // Prüfe, ob Songs schon im Cache sind
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
        if (data.length < 30) break; // Letzte Seite erreicht
        page++;
      }
      setSongs(allSongs);
      setLoading(false);

      // BeatSaver-Songs laden und dann alles in den Cache schreiben!
      const hashes = Array.from(
        new Set(
          allSongs.map((song) => song.song_id.split("_")[0].toLowerCase())
        )
      );
      const loadedBsSongs = await fetchBeatSaverSongs(hashes);

      setBsSongs(loadedBsSongs);
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

  // Holt BeatSaver-Infos für alle Hashes (in Chunks, um Rate-Limits zu vermeiden)
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

  // Baut eine Map: hash -> characteristic -> difficulty -> starRating
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

  // Hashes aus Hitbloq-Songs (uppercase)
  const hitbloqHashes = songs.map((song) =>
    song.song_id.split("_")[0].toUpperCase()
  );
  // Hashes aus BeatSaver-Songs (uppercase)
  const beatsaverHashes = bsSongs
    .map((song) => song.versions?.[0]?.hash?.toUpperCase())
    .filter(Boolean);
  // Hashes, die in Hitbloq aber nicht in BeatSaver sind
  const missingHashes = Array.from(new Set(hitbloqHashes)).filter(
    (hash) => !beatsaverHashes.includes(hash)
  );

  // Schwierigkeitsgrad-Auswahl umschalten
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
      {/* Ladeanzeige */}
      {loading && <p className="text-cyan-400">Pool wird geladen...</p>}
      {/* Statistik und Aktionen */}
      {!loading && (
        <div className="mb-6 text-neutral-300 text-sm flex flex-wrap gap-4 items-center">
          <span>
            Ranked Difficulties im Pool: <b>{songs.length}</b>
          </span>
          <span>
            Songs gefunden bei BeatSaver: <b>{bsSongs.length}</b>
          </span>
          <span className="flex items-center gap-2 flex-wrap w-full">
            Nicht gefundene Songs: <b>{missingHashes.length}</b>
            {/* Button zum Auf-/Zuklappen der fehlenden Hash-Liste */}
            {missingHashes.length > 0 && (
              <button
                className="px-2 py-1 bg-neutral-700 text-neutral-200 rounded hover:bg-neutral-600 text-xs"
                onClick={() => setShowMissing((v) => !v)}
              >
                {showMissing ? "Liste verbergen" : "Liste anzeigen"}
              </button>
            )}
            {/* Button zum Kopieren der fehlenden Hashes */}
            {missingHashes.length > 0 && (
              <button
                className="px-2 py-1 bg-neutral-700 text-neutral-200 rounded hover:bg-neutral-600 text-xs"
                onClick={() =>
                  navigator.clipboard.writeText(missingHashes.join("\n"))
                }
              >
                Hash-Liste kopieren
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
                Rank new maps
              </button>
              <button
                className="px-6 py-3 bg-cyan-700 text-neutral-100 rounded-lg hover:bg-cyan-800 text-base font-bold shadow transition-all"
                style={{ minWidth: "180px" }}
                onClick={async () => {
                  const key = prompt(
                    "Bitte gib den API-Key für diesen Pool ein:"
                  );
                  if (!key) return alert("Kein API-Key eingegeben.");
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
                      ? "CR wurde neu berechnet!"
                      : "Fehler: " + (result.error || result.status)
                  );
                }}
              >
                CR neu berechnen
              </button>
              {/* Aktionen für ausgewählte Schwierigkeitsgrade */}
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
                      const key = prompt("API-Key?");
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
                      // CR recalculaten
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      alert(`${count} Difficulties wurden unranked!`);
                      window.location.reload();
                    }}
                  >
                    Alle ausgewählten unranken
                  </button>
                  <button
                    className="px-4 py-2 bg-yellow-700 text-white rounded hover:bg-yellow-800 font-semibold"
                    onClick={async () => {
                      // Prüfe, ob es ungerankte Diffs in der Auswahl gibt
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
                          "In deiner Auswahl sind Difficulties, die noch nicht gerankt sind.\n" +
                          "Sollen diese zuerst gerankt werden und danach das Star Rating gesetzt werden?"
                        );
                        if (!proceed) return;
                        const key = prompt("API-Key?");
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
                        alert(`${unrankedDiffs.length} Difficulties wurden zuerst gerankt! Jetzt wird das Star Rating gesetzt.`);
                        // Jetzt wie gewohnt mit dem Star Rating fortfahren (siehe unten)
                      }
                      const key = prompt("API-Key?");
                      if (!key) return;
                      const isAutomatic = window.confirm(
                        "Star Rating automatisch berechnen?\n\nOK = Automatisch\nAbbrechen = Manuell"
                      );
                      let manualRating: number | undefined = undefined;
                      if (!isAutomatic) {
                        let rating = prompt("Welches Star Rating für alle setzen? (z.B. 8.5)");
                        if (!rating) return alert("Kein Star Rating eingegeben.");
                        rating = rating.replace(",", ".");
                        manualRating = parseFloat(rating);
                        if (isNaN(manualRating) || manualRating < 0) return alert("Ungültiges Star Rating.");
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
                      // CR recalculaten
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      alert(`${count} Difficulties wurden geändert und CR wurde neu berechnet!`);
                      window.location.reload();
                    }}
                  >
                    Star Rating für Auswahl setzen
                  </button>
                  <button
                    className="px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 font-semibold disabled:opacity-50"
                    disabled={!allSelectedAreUnranked}
                    onClick={async () => {
                      if (!allSelectedAreUnranked) return;
                      const key = prompt("API-Key?");
                      if (!key) return;
                      let count = 0;
                      for (const hash in selectedDiffs) {
                        for (const characteristic in selectedDiffs[hash]) {
                          for (const difficulty of selectedDiffs[hash][characteristic]) {
                            // Nur wenn noch nicht gerankt:
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
                      // CR recalculaten
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      alert(`${count} Difficulties wurden gerankt und CR wurde neu berechnet!`);
                      window.location.reload();
                    }}
                  >
                    Alle ausgewählten ranken
                  </button>
                </div>
              )}
            </div>
          </span>
        </div>
      )}
      {/* Fehlende Songs auflisten (aufklappbar) */}
      {!loading && missingHashes.length > 0 && showMissing && (
        <div className="mt-2 text-orange-400 text-xs">
          <ul className="list-disc pl-6">
            {/* Für jeden fehlenden Hash alle zugehörigen Songs mit Difficulty/Characteristic anzeigen */}
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
                // Song-ID im gewünschten Format für Unrank-API
                const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                return (
                  <li key={song.song_id}>
                    <span className="font-mono">{formattedId}</span>
                  </li>
                );
              });
            })}
          </ul>
          {/* Button: Alle fehlenden Songs als unranked an die API senden */}
          <button
            className="mt-4 px-3 py-2 bg-red-700 text-white rounded hover:bg-red-800 font-semibold"
            onClick={async () => {
              const key = prompt("Bitte gib den API-Key für diesen Pool ein:");
              if (!key) return alert("Kein API-Key eingegeben.");
              if (
                !confirm(
                  "Bist du sicher, dass du alle fehlenden Songs unranked senden möchtest?"
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
              alert(`${count} Songs wurden als unranked gesendet!`);
            }}
          >
            Alle fehlenden Songs unranked senden
          </button>
        </div>
      )}
      {/* Bearbeiten-Button über der Songliste, rechtsbündig */}
      <div className="flex w-full justify-end mb-4">
        <button
          className={`px-4 py-2 rounded font-semibold transition ${
            editMode
              ? "bg-cyan-800 text-white"
              : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
          }`}
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? "Bearbeiten beenden" : "Bearbeiten"}
        </button>
      </div>

      {/* BeatSaver SongCards anzeigen */}
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
      {/* Hinweis, falls keine Songs gefunden wurden */}
      {!loading && bsSongs.length === 0 && (
        <p className="text-orange-400">Keine Songs gefunden.</p>
      )}
    </div>
  );
};

export default SongList;
