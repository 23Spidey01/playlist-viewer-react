import React from "react";
import CrCurveChart from "./CrCurveChart";

export interface PoolDetailed {
  id: string;
  title: string;
  image: string;
  short_description: string;
  author: string;
  player_count: number;
  popularity: number;
  banner_image?: string;
}

export interface LeaderEntry {
  rank: number;
  name: string;
  cr: number;
}

interface PoolHeaderProps {
  pool: PoolDetailed;
  rankedDiffs: number;
  foundOnBeatSaver: number;
  missingCount: number;
  showMissing: boolean;
  onToggleMissing: () => void;
  // How many songs are ranked under more than one real BeatSaver hash
  // at once — usually a re-upload whose old ranking was never cleaned
  // up. See the "duplicate rankings" panel (SongList.tsx) for the
  // breakdown of exactly which songs/difficulties.
  duplicateSongCount: number;
  showDuplicates: boolean;
  onToggleDuplicates: () => void;
  onRankNewMaps: () => void;
  onRecalculateCR: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  leaders?: LeaderEntry[];
  poolId: string;
  maxStars?: number;
}

const RANK_COLOR = ["#f3c542", "#c0c8dc", "#c07a3a"];

// Barrier-tape strips overlaid on the header in edit mode. Every strip
// is built the same way — a long horizontal bar, positioned by its
// center (top/left) and spun to any angle via rotate() — so a strip
// that ends up looking "vertical" is really just a horizontal one
// rotated ~90°. That keeps the text (always plain horizontal inside
// the bar) reading consistently along whatever angle its own tape
// ends up at, instead of needing a separate near-vertical shape whose
// text has to be squeezed sideways to fit.
const TAPE_STRIPS: {
  top: string;
  left: string;
  angle: number;
  label: string;
}[] = [
  { top: "18%", left: "20%", angle: -24, label: "CAUTION" },
  { top: "60%", left: "40%", angle: 38, label: "EDIT MODE" },
  { top: "12%", left: "58%", angle: 52, label: "CAUTION" },
  { top: "75%", left: "65%", angle: -42, label: "EDIT MODE" },
  { top: "40%", left: "80%", angle: 16, label: "CAUTION" },
  { top: "88%", left: "90%", angle: -68, label: "EDIT MODE" },
];

