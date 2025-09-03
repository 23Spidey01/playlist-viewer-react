import React, { useEffect, useState } from "react";
import type { HBPlaylist, BSSongInfo } from "./types";
import SongCard from "./SongCard";

interface SongListProps {
  playlist: HBPlaylist;
}

const CHUNK_SIZE = 50;
const DELAY_MS = 250;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const SongList: React.FC<SongListProps> = ({ playlist }) => {
  const [songsInfo, setSongsInfo] = useState<BSSongInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSongs = async () => {
      if (!playlist?.songs?.length) return;
      setLoading(true);

      const hashes = playlist.songs.map((s) => s.hash.toLowerCase());
      const chunks: string[][] = [];

      for (let i = 0; i < hashes.length; i += CHUNK_SIZE) {
        chunks.push(hashes.slice(i, i + CHUNK_SIZE));
      }

      const results: BSSongInfo[] = [];

      for (const chunk of chunks) {
        try {
          const url = `https://api.beatsaver.com/maps/hash/${chunk.join(",")}`;
          const res = await fetch(url);

          if (!res.ok) {
            console.warn("Chunk fehlgeschlagen:", res.status, await res.text());
            await delay(DELAY_MS);
            continue;
          }

          const data = await res.json();
          console.log("API Response:", data);

          // Hashes, die nicht gefunden wurden
          const missingHashes = chunk.filter(
            (hash) => !data[hash]
          );
          if (missingHashes.length > 0) {
            console.warn("Nicht gefundene Hashes:", missingHashes);
          }

          const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
          results.push(...songsArray);
          console.log("Songs gesammelt bisher:", results.length);

          await delay(DELAY_MS);
        } catch (err) {
          console.error("Fehler beim Abrufen der Songs:", err);
          await delay(DELAY_MS);
        }
      }

      setSongsInfo(results);
      setLoading(false);
    };

    fetchSongs();
  }, [playlist]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{playlist.playlistTitle}</h2>
        <p className="text-gray-600">{playlist.playlistDescription}</p>
        <p className="text-sm text-gray-400">
          {songsInfo.length} Songs geladen
        </p>
      </div>
      {loading && <p>Loading songs...</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {songsInfo.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </div>
  );
};

export default SongList;
