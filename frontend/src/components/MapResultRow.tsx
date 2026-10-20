import React from "react";
import type { BSSongInfo } from "./beatSaverTypes";

// Highlights every substring of `text` that matches one of `words`
// (case-insensitive) — makes it visually obvious at a glance why a
// loose token-match search result matched, instead of making the
// reader hunt for it themselves.
function highlightQueryMatches(text: string, words: string[]): React.ReactNode {
  if (!text || words.length === 0) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    words.includes(part.toLowerCase()) ? (
      <mark key={i} className="pixel-search-hit">
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

// One BeatSaver map, in either the search results or the playlist
// import panel — shared so both stay visually/behaviorally identical.
// Position in the currently rendered list, used to stagger the fly-in
// into a quick wave (same idea as SongCard.tsx's own index prop) —
// capped so a big playlist/result page doesn't take forever to finish.
const MapResultRow: React.FC<{
  song: BSSongInfo;
  added: boolean;
  inPool: boolean;
  highlightWords: string[];
  onAdd: () => void;
  index?: number;
}> = ({ song, added, inPool, highlightWords, onAdd, index = 0 }) => {
  // One dot per difficulty actually on this map (not per diff — a map
  // with Standard+OneSaber Expert only shows one "Expert" dot, not
  // two), in a fixed order so the same difficulty always lands in the
  // same spot across different rows.
  const availableDiffs = Array.from(
    new Set((song.versions?.[0]?.diffs || []).map((d) => d.difficulty)),
  ).sort(
    (a, b) =>
      ["Easy", "Normal", "Hard", "Expert", "ExpertPlus"].indexOf(a) -
      ["Easy", "Normal", "Hard", "Expert", "ExpertPlus"].indexOf(b),
  );

  return (
    <div
      className={`pixel-search-row pixel-page-flyin${added ? " added" : ""}`}
      style={{ animationDelay: `${0.2 + Math.min(index, 16) * 0.03}s` }}
    >
      <img
        src={song.versions?.[0]?.coverURL}
        alt={song.metadata.songName}
        className="pixel-cover w-12 h-12 object-cover shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-cyan-200 truncate">
            {highlightWords.length > 0
              ? highlightQueryMatches(song.metadata.songName, highlightWords)
              : song.metadata.songName}
          </span>
          {inPool && <span className="pool-tag">IN POOL</span>}
        </div>
        <div className="text-xs text-[#b7c0d6] truncate">
          {highlightWords.length > 0
            ? highlightQueryMatches(song.metadata.songAuthorName, highlightWords)
            : song.metadata.songAuthorName}
        </div>
        <div className="text-[11px] text-[#6a7690] truncate">
          mapped by{" "}
          {highlightWords.length > 0
            ? highlightQueryMatches(song.uploader?.name || "", highlightWords)
            : song.uploader?.name}
        </div>
        <div className="pixel-diff-dots">
          {availableDiffs.map((d) => (
            <span key={d} className={`pixel-diff-dot diff-${d}`} title={d} />
          ))}
        </div>
      </div>
      <button
        className={`pixel-add-btn${added ? " added" : ""}`}
        onClick={onAdd}
        disabled={added}
        title={added ? "Already queued" : "Add to rank queue"}
      >
        {added ? "✓" : "+"}
      </button>
    </div>
  );
};

export default MapResultRow;