const PoolHeader: React.FC<PoolHeaderProps> = ({
  pool,
  rankedDiffs,
  foundOnBeatSaver,
  missingCount,
  showMissing,
  onToggleMissing,
  duplicateSongCount,
  showDuplicates,
  onToggleDuplicates,
  onRankNewMaps,
  onRecalculateCR,
  editMode,
  onToggleEditMode,
  leaders = [],
  poolId,
  maxStars,
}) => (
  <div
    className={`pixel-pool-header pixel-page-flyin${
      editMode ? " pixel-edit-dim-bg" : ""
    }`}
  >
    {/* Cover: fixes Quadrat, damit nichts verzerrt */}
    <div
      className={`pixel-pool-header-cover${editMode ? " pixel-edit-dim" : ""}`}
      style={{ backgroundImage: `url(${pool.image})` }}
    />

    <div className="pixel-pool-header-main">
      {/* Title, description and stats fade back in edit mode — this
          isn't what you're here to look at while editing difficulties.
          The action row below (incl. EDIT MODE itself) stays clear. */}
      <div
        className={`flex flex-col gap-2${editMode ? " pixel-edit-dim" : ""}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="pixel-font text-[18px] text-cyan-300">{pool.title}</div>
          <span className="text-xs text-neutral-500">by {pool.author}</span>
        </div>

        <div className="text-[13px] text-neutral-400 max-w-[60ch] truncate">
          {pool.short_description}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="pixel-stat">
            RANKED DIFFS <b>{rankedDiffs}</b>
          </span>
          <span className="pixel-stat">
            FOUND ON BEATSAVER <b>{foundOnBeatSaver}</b>
          </span>
          {missingCount > 0 && (
            <span className="pixel-stat warn">
              NOT FOUND <b>{missingCount}</b>
              <button className="pixel-stat-link" onClick={onToggleMissing}>
                {showMissing ? "hide" : "show"}
              </button>
            </span>
          )}
          {duplicateSongCount > 0 && (
            <span className="pixel-stat caution">
              DUPLICATES FOUND <b>{duplicateSongCount}</b>
              <button className="pixel-stat-link" onClick={onToggleDuplicates}>
                {showDuplicates ? "hide" : "show"}
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-1">
        <button
          className="pixel-btn disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onRankNewMaps}
          disabled={editMode}
          title={editMode ? "Exit edit mode to rank new maps" : undefined}
        >
          + Rank New Maps
        </button>
        <button
          className="pixel-btn secondary disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onRecalculateCR}
          disabled={editMode}
          title={editMode ? "Exit edit mode to recalculate CR" : undefined}
        >
          Recalculate CR
        </button>
        <button
          className={`pixel-tab ml-auto${editMode ? " editing" : ""}`}
          onClick={onToggleEditMode}
        >
          EDIT MODE
        </button>
      </div>
    </div>

    {/* Leaderboard: clippt sich in die Header-Höhe, treibt sie nicht */}
    <div
      className={`pixel-pool-header-lb${editMode ? " pixel-edit-dim" : ""}`}
    >
      <div className="inner">
        <div className="flex items-baseline gap-2 mb-px">
          <span className="pixel-font text-[8px] text-[#f3c542]">
            TOP PLAYERS
          </span>
          <span className="text-[10px] text-[#4b5568]">
            {pool.player_count.toLocaleString()}
          </span>
        </div>

        {leaders.slice(0, 5).map((l, i) => (
          <div key={l.name} className="pixel-lb-row">
            <span
              className="pixel-font text-[9px]"
              style={{ color: RANK_COLOR[i] || "#6a7690" }}
            >
              {String(l.rank).padStart(2, "0")}
            </span>
            <span className="name">{l.name}</span>
            <span className="cr">{l.cr.toFixed(2).toLocaleString()}cr</span>
          </div>
        ))}

        {leaders.length === 0 && (
          <div className="text-[11px] text-[#4b5568]">No ranking data.</div>
        )}

        <a
          href={`https://hitbloq.com/map_pool/${pool.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="pixel-font text-[8px] text-[#1a6f96] mt-auto"
        >
          FULL LEADERBOARD ▸
        </a>
      </div>
    </div>

    <CrCurveChart poolId={poolId} maxStars={maxStars} />

    {/* Barrier tape wrapped across the header — the least subtle
        possible "this is edit mode" cue. Purely decorative overlay:
        pointer-events: none so it never blocks the (still-usable)
        controls underneath. Always mounted (not conditional on
        editMode) so the -on class toggle can fade/scale it in and out
        smoothly instead of the whole thing popping in/out instantly. */}
    <div
      className={`pixel-tape-wrap${editMode ? " pixel-tape-wrap-on" : ""}`}
      aria-hidden="true"
    >
      {/* Two elements per strip so the entrance zoom (scale, on
          .pixel-tape-slot) and the strip's own tilt (rotate, inline on
          .pixel-tape-strip) don't fight over the same transform: an
          inline style always wins over a class for the same property,
          so a class-based scale on the same element that also has an
          inline rotate would just get ignored. Nested, they compose
          normally instead. */}
      {TAPE_STRIPS.map((strip, i) => (
        <div
          key={i}
          className="pixel-tape-slot"
          style={{ top: strip.top, left: strip.left }}
        >
          <div
            className="pixel-tape-strip"
            style={{ transform: `rotate(${strip.angle}deg)` }}
          >
            {/* Generously over-repeated — each strip is 2000px long
                (see .pixel-tape-slot) so text keeps covering the full
                length instead of only the first stretch of it. Extras
                just get clipped by the wrap's overflow: hidden. */}
            {Array.from({ length: 40 }).map((_, j) => (
              <span key={j}>{strip.label}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default PoolHeader;
