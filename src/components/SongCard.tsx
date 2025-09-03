// SongCard.tsx
import React from "react";
import type { BSSongInfo } from "./types";

interface SongCardProps {
  song: BSSongInfo;
}

const SongCard: React.FC<SongCardProps> = ({ song }) => {
  const coverUrl = song.versions?.[0]?.coverURL || "";
  const firstDiff = song.versions?.[0]?.diffs?.[0];
  const uploadDate = new Date(song.uploaded).toLocaleDateString();

  return (
    <div className="border rounded-2xl p-5 shadow-xl bg-white flex flex-col hover:scale-[1.03] hover:shadow-2xl transition-all duration-200">
      <div className="flex gap-4 mb-3">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={song.name}
            className="w-24 h-24 object-cover rounded-xl border shadow"
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1 text-purple-700">{song.name}</h3>
          <p className="text-gray-600 text-sm">{song.metadata.songAuthorName}</p>
          <p className="text-xs text-gray-500">von {song.uploader.name}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
          BPM: {song.metadata.bpm}
        </span>
        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
          Länge: {Math.round(song.metadata.duration / 60)} min
        </span>
        {firstDiff && (
          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
            {firstDiff.characteristic} – {firstDiff.difficulty}
          </span>
        )}
        {song.ranked && (
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
            Ranked
          </span>
        )}
        {song.qualified && (
          <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-xs font-semibold">
            Qualified
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 w-full text-xs text-gray-500 mb-3">
        <span>Plays: <span className="font-semibold">{song.stats.plays}</span></span>
        <span>Downloads: <span className="font-semibold">{song.stats.downloads}</span></span>
        <span>Upvotes: <span className="font-semibold">{song.stats.upvotes}</span></span>
        <span>Downvotes: <span className="font-semibold">{song.stats.downvotes}</span></span>
      </div>
      <div className="w-full flex justify-between items-center text-xs text-gray-400 mt-2">
        <span>Hochgeladen: {uploadDate}</span>
        <a
          href={`https://beatsaver.com/maps/${song.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-500 hover:underline font-semibold"
        >
          BeatSaver öffnen
        </a>
      </div>
    </div>
  );
};

export default SongCard;
