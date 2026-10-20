import React from "react";
import type { BSSongInfo, BSDifficulty } from "./beatSaverTypes";
import { characteristicIcons, characteristicLabels } from "./hitbloqTypes";

// One queued song in the sticky rank-queue sidebar. Compact: each
// difficulty is a small badge (same .pixel-badge/.pixel-badge-
// selectable pills SongCard.tsx's own diff list uses), not a full
// tile — a selected one just widens to fit an inline rating box.
// That box IS the automatic/manual choice: left empty (shows the
// grayed-out "AUTO" placeholder), Hitbloq calculates the rating
// itself; typed a number, that's used as a manual rating instead. No
// separate automatic/manual dropdown to keep in sync with it.
const StagedSongCard: React.FC<{
  song: BSSongInfo;
  selectedDiffs: string[];
  diffOptions: Record<string, string>;
  onToggleDiff: (diffKey: string) => void;
  onOptionsChange: (diffKey: string, rating: string) => void;
  onRemove: () => void;
  index?: number;
}> = ({
  song,
  selectedDiffs,
  diffOptions,
  onToggleDiff,
  onOptionsChange,
  onRemove,
  index = 0,
}) => {
  const grouped: Record<string, BSDifficulty[]> = {};
  (song.versions?.[0]?.diffs || []).forEach((diff) => {
    (grouped[diff.characteristic] ??= []).push(diff);
  });

  return (
    <div
      className="pixel-queue-card pixel-page-flyin"
      // Each newly-added song pops into the queue with its own quick
      // fly-in, capped so adding a big batch (e.g. "Add All New" from
      // a playlist) doesn't take forever to finish landing.
      style={{ animationDelay: `${Math.min(index, 12) * 0.05}s` }}
    >
      <div className="flex items-center gap-3">
        <img
          src={song.versions?.[0]?.coverURL}
          alt={song.metadata.songName}
          className="pixel-cover w-10 h-10 object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-cyan-200 truncate">{song.metadata.songName}</div>
          <div className="text-[11px] text-[#6a7690]">
            {selectedDiffs.length} selected
          </div>
        </div>
        <button className="pixel-remove-btn" onClick={onRemove} title="Remove from queue">
          ✕
        </button>
      </div>

      {Object.entries(grouped).map(([characteristic, characteristicDiffs]) => (
        <div key={characteristic} className="pixel-queue-char-row">
          {characteristicIcons[characteristic] && (
            <img
              src={characteristicIcons[characteristic]}
              alt={characteristicLabels[characteristic] || characteristic}
              title={characteristicLabels[characteristic] || characteristic}
            />
          )}
          <div className="diffs">
            {characteristicDiffs.map((diff) => {
              const diffKey = `${characteristic}|${diff.difficulty}`;
              const checked = selectedDiffs.includes(diffKey);
              const rating = diffOptions[diffKey] ?? "";
              return (
                <span
                  key={diffKey}
                  className={`pixel-badge diff-${diff.difficulty} pixel-badge-selectable${checked ? " selected" : ""}`}
                  onClick={() => onToggleDiff(diffKey)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleDiff(diffKey);
                    }
                  }}
                >
                  {diff.difficulty}
                  {checked && (
                    // Stopping propagation (not the whole badge) so
                    // typing here doesn't also deselect the diff —
                    // clicking the badge text itself still does.
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="AUTO"
                      className="pixel-input pixel-badge-inline-input"
                      value={rating}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onOptionsChange(diffKey, e.target.value)}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StagedSongCard;
