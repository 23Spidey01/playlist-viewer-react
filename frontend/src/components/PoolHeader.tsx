import React from "react";

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
  onRankNewMaps: () => void;
  onRecalculateCR: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  leaders?: LeaderEntry[];
}

const RANK_COLOR = ["#f3c542", "#c0c8dc", "#c07a3a"];

const PoolHeader: React.FC<PoolHeaderProps> = ({
  pool,
  rankedDiffs,
  foundOnBeatSaver,
  missingCount,
  showMissing,
  onToggleMissing,
  onRankNewMaps,
  onRecalculateCR,
  editMode,
  onToggleEditMode,
  leaders = [],
}) => (
  <div className="pixel-pool-header">
    {/* Cover: fixes Quadrat, damit nichts verzerrt */}
    <div
      className="pixel-pool-header-cover"
      style={{ backgroundImage: `url(${pool.image})` }}
    />

    <div className="pixel-pool-header-main">
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
          ON BEATSAVER <b>{foundOnBeatSaver}</b>
        </span>
        {missingCount > 0 && (
          <span className="pixel-stat warn">
            NOT FOUND <b>{missingCount}</b>
            <button className="pixel-stat-link" onClick={onToggleMissing}>
              {showMissing ? "hide" : "show"}
            </button>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mt-1">
        <button className="pixel-btn" onClick={onRankNewMaps}>
          + Rank New Maps
        </button>
        <button className="pixel-btn secondary" onClick={onRecalculateCR}>
          Recalculate CR
        </button>
        <button
          className={`pixel-tab ml-auto${editMode ? " active" : ""}`}
          onClick={onToggleEditMode}
        >
          EDIT MODE
        </button>
      </div>
    </div>

    {/* Leaderboard: clippt sich in die Header-Höhe, treibt sie nicht */}
    <div className="pixel-pool-header-lb">
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
            <span className="cr">{l.cr.toFixed(2).toLocaleString()}</span>
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
  </div>
);

export default PoolHeader;
