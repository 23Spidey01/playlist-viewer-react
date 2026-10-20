// usePoolSongs.ts — a pool's full song data (Hitbloq + BeatSaver),
// loading/caching, and every server mutation that acts on it (rank,
// unrank, recalculate CR, set star rating). Split out of SongList.tsx
// so that file is left with rendering and view-only derived state
// (search/sort, missing/duplicate detection) — this hook owns
// everything that actually talks to the network or the shared
// React Query cache.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BSSongInfo } from "./beatSaverTypes";
import type { DetailedSong } from "./hitbloqTypes";
import { diffMap, charMap } from "./hitbloqTypes";
import { askApiKey, alertDialog, confirmDialog, promptText } from "./dialogStore";
import { postToPool } from "./hitbloqApi";
import { fetchSongsByHashes } from "./beatsaverApi";
import { usePoolRankedSongs } from "./usePoolRankedSongs";
import type { SelectedDiffs, StarRatingMap } from "./useDiffSelection";

// Build a map: hash -> characteristic -> difficulty -> starRating
function buildStarRatingMap(songs: DetailedSong[]): StarRatingMap {
  const map: StarRatingMap = {};
  songs.forEach((song) => {
    const parts = song.song_id.split("_");
    const hash = parts[0].toUpperCase();
    const diffShort = parts[1];
    const charShort = parts[2];
    const difficulty = diffMap[diffShort] || diffShort;
    const characteristic = charMap[charShort] || charShort;

    if (!map[hash]) map[hash] = {};
    if (!map[hash][characteristic]) map[hash][characteristic] = {};
    if (typeof song.song_stars === "number") {
      map[hash][characteristic][difficulty] = song.song_stars;
    }
  });
  return map;
}

// Formats a Hitbloq song_id (HASH_diffShort_charShort) the way every
// rank/unrank/star-rating call expects it: "HASH|_Difficulty_SoloChar".
function formatHitbloqSongId(songId: string): string {
  const parts = songId.split("_");
  const hash = parts[0];
  const diffShort = parts[1];
  const charShort = parts[2];
  const difficulty = diffMap[diffShort] || diffShort;
  const characteristic = charMap[charShort] || charShort;
  return `${hash}|_${difficulty}_Solo${characteristic}`;
}

interface LoadProgress {
  current: number;
  total: number;
}

