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
    <div className="border rounded-xl p-4 shadow-lg bg-white flex flex-col items-start hover:shadow-2xl transition-shadow duration-200">
      <div className="w-full flex items-center gap-4 mb-2">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={song.name}
            className="w-24 h-24 object-cover rounded-lg border"
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-xl mb-1">{song.name}</h3>
          <p className="text-gray-600 text-sm">{song.metadata.songAuthorName}</p>
          <p className="text-xs text-gray-500">von {song.uploader.name}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
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
      <div className="flex justify-between w-full text-xs text-gray-500 mb-2">
        <span>Plays: {song.stats.plays}</span>
        <span>Downloads: {song.stats.downloads}</span>
        <span>Upvotes: {song.stats.upvotes}</span>
        <span>Downvotes: {song.stats.downvotes}</span>
      </div>
      <div className="w-full flex justify-between items-center text-xs text-gray-400">
        <span>Hochgeladen: {uploadDate}</span>
        <a
          href={`https://beatsaver.com/maps/${song.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          BeatSaver öffnen
        </a>
      </div>
    </div>
  );
};

export default SongCard;
