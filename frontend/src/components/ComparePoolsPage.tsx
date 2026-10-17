import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/Logo.png";
import AccountMenu from "./AccountMenu";
import type { PoolDetailed } from "./PoolHeader";
import type { DetailedSong } from "./types";
import { diffMap, charMap } from "./types";
import CharacteristicLabel from "./CharacteristicLabel";
import { askApiKey, alertDialog, confirmDialog } from "./dialogStore";

// Fetches every ranked difficulty in a pool via Hitbloq's paginated
// ranked_list_detailed, batching page requests the same way SongList's
// own pool loader does (see its comment there for why: one page at a
// time turns a big pool into a multi-minute wait). Kept as a separate,
// smaller copy here instead of shared — this page only ever needs the
// bare Hitbloq data, no BeatSaver enrichment, no cross-component cache.
async function fetchPoolSongs(poolId: string): Promise<DetailedSong[]> {
  const PAGE_CONCURRENCY = 6;
  const PAGE_SIZE = 30;
  let allSongs: DetailedSong[] = [];
  let nextPage = 0;
  let reachedEnd = false;
  while (!reachedEnd) {
    const batch = Array.from({ length: PAGE_CONCURRENCY }, (_, i) => nextPage + i);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        const res = await fetch(
          `http://localhost:3001/proxy/ranked_list_detailed/${poolId}/${page}`,
        );
        if (!res.ok) {
          throw new Error(`Hitbloq returned ${res.status} on page ${page + 1}`);
        }
        const data = await res.json();
        return Array.isArray(data) ? (data as DetailedSong[]) : [];
      }),
    );
    for (const pageData of batchResults) {
      allSongs = allSongs.concat(pageData);
      if (pageData.length < PAGE_SIZE) {
        reachedEnd = true;
        break;
      }
    }
    nextPage += PAGE_CONCURRENCY;
  }
  return allSongs;
}

// Identity for "is this the same ranked difficulty" across two pools —
// hash normalized to uppercase (Hitbloq's own data is consistent about
// this, but cheap to guarantee), plus the raw difficulty/characteristic
// short codes exactly as ranked.
function songKey(song: DetailedSong): string {
  const [hash, diffShort, charShort] = song.song_id.split("_");
  return `${hash.toUpperCase()}_${diffShort}_${charShort}`;
}

// One song's section in the "ranked in both pools" list — same look as
// SongList's "not found"/"duplicate rankings" panels (MissingSongCard),
// since this is the same job: a hash grouping maps that are on Hitbloq
// but have no live BeatSaver fetch backing this page, so name/cover
// come from Hitbloq's own cached copy.
const SharedSongCard: React.FC<{
  hash: string;
  entries: DetailedSong[];
  selected: Set<string>;
  onToggleDiff: (songId: string) => void;
}> = ({ hash, entries, selected, onToggleDiff }) => {
  const [coverBroken, setCoverBroken] = useState(false);
  const songName = entries.find((s) => s.song_name)?.song_name;
  const songCover = entries.find((s) => s.song_cover)?.song_cover;

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
              const starred = typeof song.song_stars === "number";
              const isSelected = selected.has(song.song_id);
              return (
                <span
                  key={song.song_id}
                  className={`${
                    starred ? "pixel-badge starred" : `pixel-badge diff-${difficulty}`
                  } pixel-badge-selectable${isSelected ? " selected" : ""}`}
                  onClick={() => onToggleDiff(song.song_id)}
                >
                  {difficulty}
                  {starred && <b className="ml-1">★ {song.song_stars}</b>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const ComparePoolsPage: React.FC<{ pools: PoolDetailed[] }> = ({ pools }) => {
  const [poolAId, setPoolAId] = useState("");
  const [poolBId, setPoolBId] = useState("");
  const [songsA, setSongsA] = useState<DetailedSong[] | null>(null);
  const [songsB, setSongsB] = useState<DetailedSong[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [unrankFrom, setUnrankFrom] = useState<"a" | "b">("a");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const poolA = pools.find((p) => p.id === poolAId);
  const poolB = pools.find((p) => p.id === poolBId);
  const bothPicked = Boolean(poolAId && poolBId && poolAId !== poolBId);

  useEffect(() => {
    if (!bothPicked) {
      setSongsA(null);
      setSongsB(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSelected(new Set());
    // Both pools are independent — fetched concurrently rather than
    // one after the other, same reasoning as the per-pool page-batching
    // itself: no reason to serialize work that doesn't depend on itself.
    Promise.all([fetchPoolSongs(poolAId), fetchPoolSongs(poolBId)])
      .then(([a, b]) => {
        if (cancelled) return;
        setSongsA(a);
        setSongsB(b);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load one of the pools.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [poolAId, poolBId, bothPicked, retryTick]);

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

  const postToPool = async (path: string, body: unknown) => {
    const res = await fetch(`http://localhost:3001/proxy/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let result: { status?: string; error?: string } | null = null;
    try {
      result = await res.json();
    } catch {
      // Non-JSON body (e.g. a raw-text 500) — ok below still resolves
      // to false via res.ok.
    }
    return { ok: res.ok && result?.status === "success", result };
  };

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
      if (unrankFrom === "a") {
        setSongsA((old) => old?.filter((s) => !succeededIds.has(s.song_id)) ?? old);
      } else {
        setSongsB((old) => old?.filter((s) => !succeededIds.has(s.song_id)) ?? old);
      }
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
        <Link to="/" className="pixel-tab" style={{ color: "#b7c0d6" }}>
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
            <button className="pixel-btn" onClick={() => setRetryTick((t) => t + 1)}>
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
                    <SharedSongCard
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
