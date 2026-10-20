import React, { useState } from "react";
import type { DetailedSong } from "./hitbloqTypes";
import { diffMap, charMap } from "./hitbloqTypes";
import CharacteristicLabel from "./CharacteristicLabel";
import DiffBadge from "./DiffBadge";

// One song's section, grouped by hash (not per-diff, see
// .pixel-missing-song in pixel-ui.css), sourced from Hitbloq's own
// ranked-list data rather than a live BeatSaver fetch — used for the
// "not found on BeatSaver" panel (no BeatSaver data to show at all)
// and for ComparePoolsPage's "ranked in both pools" list (BeatSaver
// data exists but isn't fetched there, so this is the common ground).
// Hitbloq's data still carries a name/cover/star-rating per
// difficulty from when it was ranked, used here instead of showing
// nothing but the bare hash.
const HitbloqSongCard: React.FC<{
  hash: string;
  entries: DetailedSong[];
  selected: Set<string>;
  onToggleDiff: (songId: string) => void;
}> = ({ hash, entries, selected, onToggleDiff }) => {
  // Own state (not lifted) so one broken cover across a long "not
  // found" list only ever affects its own row.
  const [coverBroken, setCoverBroken] = useState(false);
  const songName = entries.find((s) => s.song_name)?.song_name;
  const songCover = entries.find((s) => s.song_cover)?.song_cover;

  // Same idea as SongCard's own diff grouping — several missing diffs
  // across a couple of characteristics read as one section instead of
  // that many indistinguishable rows.
  const byCharacteristic: Record<string, DetailedSong[]> = {};
  entries.forEach((song) => {
    const charShort = song.song_id.split("_")[2];
    const characteristic = charMap[charShort] || charShort;
    (byCharacteristic[characteristic] ??= []).push(song);
  });

  return (
    <div className="pixel-missing-song">
      <div className="pixel-missing-song-head">
        {songCover && !coverBroken ? (
          <img
            src={songCover}
            alt=""
            className="pixel-missing-song-cover"
            onError={() => setCoverBroken(true)}
          />
        ) : (
          <div className="pixel-missing-song-cover pixel-thumb" />
        )}
        <div className="flex-1 min-w-0">
          {songName ? (
            <>
              <div className="name" title={songName}>
                {songName}
              </div>
              <div className="hash" title={hash}>
                {hash}
              </div>
            </>
          ) : (
            // No name on record either — the hash stands in as the
            // headline instead of a secondary line under nothing.
            <div className="hash as-name" title={hash}>
              {hash}
            </div>
          )}
        </div>
        <span className="count">
          {entries.length} diff{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pixel-missing-song-diffs">
        {Object.entries(byCharacteristic).map(([characteristic, songsForChar]) => (
          <div key={characteristic} className="char-row">
            <CharacteristicLabel characteristic={characteristic} />
            {songsForChar.map((song) => {
              const diffShort = song.song_id.split("_")[1];
              const difficulty = diffMap[diffShort] || diffShort;
              return (
                <DiffBadge
                  key={song.song_id}
                  difficulty={difficulty}
                  stars={song.song_stars}
                  selected={selected.has(song.song_id)}
                  onClick={() => onToggleDiff(song.song_id)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HitbloqSongCard;
