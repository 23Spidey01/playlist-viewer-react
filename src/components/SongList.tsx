import React, { useEffect, useState } from "react";
import type { HBPlaylist, BSSongInfo } from "./types";
import SongCard from "./SongCard";

interface SongListProps {
  playlist: HBPlaylist;
}

// Wie viele Hashes pro API-Request abgefragt werden
const CHUNK_SIZE = 50;
// Wartezeit zwischen API-Requests (ms)
const DELAY_MS = 250;

// Hilfsfunktion für Delay
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const SongList: React.FC<SongListProps> = ({ playlist }) => {
  // Songs, die von der BeatSaver API gefunden wurden
  const [songsInfo, setSongsInfo] = useState<BSSongInfo[]>([]);
  // Ladeanzeige
  const [loading, setLoading] = useState(false);
  // Hashes, die nicht gefunden wurden
  const [missingHashes, setMissingHashes] = useState<string[]>([]);
  // Zeigt die Liste der fehlenden Hashes an
  const [showMissing, setShowMissing] = useState(false);

  // Lädt die Songs von BeatSaver anhand der Hashes aus der Playlist
  useEffect(() => {
    const fetchSongs = async () => {
      if (!playlist?.songs?.length) return;
      setLoading(true);

      // Alle Hashes aus der Playlist in Kleinbuchstaben
      const hashes = playlist.songs.map((s) => s.hash.toLowerCase());
      // Hashes in Blöcke aufteilen (API-Limit)
      const chunks: string[][] = [];
      for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
        chunks.push(hashes.slice(i, i + CHUNK_SIZE));
      }

      const results: BSSongInfo[] = [];
      const notFound: string[] = [];
      // Für jeden Block API-Request ausführen
      for (const chunk of chunks) {
        try {
          const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
          const res = await fetch(url);

          if (!res.ok) {
            // Bei Fehler: Warte und mache weiter
            await delay(DELAY_MS);
            continue;
          }

          const data = await res.json();
          // Prüfe, welche Hashes nicht gefunden wurden
          chunk.forEach(hash => {
            if (!data[hash]) notFound.push(hash);
          });

          // Songs aus der API-Antwort sammeln
          const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
          results.push(...songsArray);

          await delay(DELAY_MS);
        } catch {
          await delay(DELAY_MS);
        }
      }

      setSongsInfo(results);      // Gefundene Songs speichern
      setMissingHashes(notFound); // Fehlende Hashes speichern
      setLoading(false);          // Ladeanzeige aus
    };

    fetchSongs();
  }, [playlist]);

  return (
    <div className="w-full">
      {/* Playlist Header */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row items-center gap-6 bg-neutral-800 rounded-xl shadow p-6 border border-neutral-700">
          {/* Playlist Cover */}
          {playlist.image && (
            <img
              src={playlist.image}
              alt="Playlist Cover"
              className="w-28 h-28 md:w-36 md:h-36 object-cover rounded-lg border border-neutral-700 shadow"
            />
          )}
          <div className="text-center md:text-left">
            {/* Playlist Titel */}
            <h2 className="text-2xl font-bold text-cyan-400 mb-2">{playlist.playlistTitle}</h2>
            {/* Playlist Beschreibung (HTML wird gerendert) */}
            <p
              className="text-neutral-300"
              dangerouslySetInnerHTML={{ __html: playlist.playlistDescription }}
            />
            {/* Song-Anzahl und fehlende Hashes */}
            <p className="text-sm text-neutral-400 mt-2">
              <span className="font-semibold text-cyan-300">{songsInfo.length}</span> Songs geladen
              {missingHashes.length > 0 && (
                <button
                  className="ml-2 text-red-400 underline cursor-pointer"
                  onClick={() => setShowMissing((v) => !v)}
                >
                  ({missingHashes.length} nicht gefunden)
                </button>
              )}
            </p>
            {/* Die Liste und der Button jetzt außerhalb des <p> */}
            {missingHashes.length > 0 && showMissing && (
              <div className="mt-2 p-2 bg-neutral-900 rounded border border-neutral-700 text-xs text-red-300 max-h-40 overflow-auto">
                <div className="font-bold mb-1">Nicht gefundene Hashes:</div>
                <ul className="list-disc pl-4">
                  {missingHashes.map((hash) => {
                    const song = playlist.songs.find(s => s.hash.toLowerCase() === hash.toLowerCase());
                    return (
                      <li key={hash}>
                        <span className="font-mono">{hash.toUpperCase()}</span>
                        {song && song.difficulties.length > 0 && (
                          <span className="ml-2 text-neutral-400">
                            [
                            {song.difficulties.map((diff, idx) => (
                              <span key={idx}>
                                {diff.characteristic} – {diff.name}
                                {idx < song.difficulties.length - 1 ? ", " : ""}
                              </span>
                            ))}
                            ]
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* Unrank All Button */}
                <button
                  className="mt-4 w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 transition font-semibold cursor-pointer"
                  onClick={async () => {
                    // Setze hier deinen API-Key und Pool-ID
                    const apiKey = "DEIN_API_KEY";
                    const poolId = "DEINE_POOL_ID";

                    // Für jeden nicht gefundenen Hash:
                    for (const hash of missingHashes) {
                      // Finde das passende Song-Objekt in der Playlist
                      const song = playlist.songs.find(s => s.hash.toLowerCase() === hash.toLowerCase());
                      if (!song) continue;
                      // Für jede Difficulty des Songs:
                      for (const diff of song.difficulties) {
                        // Diff-Name mit erstem Buchstaben groß
                        const diffName =
                          diff.name.charAt(0).toUpperCase() + diff.name.slice(1);
                        // Baue die Song-ID für die API (Format: hash|_Difficulty_SoloCharacteristic)
                        const songId = `${song.hash}|_${diffName}_Solo${diff.characteristic}`;
                        const requestBody = {
                          key: apiKey,
                          pool: poolId,
                          song: songId,
                        };
                        // Sende den Unrank-Request
                        await fetch("http://localhost:3001/proxy/unrank", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(requestBody),
                        });
                      }
                    }
                    alert("Alle Difficulties wurden unranked!");
                  }}
                >
                  Unrank All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ladeanzeige */}
      {loading && (
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-neutral-700 border-t-cyan-400 rounded-full animate-spin mb-2"></div>
            <p className="text-cyan-400 font-medium">Songs werden geladen...</p>
          </div>
        </div>
      )}

      {/* Song Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {songsInfo.map((song) => {
          // Finde das passende Song-Objekt aus der Playlist für die SongCard
          const playlistSong = playlist.songs.find(s => s.hash.toLowerCase() === song.versions?.[0]?.hash?.toLowerCase());
          return <SongCard key={song.id} song={song} playlistSong={playlistSong} />;
        })}
      </div>

      {/* Anzeige, wenn keine Songs gefunden wurden */}
      {!loading && songsInfo.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-neutral-800 rounded-full mb-4">
            <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-200">Keine Songs gefunden</h3>
          <p className="text-neutral-400 mt-2">Die Playlist scheint keine Songs zu enthalten oder es gab einen Fehler beim Laden.</p>
        </div>
      )}
    </div>
  );
};

export default SongList;