// FunnyHahaPauls.tsx — a one-off pool-specific song grid, swapped in by
// SongList.tsx for poolId === "funny_haha_pauls" only. The one
// difference from the plain grid every other pool uses: songs carrying
// the pool's 20.69-star in-joke rating are pulled into their own "NEW
// IN POOL" section up top (with a ribbon badge) instead of sorting
// alongside everything else.
import SongCard from "../SongCard";
import type { BSSongInfo } from "../beatSaverTypes";

interface FunnyHahaPaulsSongsProps {
  bsSongs: BSSongInfo[];
  // hash -> characteristic -> difficulty -> star rating
  starRatingMap: Record<string, Record<string, Record<string, number>>>;
  poolId: string;
  // hash -> characteristic -> selected difficulties
  selectedDiffs: Record<string, Record<string, string[]>>;
  toggleDiffSelection: (hash: string, characteristic: string, difficulty: string) => void;
  editMode: boolean;
  setSongSelection?: (
    hash: string,
    select: boolean,
    diffs: { characteristic: string; difficulty: string }[],
  ) => void;
}

export default function FunnyHahaPaulsSongs({
  bsSongs,
  starRatingMap,
  poolId,
  selectedDiffs,
  toggleDiffSelection,
  editMode,
  setSongSelection,
}: FunnyHahaPaulsSongsProps) {
  // Mark songs with 20.69 stars as "new" and separate them from the rest
  const newSongs = bsSongs.filter((song) => {
    const hash = song.versions?.[0]?.hash?.toUpperCase();
    const starMap = starRatingMap[hash] || {};
    return Object.values(starMap).some((diffs) =>
      Object.values(diffs as Record<string, number>).some((star) => star === 20.69)
    );
  });
  const newHashes = new Set(newSongs.map((s) => s.versions?.[0]?.hash?.toUpperCase()));
  const otherSongs = bsSongs.filter(
    (song) => !newHashes.has(song.versions?.[0]?.hash?.toUpperCase())
  );

  return (
    <>
      {newSongs.length > 0 && (
        <section className="mb-12">
          <div className="flex items-baseline gap-2.5 mb-4">
            <span className="pixel-section-label">NEW IN POOL</span>
            <span className="text-xs text-neutral-500">
              {newSongs.length} song{newSongs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {newSongs.map((song, index) => (
              <div className="relative pixel-new-ribbon-wrap" key={song.versions?.[0]?.hash || song.id}>
                <div className="pixel-new-ribbon">
                  <span>NEW</span>
                </div>
                <SongCard
                  index={index}
                  song={song}
                  starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
                  poolId={poolId}
                  selectedDiffs={selectedDiffs[song.versions?.[0]?.hash?.toUpperCase()] || {}}
                  onToggleDiff={(characteristic, difficulty) =>
                    toggleDiffSelection(song.versions?.[0]?.hash?.toUpperCase(), characteristic, difficulty)
                  }
                  onToggleAllDiffs={(select, diffs) =>
                    setSongSelection?.(song.versions?.[0]?.hash?.toUpperCase(), select, diffs)
                  }
                  editMode={editMode}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {otherSongs.map((song, index) => (
          <SongCard
            key={song.versions?.[0]?.hash || song.id}
            index={newSongs.length + index}
            song={song}
            starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
            poolId={poolId}
            selectedDiffs={selectedDiffs[song.versions?.[0]?.hash?.toUpperCase()] || {}}
            onToggleDiff={(characteristic, difficulty) =>
              toggleDiffSelection(song.versions?.[0]?.hash?.toUpperCase(), characteristic, difficulty)
            }
            onToggleAllDiffs={(select, diffs) =>
              setSongSelection?.(song.versions?.[0]?.hash?.toUpperCase(), select, diffs)
            }
            editMode={editMode}
          />
        ))}
      </div>
    </>
  );
}
