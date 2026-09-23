import React, { useEffect, useRef, useState } from "react";
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
  // Position in the currently rendered list, used to stagger the
  // edit-mode wiggle so cards pop in one after another like a wave
  // instead of every card starting at once.
  index?: number;
}

const SongCard: React.FC<SongCardProps> = ({
  song,
  starRatings,
  poolId,
  selectedDiffs,
  onToggleDiff,
  onToggleAllDiffs,
  editMode,
  index = 0,
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
  // Any diff of this song selected at all — highlights + stays popped
  // out for as long as that's true, not just momentarily.
  const hasSelection = Object.values(selectedDiffs ?? {}).some(
    (diffs: any) => Array.isArray(diffs) && diffs.length > 0,
  );

  const handleCardActivate = () => {
    if (editMode) {
      onToggleAllDiffs?.(!everyDiffSelected, allDiffs);
      return;
    }
    navigate(`/song/${song.id}`, { state: { starRatings, poolId } });
  };

  // Deterministic per-card jitter (from the song id) so once wiggling,
  // cards drift slightly out of sync with each other over time instead
  // of settling back into lockstep — same idea as iOS's icon-jiggle.
  const wiggleSeed = (song.id || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  // Stagger the wiggle's *start* by position, capped so a long list
  // doesn't take forever to fully kick in — a quick wave down the
  // page instead of every card starting to wiggle at once.
  const staggerDelay = Math.min(index, 14) * 0.02;
  const flyInDelay = Math.min(index, 20) * 0.03 + 0.15;
  // Once the fly-in has actually played, .pixel-page-flyin is dropped
  // from the className for good — otherwise, toggling edit mode later
  // (which adds/removes .pixel-card-edit's own competing "animation"
  // declaration) makes the browser treat .pixel-page-flyin's animation
  // as newly starting again each time it goes from overridden back to
  // in-effect, replaying the fly-in on every exit from edit mode.
  const [hasFlownIn, setHasFlownIn] = useState(false);

  const wiggleDuration = 0.34 + (wiggleSeed % 5) * 0.03;

  // Track the wiggle scale this card was actually sitting at while in
  // edit mode (1.035 once it had a selection, 1.012 otherwise — the
  // same numbers .pixel-card-edit/.pixel-card-selected would apply),
  // so the exit pop below can start from that size instead of always
  // assuming the idle one.
  const lastWiggleScaleRef = useRef(1.012);
  if (editMode) {
    lastWiggleScaleRef.current = hasSelection ? 1.035 : 1.012;
  }

  // One-shot bounce back to normal when edit mode turns off — without
  // this the card just snaps from whatever mid-wiggle scale/rotation
  // it happened to be at straight to its plain resting look the
  // instant .pixel-card-edit is removed. Detected via a ref rather
  // than reading editMode directly in the effect body, so this only
  // fires on the true -> false transition, never on mount.
  const wasEditModeRef = useRef(editMode);
  const [isExitingEditMode, setIsExitingEditMode] = useState(false);
  useEffect(() => {
    if (wasEditModeRef.current && !editMode) setIsExitingEditMode(true);
    wasEditModeRef.current = editMode;
  }, [editMode]);

  const wiggleStyle = editMode
    ? {
        // One value auto-repeats to both animations (pixel-wiggle,
        // pixel-edit-pop-in) — both should start at the same moment.
        // (Delaying the wiggle until the pop actually finished — to
        // stop it from landing mid-cycle when the pop handed off —
        // fixed one jitter but introduced a worse one: since the same
        // delay reapplies every time hover swaps the animation-name
        // between pixel-wiggle/pixel-wiggle-hover, the card would
        // "pause" for that whole delay again on every hover in/out.)
        animationDelay: `${staggerDelay}s`,
        // Same duration for BOTH, not just the wiggle: giving the pop
        // the wiggle's own per-card duration means its single
        // iteration always finishes exactly as the wiggle completes
        // its first full cycle — both land back at rotate(0)/the
        // wiggle's resting scale at that same instant, so the handoff
        // has no jump, without needing to touch either's delay.
        animationDuration: `${wiggleDuration}s`,
      }
    : isExitingEditMode
      ? ({ "--wiggle-scale": lastWiggleScaleRef.current } as React.CSSProperties)
      : hasFlownIn
        ? undefined
        : { animationDelay: `${flyInDelay}s` };

  return (
    <div
      className={`pixel-card${hasFlownIn ? "" : " pixel-page-flyin"} flex flex-col w-full cursor-pointer${
        editMode ? " pixel-card-edit" : ""
      }${editMode && hasSelection ? " pixel-card-selected" : ""}${
        isExitingEditMode ? " pixel-card-exit-pop" : ""
      }`}
      style={wiggleStyle}
      onClick={handleCardActivate}
      onAnimationEnd={(e) => {
        // Only the fly-in — pixel-wiggle is infinite (never fires
        // this) and pixel-edit-pop-in ending is unrelated to this flag.
        if (e.animationName === "pixel-page-flyin-anim") setHasFlownIn(true);
        // Drop the exit-pop class once its single run finishes, so the
        // card is left with no leftover "animation" declaration.
        if (e.animationName === "pixel-edit-pop-out") setIsExitingEditMode(false);
      }}
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
