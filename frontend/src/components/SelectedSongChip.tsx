import React, { useState } from "react";
import type { BSSongInfo } from "./beatSaverTypes";
import CharacteristicLabel from "./CharacteristicLabel";
import DiffBadge from "./DiffBadge";

// One song's row in the "selected maps" tray (edit-mode action bar) —
// a song picked anywhere in the (possibly hundreds-long) grid below
// shows up here too, so the full selection is visible in one place
// instead of only as a highlight buried wherever that card happens to
// be scrolled to. Reuses the same cover/name/diff-badge look as
// HitbloqSongCard/DuplicateSongCard for visual consistency, just
// without their own larger "count" chip — the diff badges themselves
// double as the remove control.
const SelectedSongChip: React.FC<{
  hash: string;
  song?: BSSongInfo;
  selectedByChar: { [characteristic: string]: string[] };
  starsByChar?: { [characteristic: string]: { [difficulty: string]: number } };
  onToggleDiff: (characteristic: string, difficulty: string) => void;
  onRemoveSong: () => void;
}> = ({ hash, song, selectedByChar, starsByChar, onToggleDiff, onRemoveSong }) => {
  const [coverBroken, setCoverBroken] = useState(false);
  const cover = song?.versions?.[0]?.coverURL;
  const name = song?.metadata.songName;

  return (
    <div className="pixel-missing-song">
      <div className="pixel-missing-song-head">
        {cover && !coverBroken ? (
          <img
            src={cover}
            alt=""
            className="pixel-missing-song-cover"
            onError={() => setCoverBroken(true)}
          />
        ) : (
          <div className="pixel-missing-song-cover pixel-thumb" />
        )}
        <div className="flex-1 min-w-0">
          {name ? (
            <div className="name" title={name}>
              {name}
            </div>
          ) : (
            <div className="hash as-name" title={hash}>
              {hash}
            </div>
          )}
        </div>
        <button
          className="pixel-stat-link"
          onClick={onRemoveSong}
          title="Deselect this song"
        >
          remove
        </button>
      </div>
      <div className="pixel-missing-song-diffs">
        {Object.entries(selectedByChar).map(([characteristic, diffs]) => (
          <div key={characteristic} className="char-row">
            <CharacteristicLabel characteristic={characteristic} />
            {diffs.map((difficulty) => (
              <DiffBadge
                key={difficulty}
                difficulty={difficulty}
                stars={starsByChar?.[characteristic]?.[difficulty]}
                selected
                onClick={() => onToggleDiff(characteristic, difficulty)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectedSongChip;
