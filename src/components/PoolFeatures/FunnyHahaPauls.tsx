import SongCard from "../SongCard";
import type { BSSongInfo } from "../types";

export function renderFunnyHahaPaulsSongs(
  bsSongs: BSSongInfo[],
  starRatingMap: any,
  poolId: string,
  selectedDiffs: any,
  toggleDiffSelection: any,
  editMode: boolean
) {
  // Songs mit Star Rating 20.69 als "neu"
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
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.343 17.657l-1.414 1.414M17.657 17.657l-1.414-1.414M6.343 6.343L4.929 4.929" />
            </svg>
            <h3 className="text-cyan-400 text-2xl font-extrabold tracking-wide drop-shadow">Neu im Pool</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {newSongs.map((song) => (
              <div className="relative group" key={song.versions?.[0]?.hash || song.id}>
                {/* Ribbon-Badge oben rechts */}
                <span className="absolute top-0 right-0 z-10 bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl shadow-lg group-hover:scale-110 transition-transform select-none">
                  NEU
                </span>
                <SongCard
                  song={song}
                  starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
                  poolId={poolId}
                  selectedDiffs={selectedDiffs[song.versions?.[0]?.hash?.toUpperCase()] || {}}
                  onToggleDiff={(characteristic, difficulty) =>
                    toggleDiffSelection(song.versions?.[0]?.hash?.toUpperCase(), characteristic, difficulty)
                  }
                  editMode={editMode}
                  // isNew bleibt, falls du im SongCard noch ein Badge möchtest
                />
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {otherSongs.map((song) => (
          <SongCard
            key={song.versions?.[0]?.hash || song.id}
            song={song}
            starRatings={starRatingMap[song.versions?.[0]?.hash?.toUpperCase()] || {}}
            poolId={poolId}
            selectedDiffs={selectedDiffs[song.versions?.[0]?.hash?.toUpperCase()] || {}}
            onToggleDiff={(characteristic, difficulty) =>
              toggleDiffSelection(song.versions?.[0]?.hash?.toUpperCase(), characteristic, difficulty)
            }
            editMode={editMode}
          />
        ))}
      </div>
    </>
  );
}