export function usePoolSongs(poolId: string) {
  const queryClient = useQueryClient();
  // What the loading indicator is currently doing, and its progress
  // (null while the total isn't known yet, e.g. paging through
  // Hitbloq) — shared by the initial two-stage load below AND the
  // mutations further down, which reuse the same full-page "busy"
  // treatment for their own final refresh step.
  const [loadStage, setLoadStage] = useState("");
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);

  // Stage 1: the pool's raw ranked list from Hitbloq. Shared with
  // ComparePoolsPage under the same query key — visiting a pool in
  // either place warms the cache for the other.
  const {
    data: songs = [],
    isLoading: loadingSongs,
    error: songsError,
    refetch: refetchSongs,
  } = usePoolRankedSongs(poolId, {
    onBatchStart: (fromPage, toPage) => {
      setLoadStage(`Loading ranked songs from Hitbloq (page ${fromPage + 1}-${toPage + 1})...`);
      setLoadProgress(null);
    },
  });

  // Stage 2: resolve those ranked hashes against BeatSaver. Reads
  // stage 1's result straight out of the query cache (rather than via
  // a reactive `songs` closure) so that an imperative refetch of this
  // query after stage 1 has just been refetched always sees that
  // fresh data, regardless of whether this component has re-rendered
  // yet — see refreshAfterMutation below.
  const {
    data: bsData,
    isLoading: loadingBs,
    error: bsError,
    refetch: refetchBs,
  } = useQuery({
    queryKey: ["poolBeatSaverSongs", poolId],
    queryFn: () => {
      const rankedSongs =
        queryClient.getQueryData<DetailedSong[]>(["poolRankedSongs", poolId]) ?? [];
      const hashes = Array.from(
        new Set(rankedSongs.map((song) => song.song_id.split("_")[0].toLowerCase())),
      );
      setLoadStage("Fetching song data from BeatSaver...");
      setLoadProgress({ current: 0, total: hashes.length });
      return fetchSongsByHashes(hashes, {
        onProgress: (current, total) => setLoadProgress({ current, total }),
      });
    },
    enabled: Boolean(poolId) && !loadingSongs && !songsError,
  });

  const bsSongs = useMemo(() => bsData?.songs ?? [], [bsData]);
  const queryHashByEntry = useMemo(
    () => bsData?.queryHashByEntry ?? new Map<BSSongInfo, string>(),
    [bsData],
  );
  const starRatingMap = useMemo(() => buildStarRatingMap(songs), [songs]);

  const loading = loadingSongs || loadingBs || mutationBusy;
  const firstError = songsError ?? bsError;
  const loadError = firstError
    ? firstError instanceof Error
      ? firstError.message
      : "Failed to load this pool."
    : null;

  const retry = () => {
    refetchSongs();
    refetchBs();
  };

  // After a mutation changes which songs are ranked, bring both stages
  // back in sync with the server — replaces the old window.location.
  // reload(). Stage 1 is awaited before stage 2 refetches (rather than
  // firing both at once) specifically because stage 2 reads stage 1's
  // cache directly: refetching them concurrently would let it resolve
  // against the hashes from before this mutation.
  const refreshAfterMutation = async () => {
    setMutationBusy(true);
    setLoadStage("Refreshing pool...");
    setLoadProgress(null);
    await refetchSongs();
    await refetchBs();
    setMutationBusy(false);
  };

  const handleRecalculateCR = async () => {
    const key = await askApiKey(poolId);
    if (!key) return alertDialog("No API key entered.");
    setMutationBusy(true);
    setLoadStage("Recalculating CR...");
    setLoadProgress(null);
    const { ok, result } = await postToPool("recalculate_cr", { key, pool: poolId });
    setMutationBusy(false);
    await alertDialog(
      ok ? "CR recalculated!" : "Error: " + (result?.error || result?.status || "unknown error"),
    );
  };

  // Sends a batch of difficulties to Hitbloq as unranked — shared by
  // the "not found" panel's Unrank All/Selected and the "duplicate
  // rankings" panel's, which differ only in which entries and wording
  // they pass in.
  const unrankEntries = async (
    entries: DetailedSong[],
    scope: "all" | "selected",
    noun: string,
    onDone: () => void,
  ) => {
    if (entries.length === 0) return;
    const key = await askApiKey(poolId);
    if (!key) return alertDialog("No API key entered.");
    const proceed = await confirmDialog(
      scope === "all"
        ? `Are you sure you want to send all ${noun} as unranked?`
        : `Are you sure you want to send ${entries.length} selected difficult${
            entries.length === 1 ? "y" : "ies"
          } as unranked?`,
      { okLabel: "Unrank", cancelLabel: "Cancel", danger: true },
    );
    if (!proceed) return;

    setMutationBusy(true);
    setLoadStage("Unranking...");
    setLoadProgress({ current: 0, total: entries.length });
    let count = 0;
    let processed = 0;
    const errors: string[] = [];
    for (const song of entries) {
      const formattedId = formatHitbloqSongId(song.song_id);
      const { ok, result } = await postToPool("unrank", { key, pool: poolId, song: formattedId });
      if (ok) count++;
      else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to unrank"}`);
      processed++;
      setLoadProgress({ current: processed, total: entries.length });
    }
    if (count > 0) await refreshAfterMutation();
    setMutationBusy(false);
    if (count === 0) {
      await alertDialog(
        `Nothing was unranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} difficult${count === 1 ? "y" : "ies"} sent as unranked!` +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    onDone();
  };

  // Every selected (hash, characteristic, difficulty) triple, flattened.
  function flattenSelection(selectedDiffs: SelectedDiffs) {
    const out: { hash: string; characteristic: string; difficulty: string }[] = [];
    for (const hash in selectedDiffs) {
      for (const characteristic in selectedDiffs[hash]) {
        for (const difficulty of selectedDiffs[hash][characteristic]) {
          out.push({ hash, characteristic, difficulty });
        }
      }
    }
    return out;
  }

  // Rank every selected difficulty that is not ranked yet
  const rankAllSelected = async (selectedDiffs: SelectedDiffs) => {
    const key = await askApiKey(poolId);
    if (!key) return;
    let count = 0;
    const errors: string[] = [];
    for (const { hash, characteristic, difficulty } of flattenSelection(selectedDiffs)) {
      if (starRatingMap[hash]?.[characteristic]?.[difficulty] !== undefined) continue;
      const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
      const { ok, result } = await postToPool("rank", { key, pool: poolId, song: formattedId });
      if (ok) count++;
      else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to rank"}`);
    }
    let crFailed = false;
    if (count > 0) {
      const { ok } = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !ok;
    }
    if (count === 0) {
      await alertDialog(
        `Nothing was ranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} Difficult${count === 1 ? "y" : "ies"} ranked` +
        (crFailed ? " (CR recalculation failed)" : " and CR recalculated") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    await refreshAfterMutation();
  };

  // Unrank every selected difficulty (only meaningful when all are
  // currently ranked — the caller gates the button on that, this just
  // does the work once it's called).
  const unrankAllSelected = async (selectedDiffs: SelectedDiffs) => {
    const key = await askApiKey(poolId);
    if (!key) return;
    let count = 0;
    const errors: string[] = [];
    for (const { hash, characteristic, difficulty } of flattenSelection(selectedDiffs)) {
      const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
      const { ok, result } = await postToPool("unrank", { key, pool: poolId, song: formattedId });
      if (ok) count++;
      else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to unrank"}`);
    }
    let crFailed = false;
    if (count > 0) {
      const { ok } = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !ok;
    }
    if (count === 0) {
      await alertDialog(
        `Nothing was unranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} Difficult${count === 1 ? "y" : "ies"} unranked` +
        (crFailed ? " (CR recalculation failed)" : "") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    await refreshAfterMutation();
  };

  // Set a star rating for the whole selection; ranks unranked diffs first if needed
  const setStarRatingForSelection = async (selectedDiffs: SelectedDiffs) => {
    const selection = flattenSelection(selectedDiffs);
    const unrankedDiffs = selection.filter(
      ({ hash, characteristic, difficulty }) =>
        starRatingMap[hash]?.[characteristic]?.[difficulty] === undefined,
    );

    if (unrankedDiffs.length > 0) {
      const proceed = await confirmDialog(
        "Your selection contains difficulties that are not ranked yet. Should these be ranked first and then the star rating be set?",
        { okLabel: "Rank them first", cancelLabel: "Cancel" },
      );
      if (!proceed) return;
      const rankKey = await askApiKey(poolId);
      if (!rankKey) return;
      let rankedFirstCount = 0;
      const rankFirstErrors: string[] = [];
      for (const { hash, characteristic, difficulty } of unrankedDiffs) {
        const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
        const { ok, result } = await postToPool("rank", {
          key: rankKey,
          pool: poolId,
          song: formattedId,
        });
        if (ok) rankedFirstCount++;
        else rankFirstErrors.push(`${formattedId}: ${result?.error || result?.status || "failed to rank"}`);
      }
      if (rankedFirstCount > 0) {
        await postToPool("recalculate_cr", { key: rankKey, pool: poolId });
      }
      if (rankedFirstCount === 0) {
        return alertDialog(
          `Couldn't rank any of the ${unrankedDiffs.length} unranked difficulties — check the API key and try again.` +
            (rankFirstErrors.length ? `\n\n${rankFirstErrors.join("\n")}` : ""),
        );
      }
      await alertDialog(
        `${rankedFirstCount} of ${unrankedDiffs.length} difficulties ranked first! Now the star rating will be set.` +
          (rankFirstErrors.length
            ? `\n\n${rankFirstErrors.length} problem(s):\n${rankFirstErrors.join("\n")}`
            : ""),
      );
    }

    const key = await askApiKey(poolId);
    if (!key) return;
    const isAutomatic = await confirmDialog(
      "Calculate star rating automatically, or set it manually?",
      { okLabel: "Automatic", cancelLabel: "Manual" },
    );
    let manualRating: number | undefined = undefined;
    if (!isAutomatic) {
      let rating = await promptText(
        "What star rating should be set for all selected difficulties?",
        { placeholder: "e.g. 8.5" },
      );
      if (!rating) return alertDialog("No star rating entered.");
      rating = rating.replace(",", ".");
      manualRating = parseFloat(rating);
      if (isNaN(manualRating) || manualRating < 0)
        return alertDialog("Invalid star rating.");
    }
    let count = 0;
    const errors: string[] = [];
    for (const { hash, characteristic, difficulty } of selection) {
      const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
      const { ok, result } = isAutomatic
        ? await postToPool("set_automatic", { key, pool: poolId, song: formattedId })
        : await postToPool("set_manual", {
            key,
            pool: poolId,
            song: formattedId,
            rating: manualRating,
          });
      if (ok) count++;
      else errors.push(`${formattedId}: ${result?.error || result?.status || "failed to set star rating"}`);
    }
    let crFailed = false;
    if (count > 0) {
      const { ok } = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !ok;
    }
    if (count === 0) {
      await alertDialog(
        `Nothing was changed — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} Difficult${count === 1 ? "y" : "ies"} changed` +
        (crFailed ? " (CR recalculation failed)" : " and CR recalculated") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    await refreshAfterMutation();
  };

  return {
    songs,
    bsSongs,
    queryHashByEntry,
    starRatingMap,
    loading,
    loadStage,
    loadProgress,
    loadError,
    retry,
    handleRecalculateCR,
    unrankEntries,
    rankAllSelected,
    unrankAllSelected,
    setStarRatingForSelection,
  };
}
