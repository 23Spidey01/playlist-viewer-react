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
          // Hashes, die nicht gefunden wurden
          const missingHashes = chunk.filter(
            (hash) => !data[hash]
          );
          if (missingHashes.length > 0) {
            console.warn("Nicht gefundene Hashes:", missingHashes);
          }

          const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
          results.push(...songsArray);

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Playlist Header */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row items-center gap-6 bg-white rounded-2xl shadow-xl p-6 backdrop-blur-sm bg-opacity-90 border border-white border-opacity-20">
            {playlist.image && (
              <img
                src={playlist.image}
                alt="Playlist Cover"
                className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-xl shadow-md border-2 border-white"
              />
            )}
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {playlist.playlistTitle}
              </h2>
              <p className="text-gray-600 mt-2 text-lg">{playlist.playlistDescription}</p>
              <p className="text-sm text-gray-500 mt-4">
                <span className="font-semibold text-purple-600">{songsInfo.length}</span> Songs geladen
              </p>
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-center mb-8">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-2"></div>
              <p className="text-purple-600 font-medium">Songs werden geladen...</p>
            </div>
          </div>
        )}

        {/* Song Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {songsInfo.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>

        {/* Empty State */}
        {!loading && songsInfo.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700">Keine Songs gefunden</h3>
            <p className="text-gray-500 mt-2">Die Playlist scheint keine Songs zu enthalten oder es gab einen Fehler beim Laden.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongList;