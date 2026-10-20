// usePoolRankedSongs.ts — a pool's raw ranked-song list from Hitbloq
// (no BeatSaver resolution). Shared by ComparePoolsPage (which only
// ever needs this much — it compares song_ids, not cover art) and
// usePoolSongs (as its first stage, before resolving against
// BeatSaver) — both keyed the same way, so visiting a pool in one
// place warms the cache for the other.
import { useQuery } from "@tanstack/react-query";
import { fetchPoolRankedSongs } from "./hitbloqApi";

export function usePoolRankedSongs(
  poolId: string,
  options: { enabled?: boolean; onBatchStart?: (fromPage: number, toPage: number) => void } = {},
) {
  const { enabled = true, onBatchStart } = options;
  return useQuery({
    queryKey: ["poolRankedSongs", poolId],
    queryFn: () => fetchPoolRankedSongs(poolId, onBatchStart),
    enabled: enabled && Boolean(poolId),
  });
}
