// useRankQueue.ts — the sticky "RANK QUEUE" sidebar: which songs/diffs
// are staged, their per-diff star-rating choice, and actually sending
// the batch to Hitbloq. Split out of RankNewMaps.tsx alongside
// useBeatSaverSearch and usePlaylistImport.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { askApiKey, alertDialog, confirmDialog, promptText } from "./dialogStore";
import { postToPool } from "./hitbloqApi";
import type { BSSongInfo } from "./beatSaverTypes";

export function useRankQueue(poolId: string | undefined) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [songs, setSongs] = useState<BSSongInfo[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  // song.id -> diffKey -> rating text. Empty (or missing) means
  // automatic — Hitbloq calculates the rating itself; a non-empty
  // value is used as a manual rating instead. No separate automatic/
  // manual flag: whether the box has something typed in it *is* the
  // choice.
  const [diffOptions, setDiffOptions] = useState<Record<string, Record<string, string>>>({});
  const [ranking, setRanking] = useState(false);
  // What handleBatchRank is doing right now + how far through the
  // selected difficulties it is — each diff can involve a retry with a
  // multi-second delay (see postToPoolWithRetry), so a bare "Ranking..."
  // gives no sense that anything's actually happening.
  const [rankStage, setRankStage] = useState("");
  const [rankProgress, setRankProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const stagedIds = new Set(songs.map((s) => s.id));
  const totalSelected = Object.values(selected).reduce((sum, d) => sum + d.length, 0);

  const addSong = (song: BSSongInfo) => {
    setSongs((old) => (old.some((s) => s.id === song.id) ? old : [...old, song]));
  };

  // Same as addSong, but also pre-checks whichever difficulties the
  // source playlist entry highlighted for this song (the same ones
  // BeatSaver itself highlights when you pick that playlist there)
  // instead of leaving every diff unselected the way a plain search
  // result does. `highlightedDiffKeys` comes from the playlist's own
  // diffsByHash — passed in rather than read from playlist state
  // directly, so this hook doesn't need to know usePlaylistImport exists.
  const addSongFromPlaylist = (song: BSSongInfo, highlightedDiffKeys: string[] | undefined) => {
    const alreadyStaged = stagedIds.has(song.id);
    addSong(song);
    // Already queued from somewhere else — leave whatever selection is
    // already there alone rather than clobbering it.
    if (alreadyStaged) return;

    if (!highlightedDiffKeys || highlightedDiffKeys.length === 0) return;

    // Only pre-select difficulties that actually exist on the map as
    // BeatSaver has it now — a playlist can point at one that's since
    // been removed or renamed.
    const realDiffKeys = new Set(
      (song.versions?.[0]?.diffs || []).map((d) => `${d.characteristic}|${d.difficulty}`),
    );
    const toSelect = highlightedDiffKeys.filter((key) => realDiffKeys.has(key));
    if (toSelect.length === 0) return;

    setSelected((old) => ({ ...old, [song.id]: toSelect }));
    setDiffOptions((old) => ({
      ...old,
      [song.id]: Object.fromEntries(toSelect.map((key) => [key, ""])),
    }));
  };

  const removeSong = (id: string) => {
    setSongs((old) => old.filter((s) => s.id !== id));
    setSelected((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setDiffOptions((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  };

  const toggleDiff = (songId: string, diffKey: string) => {
    setSelected((old) => {
      const prev = old[songId] || [];
      const checked = prev.includes(diffKey);
      return {
        ...old,
        [songId]: checked ? prev.filter((d) => d !== diffKey) : [...prev, diffKey],
      };
    });
    setDiffOptions((old) => ({
      ...old,
      [songId]: {
        ...old[songId],
        [diffKey]: old[songId]?.[diffKey] ?? "",
      },
    }));
  };

  const setDiffRating = (songId: string, diffKey: string, rating: string) => {
    setDiffOptions((old) => ({
      ...old,
      [songId]: { ...old[songId], [diffKey]: rating },
    }));
  };

  const handleClearQueue = async () => {
    if (songs.length === 0) return;
    const ok = await confirmDialog(
      `Clear all ${songs.length} queued song${songs.length === 1 ? "" : "s"}? This doesn't undo any ranking already done — just empties this list.`,
      { okLabel: "Clear All", danger: true },
    );
    if (!ok) return;
    setSongs([]);
    setSelected({});
    setDiffOptions({});
  };

  // Bulk-overwrites the rating box for every difficulty currently
  // selected across the whole queue — a one-shot "apply now" action,
  // not a default that only affects future picks.
  const handleSetRatingForAll = async () => {
    if (totalSelected === 0) return;

    const input = await promptText(
      `Set a star rating for all ${totalSelected} selected difficult${totalSelected === 1 ? "y" : "ies"}:`,
      { placeholder: "e.g. 6.5" },
    );
    if (input === null) return;

    const trimmed = input.trim();
    if (trimmed) {
      const ratingNum = parseFloat(trimmed.replace(",", "."));
      if (isNaN(ratingNum) || ratingNum < 0) {
        await alertDialog("Enter a valid star rating (or leave it empty for Automatic).");
        return;
      }
    }

    setDiffOptions((old) => {
      const next = { ...old };
      for (const song of songs) {
        const diffKeys = selected[song.id] || [];
        if (diffKeys.length === 0) continue;
        next[song.id] = { ...next[song.id] };
        for (const diffKey of diffKeys) {
          next[song.id][diffKey] = trimmed;
        }
      }
      return next;
    });
  };

  // Hitbloq doesn't know about a map it's never seen before, and
  // rejects the very first call about it — on ANY of rank/set_automatic/
  // set_manual, not just rank — with "invalid song ID". A rank call
  // that then succeeds is apparently what makes Hitbloq go fetch/cache
  // the map, but that doesn't mean the star-rating call right after it
  // is safe: it can independently hit the exact same "just learned
  // about this" gap and fail on its own, even though the rank right
  // before it worked — leaving the map ranked but stuck at whatever
  // default star rating Hitbloq gives an unrated map, with no error
  // surfaced for the rank step itself. Retrying here, not just for
  // rank, closes that gap.
  const RETRY_DELAYS_MS = [1500, 3000];
  const postToPoolWithRetry = async (path: string, body: unknown) => {
    let result = await postToPool(path, body);
    for (const delay of RETRY_DELAYS_MS) {
      if (result.ok) break;
      const message = (result.result?.error || result.result?.status || "").toLowerCase();
      if (!message.includes("invalid song id")) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      result = await postToPool(path, body);
    }
    return result;
  };

  const handleBatchRank = async () => {
    if (!poolId) return;
    const key = await askApiKey(poolId);
    if (!key) return alertDialog("No API key entered.");
    setRanking(true);
    let count = 0;
    let processed = 0;
    const errors: string[] = [];
    const total = totalSelected;
    setRankProgress({ current: 0, total });
    const advance = () => {
      processed++;
      setRankProgress({ current: processed, total });
    };

    for (const song of songs) {
      const hash = song.versions?.[0]?.hash?.toUpperCase();
      const diffs = selected[song.id] || [];
      for (const diff of diffs) {
        const [characteristic, difficulty] = diff.split("|");
        const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
        const label = `${song.metadata.songName} ${difficulty}`;
        setRankStage(label);

        // 1. Rank
        const rankResult = await postToPoolWithRetry("rank", { key, pool: poolId, song: formattedId });
        if (!rankResult.ok) {
          errors.push(`${label}: ${rankResult.result?.error || rankResult.result?.status || "failed to rank"}`);
          advance();
          continue;
        }

        // 2. Set star rating — an empty box means automatic; anything
        // typed in it is used as a manual rating instead.
        const ratingText = (diffOptions[song.id]?.[diff] ?? "").trim();
        let starResult;
        if (!ratingText) {
          starResult = await postToPoolWithRetry("set_automatic", { key, pool: poolId, song: formattedId });
        } else {
          const ratingNum = parseFloat(ratingText.replace(",", "."));
          if (isNaN(ratingNum) || ratingNum < 0) {
            errors.push(`${label}: invalid star rating, skipped`);
            advance();
            continue;
          }
          starResult = await postToPoolWithRetry("set_manual", {
            key,
            pool: poolId,
            song: formattedId,
            rating: ratingNum,
          });
        }
        if (!starResult.ok) {
          errors.push(`${label}: ${starResult.result?.error || starResult.result?.status || "failed to set star rating"}`);
          advance();
          continue;
        }
        count++;
        advance();
      }
    }

    // CR recalculate — only worth attempting if something actually got
    // ranked above.
    let crFailed = false;
    if (count > 0) {
      setRankStage("Recalculating CR...");
      const crResult = await postToPool("recalculate_cr", { key, pool: poolId });
      crFailed = !crResult.ok;
      if (crFailed)
        errors.push(`CR recalculation: ${crResult.result?.error || crResult.result?.status || "failed"}`);
    }

    setRanking(false);
    setRankStage("");
    setRankProgress(null);

    if (count === 0) {
      await alertDialog(
        `Nothing was ranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }

    await alertDialog(
      `${count} difficult${count === 1 ? "y" : "ies"} ranked` +
        (crFailed ? " (CR recalculation failed)" : " and CR recalculated") +
        "!" +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
    // This pool's ranked-songs/BeatSaver-resolved queries may already
    // be cached (e.g. the user came here FROM that pool's page) and
    // would otherwise still look fresh under the global 5-minute
    // staleTime — without this, navigating back would show the
    // pre-rank list until that expires.
    await queryClient.invalidateQueries({ queryKey: ["poolRankedSongs", poolId] });
    await queryClient.invalidateQueries({ queryKey: ["poolBeatSaverSongs", poolId] });
    navigate(`/pool/${poolId}`);
  };

  return {
    songs,
    selected,
    diffOptions,
    stagedIds,
    totalSelected,
    ranking,
    rankStage,
    rankProgress,
    addSong,
    addSongFromPlaylist,
    removeSong,
    toggleDiff,
    setDiffRating,
    handleClearQueue,
    handleSetRatingForAll,
    handleBatchRank,
  };
}
