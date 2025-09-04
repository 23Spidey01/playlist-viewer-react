import React, { useEffect, useState } from "react";
import SongCard from "./SongCard";
import type { BSSongInfo } from "./types";

interface DetailedSong {
  song_cover: string;
  song_difficulty: string;
  song_id: string;
  song_name: string;
  song_plays: number;
  song_stars: number;
}

interface SongListProps {
  poolId: string;
}

const diffMap: Record<string, string> = {
  ep: "ExpertPlus",
  ex: "Expert",
  h: "Hard",
  n: "Normal",
  e: "Easy",
};
const charMap: Record<string, string> = {
  s: "Standard",
  sll: "Lawless",
  sls: "Lightshow",
  sna: "NoArrows",
  s360: "360Degree",
};

const SongList: React.FC<SongListProps> = ({ poolId }) => {
  const [songs, setSongs] = useState<DetailedSong[]>([]);
  const [bsSongs, setBsSongs] = useState<BSSongInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [starRatingMap, setStarRatingMap] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    if (!poolId) return;
    setLoading(true);

    // Alle Songs aus ranked_list_detailed holen
    const fetchAllSongs = async () => {
      let page = 0;
      let allSongs: DetailedSong[] = [];
      while (true) {
        const res = await fetch(`http://localhost:3001/proxy/ranked_list_detailed/${poolId}/${page}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        allSongs = allSongs.concat(data);
        if (data.length < 30) break;
        page++;
      }
      setSongs(allSongs);
      setLoading(false);
    };

    fetchAllSongs();
  }, [poolId]);

  useEffect(() => {
    if (songs.length === 0) return;
    setStarRatingMap(buildStarRatingMap(songs));
    const hashes = Array.from(new Set(songs.map(song => song.song_id.split("_")[0].toLowerCase())));
    fetchBeatSaverSongs(hashes).then(setBsSongs);
  }, [songs]);

  // BeatSaver-Infos holen
  const fetchBeatSaverSongs = async (hashes: string[]) => {
    const CHUNK_SIZE = 50;
    const DELAY_MS = 250;
    const results: BSSongInfo[] = [];
    for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
      const chunk = hashes.slice(i, i + CHUNK_SIZE);
      const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
      results.push(...songsArray);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
    return results;
  };

  // Star-Rating-Map bauen
  const buildStarRatingMap = (songs: DetailedSong[]) => {
    const map: Record<string, Record<string, Record<string, number>>> = {};
    songs.forEach(song => {
      const parts = song.song_id.split("_");
      const hash = parts[0].toUpperCase();
      const diffShort = parts[1];
      const charShort = parts[2];
      const difficulty = diffMap[diffShort] || diffShort;
      const characteristic = charMap[charShort] || charShort;

      if (!map[hash]) map[hash] = {};
      if (!map[hash][characteristic]) map[hash][characteristic] = {};
      map[hash][characteristic][difficulty] = song.song_stars;
    });
    return map;
  };

  // Hashes aus Hitbloq
  const hitbloqHashes = songs.map(song => song.song_id.split("_")[0].toUpperCase());
  // Hashes aus BeatSaver
  const beatsaverHashes = bsSongs.map(song => song.versions?.[0]?.hash?.toUpperCase()).filter(Boolean);
  // Fehlende Hashes
  const missingHashes = Array.from(new Set(hitbloqHashes)).filter(hash => !beatsaverHashes.includes(hash));

  return (
    <div>
      {loading && <p className="text-cyan-400">Pool wird geladen...</p>}
      {/* Statistik */}
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
            {missingHashes.length > 0 && (
              <button
                className="px-2 py-1 bg-neutral-700 text-neutral-200 rounded hover:bg-neutral-600 text-xs"
                onClick={() => setShowMissing((v) => !v)}
              >
                {showMissing ? "Liste verbergen" : "Liste anzeigen"}
              </button>
            )}
            {missingHashes.length > 0 && (
              <button
                className="px-2 py-1 bg-neutral-700 text-neutral-200 rounded hover:bg-neutral-600 text-xs"
                onClick={() => navigator.clipboard.writeText(missingHashes.join("\n"))}
              >
                Hash-Liste kopieren
              </button>
            )}
            {/* Recalculate CR Button - größer und rechtsbündig */}
            <button
              className="ml-auto px-6 py-3 bg-cyan-700 text-neutral-100 rounded-lg hover:bg-cyan-800 text-base font-bold shadow transition-all"
              style={{ minWidth: "180px" }}
              onClick={async () => {
                const key = prompt("Bitte gib den API-Key für diesen Pool ein:");
                if (!key) return alert("Kein API-Key eingegeben.");
                setLoading(true);
                const res = await fetch("http://localhost:3001/proxy/recalculate_cr", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key, pool: poolId }),
                });
                setLoading(false);
                const result = await res.json();
                alert(result.status === "success"
                  ? "CR wurde neu berechnet!"
                  : "Fehler: " + (result.error || result.status));
              }}
            >
              CR neu berechnen
            </button>
          </span>
        </div>
      )}
      {/* Fehlende Songs auflisten (aufklappbar) */}
      {!loading && missingHashes.length > 0 && showMissing && (
        <div className="mt-2 text-orange-400 text-xs">
          <ul className="list-disc pl-6">
            {missingHashes.map(hash => {
              const missingSongs = songs.filter(song => song.song_id.startsWith(hash));
              return missingSongs.map((song) => {
                const parts = song.song_id.split("_");
                const diffShort = parts[1];
                const charShort = parts[2];
                const difficulty = diffMap[diffShort] || diffShort;
                const characteristic = charMap[charShort] || charShort;
                // Song-ID im gewünschten Format
                const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
                return (
                  <li key={song.song_id}>
                    <span className="font-mono">{formattedId}</span>
                  </li>
                );
              });
            })}
          </ul>
          {/* Unrank-Button */}
          <button
            className="mt-4 px-3 py-2 bg-red-700 text-white rounded hover:bg-red-800 font-semibold"
            onClick={async () => {
              const key = prompt("Bitte gib den API-Key für diesen Pool ein:");
              if (!key) return alert("Kein API-Key eingegeben.");
              if (!confirm("Bist du sicher, dass du alle fehlenden Songs unranked senden möchtest?")) return;

              setLoading(true);
              let count = 0;
              for (const hash of missingHashes) {
                const missingSongs = songs.filter(song => song.song_id.startsWith(hash));
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
      {/* Nur BeatSaver SongCards anzeigen */}
      {!loading && bsSongs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bsSongs.map((song) => (
            <SongCard
              key={song.versions?.[0]?.hash || song.id}
              song={song}
              starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
            />
          ))}
        </div>
      )}
      {!loading && bsSongs.length === 0 && (
        <p className="text-orange-400">Keine Songs gefunden.</p>
      )}
    </div>
  );
};

export default SongList;