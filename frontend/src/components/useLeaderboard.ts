// useLeaderboard.ts — a pool's top-5 players, shown in PoolHeader's
// leaderboard column. Small enough to be almost not worth its own
// file, but keeping every fetch effect out of SongList.tsx (not just
// the big one) is the actual point of this split.
import { useQuery } from "@tanstack/react-query";
import type { LeaderEntry } from "./hitbloqTypes";

interface LadderEntry {
  rank: number;
  username?: string;
  name?: string;
  cr?: number;
}

async function fetchLeaders(poolId: string): Promise<LeaderEntry[]> {
  const res = await fetch(`/proxy/ladder/${poolId}/players/0`);
  const data: { ladder: LadderEntry[] } = await res.json();
  return data.ladder.slice(0, 5).map((p) => ({
    rank: p.rank,
    name: p.username ?? p.name ?? "",
    cr: p.cr ?? 0,
  }));
}

export function useLeaderboard(poolId: string): LeaderEntry[] {
  // A failed fetch here (Hitbloq hiccup, malformed response, ...) isn't
  // worth surfacing — the leaderboard column just stays empty, same as
  // the old try/catch's silent setLeaders([]) fallback (queries don't
  // throw into the component by default; a failure just leaves `data`
  // undefined, caught by the fallback below).
  const { data } = useQuery({
    queryKey: ["leaderboard", poolId],
    queryFn: () => fetchLeaders(poolId),
    enabled: Boolean(poolId),
  });
  return data ?? [];
}
