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
            await delay(DELAY_MS);
            continue;
          }

          const data = await res.json();
          const songsArray = Object.values(data).filter(Boolean) as BSSongInfo[];
          results.push(...songsArray);

          await delay(DELAY_MS);
        } catch {
          await delay(DELAY_MS);
        }
      }

      setSongsInfo(results);
      setLoading(false);
    };

    fetchSongs();
  }, [playlist]);

  return (
    <div className="w-full">
      {/* Playlist Header */}
      <div className="mb-10">
        <div className="flex flex-col md:flex-row items-center gap-6 bg-neutral-800 rounded-xl shadow p-6 border border-neutral-700">
          {playlist.image && (
            <img
              src={playlist.image}
              alt="Playlist Cover"
              className="w-28 h-28 md:w-36 md:h-36 object-cover rounded-lg border border-neutral-700 shadow"
            />
          )}
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-cyan-400 mb-2">{playlist.playlistTitle}</h2>
            <p
              className="text-neutral-300"
              dangerouslySetInnerHTML={{ __html: playlist.playlistDescription }}
            />
            <p className="text-sm text-neutral-400 mt-2">
              <span className="font-semibold text-cyan-300">{songsInfo.length}</span> Songs geladen
            </p>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
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
          const playlistSong = playlist.songs.find(s => s.hash.toLowerCase() === song.versions?.[0]?.hash?.toLowerCase());
          return <SongCard key={song.id} song={song} playlistSong={playlistSong} />;
        })}
      </div>

      {/* Empty State */}
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