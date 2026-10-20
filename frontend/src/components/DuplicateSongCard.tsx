import React, { useState } from "react";
import type { BSSongInfo } from "./beatSaverTypes";
import type { DetailedSong } from "./hitbloqTypes";
import { diffMap, charMap } from "./hitbloqTypes";
import CharacteristicLabel from "./CharacteristicLabel";
import DiffBadge from "./DiffBadge";

// One song's section in the "duplicate rankings" panel — a song this
// pool has ranked under more than one real hash at once (its current
// version, plus at least one older re-upload hash still separately
// ranked). Unlike HitbloqSongCard, the song itself IS on BeatSaver, so
// its cover/name come straight from that live data instead of
// Hitbloq's own (possibly stale) copy — only the older hash(es)'
// difficulties are listed below, grouped by which hash they're each
// still tracked under, since that's specifically what's worth
// unranking (the current hash's own ranking should stay).
const DuplicateSongCard: React.FC<{
  song: BSSongInfo;
  entries: DetailedSong[];
  selected: Set<string>;
  onToggleDiff: (songId: string) => void;
}> = ({ song, entries, selected, onToggleDiff }) => {
  const [coverBroken, setCoverBroken] = useState(false);
  const cover = song.versions?.[0]?.coverURL;
  const currentHash = song.versions?.[0]?.hash?.toUpperCase();

  const byHash: Record<string, DetailedSong[]> = {};
  entries.forEach((entry) => {
    const hash = entry.song_id.split("_")[0].toUpperCase();
    (byHash[hash] ??= []).push(entry);
  });

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
          <div className="name" title={song.metadata.songName}>
            {song.metadata.songName}
          </div>
          <div className="hash" title={currentHash}>
            current version: {currentHash}
          </div>
        </div>
        <span className="count">
          {entries.length} diff{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pixel-missing-song-diffs">
        {Object.entries(byHash).map(([hash, hashEntries]) => {
          const byCharacteristic: Record<string, DetailedSong[]> = {};
          hashEntries.forEach((entry) => {
            const charShort = entry.song_id.split("_")[2];
            const characteristic = charMap[charShort] || charShort;
            (byCharacteristic[characteristic] ??= []).push(entry);
          });
          return (
            <div key={hash} className="flex flex-col gap-1.5">
              <span className="text-[9px] font-mono text-[#6a7690]">
                OLDER VERSION: {hash}
              </span>
              {Object.entries(byCharacteristic).map(([characteristic, charEntries]) => (
                <div key={characteristic} className="char-row">
                  <CharacteristicLabel characteristic={characteristic} />
                  {charEntries.map((entry) => {
                    const diffShort = entry.song_id.split("_")[1];
                    const difficulty = diffMap[diffShort] || diffShort;
                    return (
                      <DiffBadge
                        key={entry.song_id}
                        difficulty={difficulty}
                        stars={entry.song_stars}
                        selected={selected.has(entry.song_id)}
                        onClick={() => onToggleDiff(entry.song_id)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DuplicateSongCard;
