// usePools.ts — the full pool list (/proxy/map_pools_detailed), used
// by the home page, the pool page (to resolve :id -> a PoolDetailed),
// Compare Pools, and the API keys page's pool picker. Those last four
// used to each fetch this independently (App.tsx and ApiKeysPage.tsx
// had two separate, identical fetches of the exact same endpoint) —
// backed by React Query instead, every caller sharing this query key
// gets the same cached data and only one real request happens.
import { useQuery } from "@tanstack/react-query";
import type { PoolDetailed } from "./hitbloqTypes";

async function fetchPools(): Promise<PoolDetailed[]> {
  const res = await fetch("/proxy/map_pools_detailed");
  if (!res.ok) throw new Error(`Hitbloq returned ${res.status} for the pool list`);
  const data = await res.json();
  return [...data].sort((a, b) => b.popularity - a.popularity);
}

export function usePools() {
  const query = useQuery({
    queryKey: ["pools"],
    queryFn: fetchPools,
  });
  // Every existing caller expects a plain array (never undefined) to
  // map/filter/find over without an extra null check at every call
  // site — same contract the old useState<PoolDetailed[]>([]) gave.
  return { ...query, pools: query.data ?? [] };
}
