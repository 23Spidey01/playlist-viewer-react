import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import logo from "../assets/Logo.png";
import AccountMenu from "./AccountMenu";
import type { DetailedSong } from "./hitbloqTypes";
import { diffMap, charMap } from "./hitbloqTypes";
import HitbloqSongCard from "./HitbloqSongCard";
import { askApiKey, alertDialog, confirmDialog } from "./dialogStore";
import { postToPool } from "./hitbloqApi";
import { usePoolRankedSongs } from "./usePoolRankedSongs";
import { usePools } from "./usePools";
import { songKey } from "./comparePoolsLogic";

const ComparePoolsPage: React.FC = () => {
  const { pools } = usePools();
  const queryClient = useQueryClient();
  const [poolAId, setPoolAId] = useState("");
  const [poolBId, setPoolBId] = useState("");
  const [unrankFrom, setUnrankFrom] = useState<"a" | "b">("a");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const poolA = pools.find((p) => p.id === poolAId);
  const poolB = pools.find((p) => p.id === poolBId);
  const bothPicked = Boolean(poolAId && poolBId && poolAId !== poolBId);

  // Both pools are independent — these two queries run concurrently
  // rather than one after the other (same reasoning as the per-pool
  // page-batching itself: no reason to serialize work that doesn't
  // depend on itself), and share their cache with any other page that
  // has loaded either pool's ranked list (see usePoolRankedSongs).
  const {
    data: songsA,
    isLoading: loadingA,
    error: errorA,
    refetch: refetchA,
  } = usePoolRankedSongs(poolAId, { enabled: bothPicked });
  const {
    data: songsB,
    isLoading: loadingB,
    error: errorB,
    refetch: refetchB,
  } = usePoolRankedSongs(poolBId, { enabled: bothPicked });

  const loading = bothPicked && (loadingA || loadingB);
  const firstError = errorA ?? errorB;
  const loadError = firstError
    ? firstError instanceof Error
      ? firstError.message
      : "Failed to load one of the pools."
    : null;
  const retry = () => {
    refetchA();
    refetchB();
  };

  // A fresh pool pick starts a clean slate — the previous pair's
  // selection has nothing to do with this one.
  useEffect(() => {
    setSelected(new Set());
  }, [poolAId, poolBId]);

  // Every difficulty ranked under the exact same hash+difficulty+
  // characteristic in BOTH pools, grouped by hash for display — these
  // are the real duplicates the user is after, not just "same song,
  // different difficulty" (which isn't a problem worth flagging here).
  const matches = useMemo(() => {
    if (!songsA || !songsB) return null;
    const keysB = new Set(songsB.map(songKey));
    const byHash: Record<string, DetailedSong[]> = {};
    songsA.forEach((song) => {
      if (!keysB.has(songKey(song))) return;
      const hash = song.song_id.split("_")[0].toUpperCase();
      (byHash[hash] ??= []).push(song);
    });
    return byHash;
  }, [songsA, songsB]);

  const matchEntries = useMemo(
    () => (matches ? Object.values(matches).flat() : []),
    [matches],
  );

  const toggleDiff = (songId: string) => {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const targetPoolId = unrankFrom === "a" ? poolAId : poolBId;
  const targetPool = unrankFrom === "a" ? poolA : poolB;

  const unrankEntries = async (entries: DetailedSong[], scope: "all" | "selected") => {
    if (entries.length === 0 || !targetPoolId) return;
    const key = await askApiKey(targetPoolId);
    if (!key) return alertDialog("No API key entered.");
    const proceed = await confirmDialog(
      scope === "all"
        ? `Unrank all ${entries.length} duplicate difficult${entries.length === 1 ? "y" : "ies"} from ${targetPool?.title || targetPoolId}?`
        : `Unrank ${entries.length} selected difficult${entries.length === 1 ? "y" : "ies"} from ${targetPool?.title || targetPoolId}?`,
      { okLabel: "Unrank", cancelLabel: "Cancel", danger: true },
    );
    if (!proceed) return;

    setBusy(true);
    let count = 0;
    const errors: string[] = [];
    const succeededIds = new Set<string>();
    for (const song of entries) {
      const parts = song.song_id.split("_");
      const hash = parts[0];
      const diffShort = parts[1];
      const charShort = parts[2];
      const difficulty = diffMap[diffShort] || diffShort;
      const characteristic = charMap[charShort] || charShort;
      const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
      const { ok, result } = await postToPool("unrank", {
        key,
        pool: targetPoolId,
        song: formattedId,
      });
      if (ok) {
        count++;
        succeededIds.add(song.song_id);
      } else {
        errors.push(`${formattedId}: ${result?.error || result?.status || "failed to unrank"}`);
      }
    }
    setBusy(false);

    if (count > 0) {
      // Drop the ones that actually succeeded from whichever side we
      // just unranked from, so the list reflects reality right away
      // instead of still showing them as duplicates until a reload.
      // Updates the shared query cache directly (not just this page's
      // own state), so a pool page or RankNewMaps visited afterward
      // sees the same up-to-date list instead of its own stale copy.
      queryClient.setQueryData<DetailedSong[]>(
        ["poolRankedSongs", targetPoolId],
        (old) => old?.filter((s) => !succeededIds.has(s.song_id)) ?? old,
      );
      setSelected(new Set());
    }

    if (count === 0) {
      await alertDialog(
        `Nothing was unranked — check the API key and try again.` +
          (errors.length ? `\n\n${errors.join("\n")}` : ""),
      );
      return;
    }
    await alertDialog(
      `${count} difficult${count === 1 ? "y" : "ies"} sent as unranked from ${targetPool?.title || targetPoolId}!` +
        (errors.length ? `\n\n${errors.length} problem(s):\n${errors.join("\n")}` : ""),
    );
  };

  const sortedPools = useMemo(
    () => [...pools].sort((a, b) => a.title.localeCompare(b.title)),
    [pools],
  );

  return (
    <>
      <div className="pixel-topbar">
        <Link to="/" className="pixel-icon-btn shrink-0">
          <img
            src={logo}
            alt="Hitbloq Pool Manager"
            className="h-9 w-auto"
            style={{ imageRendering: "pixelated" }}
          />
        </Link>
        <span className="text-xs text-[#6a7690]">
          / <span className="text-[#b7c0d6]">compare</span>
        </span>
        <div className="flex-1" />
        <Link to="/" className="pixel-tab nav">
          ◂ ALL POOLS
        </Link>
        <AccountMenu />
      </div>

      <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">
        <div className="flex items-baseline gap-2.5 pb-5">
          <span className="pixel-section-label">COMPARE POOLS</span>
          <span className="text-xs text-neutral-500">
            find diffs ranked in both pools
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6 max-w-3xl">
          <label className="flex flex-col gap-1.5 text-xs text-[#b7c0d6]">
            POOL A
            <select
              className="pixel-select"
              value={poolAId}
              onChange={(e) => setPoolAId(e.target.value)}
            >
              <option value="">Select a pool…</option>
              {sortedPools.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === poolBId}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[#b7c0d6]">
            POOL B
            <select
              className="pixel-select"
              value={poolBId}
              onChange={(e) => setPoolBId(e.target.value)}
            >
              <option value="">Select a pool…</option>
              {sortedPools.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === poolAId}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {poolAId && poolBId && poolAId === poolBId && (
          <div className="text-orange-400 text-sm mb-6">
            Pick two different pools to compare.
          </div>
        )}

        {loading && (
          <div className="pixel-loading">
            <span className="pixel-font text-[10px] text-cyan-300">
              Loading both pools' ranked lists…
            </span>
            <div className="pixel-progress indeterminate">
              <div className="pixel-progress-fill" />
            </div>
          </div>
        )}

        {!loading && loadError && (
          <div
            className="pixel-card pixel-card-static pixel-page-flyin"
            style={{ padding: 24, maxWidth: 480 }}
          >
            <div className="text-sm text-[#b7c0d6] mb-3">
              Couldn't compare these pools: {loadError}
            </div>
            <button className="pixel-btn" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && matches && (
          <div className="pixel-missing-panel">
            <div className="flex flex-wrap items-center gap-3">
              <span className="pixel-font text-[10px] text-red-400">
                {Object.keys(matches).length} SONG
                {Object.keys(matches).length === 1 ? "" : "S"} WITH {matchEntries.length}{" "}
                DIFFICULT{matchEntries.length === 1 ? "Y" : "IES"} RANKED IN BOTH POOLS
              </span>
            </div>

            {matchEntries.length === 0 ? (
              <div className="pixel-missing-note">
                <b>i</b>
                <span>
                  No identical difficulties ranked in both pools — nothing to unrank.
                </span>
              </div>
            ) : (
              <>
                <div className="pixel-missing-note">
                  <b>i</b>
                  <span>
                    Pick which pool to clean up, select the difficulties to remove,
                    then unrank them from that pool only — the other pool is never
                    touched.
                  </span>
                </div>

                <div className="flex items-center gap-2.5 my-3">
                  <span className="text-xs text-[#8b95ad]">UNRANK DUPLICATES FROM</span>
                  <div className="pixel-tabs">
                    <button
                      className={`pixel-tab${unrankFrom === "a" ? " active" : ""}`}
                      onClick={() => setUnrankFrom("a")}
                    >
                      {poolA?.title || poolAId}
                    </button>
                    <button
                      className={`pixel-tab${unrankFrom === "b" ? " active" : ""}`}
                      onClick={() => setUnrankFrom("b")}
                    >
                      {poolB?.title || poolBId}
                    </button>
                  </div>
                </div>

                <div className="pixel-missing-list">
                  {Object.entries(matches).map(([hash, entries]) => (
                    <HitbloqSongCard
                      key={hash}
                      hash={hash}
                      entries={entries}
                      selected={selected}
                      onToggleDiff={toggleDiff}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="pixel-font text-[10px] text-cyan-300">
                    {selected.size} SELECTED
                  </span>
                  <button
                    className="pixel-btn danger disabled:opacity-40"
                    disabled={busy}
                    onClick={() => unrankEntries(matchEntries, "all")}
                  >
                    Unrank All From {targetPool?.title || targetPoolId}
                  </button>
                  <button
                    className="pixel-btn danger disabled:opacity-40"
                    disabled={busy || selected.size === 0}
                    onClick={() =>
                      unrankEntries(
                        matchEntries.filter((e) => selected.has(e.song_id)),
                        "selected",
                      )
                    }
                  >
                    Unrank Selected
                  </button>
                  <button
                    className="pixel-tab ml-auto disabled:opacity-40"
                    disabled={selected.size === 0}
                    onClick={() => setSelected(new Set())}
                  >
                    CLEAR
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ComparePoolsPage;
