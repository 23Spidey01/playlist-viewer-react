import React from "react";

// A single difficulty's selectable badge — gold ("starred") when it
// carries a star rating (i.e. actually ranked), otherwise colored by
// its own difficulty (see .pixel-badge.diff-* in pixel-ui.css).
// Shared by every place that lists a song's difficulties outside the
// main song grid (HitbloqSongCard, DuplicateSongCard, SelectedSongChip)
// — SongCard.tsx has its own variant, with an edit-mode checkbox and
// conditional selectability, different enough not to share this one.
const DiffBadge: React.FC<{
  difficulty: string;
  stars?: number;
  selected?: boolean;
  onClick?: () => void;
}> = ({ difficulty, stars, selected, onClick }) => {
  const starred = typeof stars === "number";
  return (
    <span
      className={`${
        starred ? "pixel-badge starred" : `pixel-badge diff-${difficulty}`
      } pixel-badge-selectable${selected ? " selected" : ""}`}
      onClick={onClick}
    >
      {difficulty}
      {starred && <b className="ml-1">★ {stars}</b>}
    </span>
  );
};

export default DiffBadge;
