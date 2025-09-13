// SongCard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import type { BSSongInfo, BSDifficulty } from "./types";
import { characteristicIcons, diffColors } from "./types";
import beatsaverIcon from "../assets/Icons/beatsaver.png";
import beatleaderIcon from "../assets/Icons/beatleader.svg";

// Props für die SongCard: Songdaten und optionale Star-Ratings
interface SongCardProps {
  song: BSSongInfo;
  starRatings: Record<string, Record<string, number>>;
  poolId: string;
  selectedDiffs: { [characteristic: string]: string[] };
  onToggleDiff: (characteristic: string, difficulty: string) => void;
  editMode: boolean;
}

const SongCard: React.FC<SongCardProps> = ({ song, starRatings, poolId, selectedDiffs, onToggleDiff, editMode }) => {
  const navigate = useNavigate();
  // Cover-URL und Difficulties aus dem Song holen
  const coverUrl = song.versions?.[0]?.coverURL || "";
  const difficulties: BSDifficulty[] = song.versions?.[0]?.diffs || [];
  const uploadDate = new Date(song.uploaded).toLocaleDateString();

  // Difficulties nach characteristic gruppieren (z.B. Standard, Lawless, ...)
  const grouped: Record<string, BSDifficulty[]> = {};
  difficulties.forEach((diff) => {
    if (!grouped[diff.characteristic]) grouped[diff.characteristic] = [];
    grouped[diff.characteristic].push(diff);
  });

  return (
    <div
      // Card-Design, klickbar, auch per Tastatur (Enter)
      className="border border-neutral-700 rounded-xl p-4 shadow bg-neutral-800 flex flex-col hover:shadow-lg transition-all duration-200 w-full cursor-pointer"
      onClick={() => navigate(`/song/${song.id}`, { state: { starRatings, poolId } })}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(`/song/${song.id}`, { state: { starRatings } });
      }}
    >
      {/* Song-Cover und Metadaten */}
      <div className="flex gap-4 mb-3">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={song.metadata.songName}
            className="w-20 h-20 object-cover rounded-lg border border-neutral-700 shadow"
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-base mb-1 text-cyan-300 break-words whitespace-normal">
            {song.metadata.songName}
          </h3>
          <p className="text-neutral-400 text-sm break-words whitespace-normal">
            {song.metadata.songAuthorName}
          </p>
          <p className="text-xs text-neutral-500 break-words whitespace-normal">
            von {song.uploader.name}
          </p>
        </div>
      </div>
      {/* Difficulties nach characteristic gruppiert */}
      <div className="flex flex-col gap-2 mb-2">
        {Object.entries(grouped).map(([characteristic, diffs]) => (
          <div key={characteristic} className="flex items-center gap-2">
            {/* Icon oder Text für die characteristic */}
            {characteristicIcons[characteristic] ? (
              <img
                src={characteristicIcons[characteristic]}
                alt={characteristic}
                className="w-5 h-5 inline-block"
              />
            ) : (
              <span className="font-semibold text-cyan-200">
                {characteristic}
              </span>
            )}
            {/* Alle Difficulties dieser characteristic */}
            <div className="flex flex-wrap gap-2">
              {diffs.map((diff) => {
                const star = starRatings?.[characteristic]?.[diff.difficulty] ?? undefined;
                return (
                  <span
                    key={`${characteristic}-${diff.difficulty}`}
                    className={`px-2 py-1 rounded text-xs font-semibold backdrop-blur-sm flex items-center gap-1 ${
                      star !== undefined
                        ? "border border-yellow-400 bg-yellow-700/40 text-yellow-100"
                        : diffColors[diff.difficulty] ||
                          "bg-neutral-700/60 text-cyan-100"
                    }`}
                  >
                    {/* Checkbox direkt im Badge */}
                    {editMode && (
                      <input
                        type="checkbox"
                        checked={selectedDiffs[characteristic]?.includes(diff.difficulty) ?? false}
                        onChange={e => {
                          e.stopPropagation();
                          onToggleDiff(characteristic, diff.difficulty);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="w-3 h-3 accent-cyan-400 mr-1"
                        title="Für Pool auswählen"
                      />
                    )}
                    {diff.difficulty}
                    {/* Star-Rating anzeigen, falls vorhanden */}
                    {star !== undefined && (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <svg
                          className="w-3 h-3 text-yellow-400 inline-block"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.967c.3.921-.755 1.688-1.54 1.118l-3.38-2.455a1 1 0 00-1.175 0l-3.38 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.967a1 1 0 00-.364-1.118L2.049 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
                        </svg>
                        <span className="font-bold">
                          {star % 1 === 0 ? star : star.toString()}
                        </span>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Upload-Datum und externe Links */}
      <div className="w-full flex justify-between items-center text-xs text-neutral-400 mt-auto">
        <span>Hochgeladen: {uploadDate}</span>
        <div className="flex items-center gap-2">
          {/* BeatLeader-Link */}
          <a
            href={`https://beatleader.com/leaderboard/global/${song.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 hover:scale-110 transition-transform"
            title="BeatLeader öffnen"
          >
            <img
              src={beatleaderIcon}
              alt="BeatLeader"
              className="w-6 h-6 inline-block"
            />
          </a>
          {/* BeatSaver-Link */}
          <a
            href={`https://beatsaver.com/maps/${song.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-orange-400 hover:scale-110 transition-transform"
            title="BeatSaver öffnen"
          >
            <img
              src={beatsaverIcon}
              alt="BeatSaver"
              className="w-6 h-6 inline-block"
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SongCard;
