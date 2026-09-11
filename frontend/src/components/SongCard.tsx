import React from "react";
import { useNavigate } from "react-router-dom";
import type { BSSongInfo, BSDifficulty } from "./types";
import { characteristicIcons } from "./types";
import beatsaverIcon from "../assets/Icons/beatsaver.png";
import beatleaderIcon from "../assets/Icons/beatleader.svg";
import "./pixel-ui.css";

interface SongCardProps {
  song: BSSongInfo;
  starRatings: any;
  poolId: string;
  selectedDiffs: any;
  onToggleDiff: (characteristic: string, difficulty: string) => any;
  onToggleAllDiffs?: (
    select: boolean,
    diffs: { characteristic: string; difficulty: string }[],
  ) => void;
  editMode: boolean;
  isNew?: boolean;
}

const SongCard: React.FC<SongCardProps> = ({
  song,
  starRatings,
  poolId,
  selectedDiffs,
  onToggleDiff,
  onToggleAllDiffs,
  editMode,
}) => {
  const navigate = useNavigate();
  const coverUrl = song.versions?.[0]?.coverURL || "";
  const difficulties: BSDifficulty[] = song.versions?.[0]?.diffs || [];
  const uploadDate = new Date(song.uploaded).toLocaleDateString();

  const grouped: Record<string, BSDifficulty[]> = {};
  difficulties.forEach((diff) => {
    if (!grouped[diff.characteristic]) grouped[diff.characteristic] = [];
    grouped[diff.characteristic].push(diff);
  });

  const isDiffSelected = (characteristic: string, difficulty: string) =>
    selectedDiffs[characteristic]?.includes(difficulty) ?? false;

  const allDiffs = difficulties.map((d) => ({
    characteristic: d.characteristic,
    difficulty: d.difficulty,
  }));
  const everyDiffSelected =
    allDiffs.length > 0 &&
    allDiffs.every((d) => isDiffSelected(d.characteristic, d.difficulty));

  const handleCardActivate = () => {
    if (editMode) {
      onToggleAllDiffs?.(!everyDiffSelected, allDiffs);
      return;
    }
    navigate(`/song/${song.id}`, { state: { starRatings, poolId } });
  };

  return (
    <div
      className={`pixel-card flex flex-col w-full cursor-pointer${
        editMode ? " pixel-card-edit" : ""
      }`}
      onClick={handleCardActivate}
      tabIndex={0}
      role="button"
      title={
        editMode ? "Click to select / deselect all difficulties" : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "Enter") handleCardActivate();
      }}
    >
      {/* Kopf: Cover + Metadaten */}
      <div className="flex gap-3.5 px-3.5 pt-3.5 pb-3">
        <img
          src={coverUrl}
          alt={song.metadata.songName}
          className="pixel-cover w-[72px] h-[72px] shrink-0 object-cover"
        />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h3 className="pixel-font text-[11px] leading-snug text-cyan-300 break-words">
            {song.metadata.songName}
          </h3>
          <p className="text-xs text-[#b7c0d6] truncate">
            {song.metadata.songAuthorName}
          </p>
          <p className="text-[11px] text-[#6a7690] truncate">
            mapped by {song.uploader.name}
          </p>
        </div>
      </div>

      {/* Difficulties, gruppiert nach Characteristic */}
      <div className="pixel-diff-block">
        {Object.entries(grouped).map(([characteristic, diffs]) => (
          <div key={characteristic} className="flex items-center gap-2.5">
            {characteristicIcons[characteristic] ? (
              <img
                src={characteristicIcons[characteristic]}
                alt={characteristic}
                className="w-[18px] h-[18px] opacity-85"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <span className="pixel-font text-[10px] text-cyan-200">
                {characteristic}
              </span>
            )}

            <div className="flex flex-wrap gap-1.5">
              {diffs.map((diff) => {
                const star =
                  starRatings?.[characteristic]?.[diff.difficulty] ?? undefined;
                const selected = isDiffSelected(characteristic, diff.difficulty);
                // gerankt -> gold (.starred); ungerankt -> Difficulty-Farbe
                const cls =
                  star !== undefined
                    ? "pixel-badge starred"
                    : `pixel-badge diff-${diff.difficulty}`;
                return (
                  <span
                    key={`${characteristic}-${diff.difficulty}`}
                    className={`${cls}${editMode ? " pixel-badge-selectable" : ""}${
                      editMode && selected ? " selected" : ""
                    }`}
                    onClick={
                      editMode
                        ? (e) => {
                            e.stopPropagation();
                            onToggleDiff(characteristic, diff.difficulty);
                          }
                        : undefined
                    }
                  >
                    {editMode && (
                      <input
                        type="checkbox"
                        checked={selected}
                        readOnly
                        tabIndex={-1}
                        className="w-3 h-3 accent-cyan-400 mr-1 pointer-events-none"
                      />
                    )}
                    {diff.difficulty}
                    {star !== undefined && (
                      <b className="ml-1">
                        ★ {star % 1 === 0 ? star : star.toString()}
                      </b>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pixel-card-footer mt-auto">
        <span>{uploadDate}</span>
        <div className="flex items-center gap-2">
          <a
            href={`https://beatleader.com/leaderboard/global/${song.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-icon-btn"
            title="Open BeatLeader"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={beatleaderIcon} alt="BeatLeader" className="w-5 h-5" />
          </a>
          <a
            href={`https://beatsaver.com/maps/${song.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-icon-btn"
            title="Open BeatSaver"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={beatsaverIcon} alt="BeatSaver" className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SongCard;
