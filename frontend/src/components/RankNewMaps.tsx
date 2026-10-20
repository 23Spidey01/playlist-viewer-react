import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AccountMenu from "./AccountMenu";
import type { BSSongInfo } from "./beatSaverTypes";
import type { FetchSongsByHashesResult } from "./beatsaverApi";
import { useBeatSaverSearch } from "./useBeatSaverSearch";
import { usePlaylistImport } from "./usePlaylistImport";
import { useRankQueue } from "./useRankQueue";
import MapResultRow from "./MapResultRow";
import StagedSongCard from "./StagedSongCard";
import logo from "../assets/Logo.png";
import "./pixel-ui.css";

const RankNewMaps: React.FC = () => {
  const { poolId } = useParams<{ poolId: string }>();
  // Read-only, reactive view into the shared React Query cache that
  // usePoolSongs populates (see its "poolBeatSaverSongs" query) —
  // enabled: false means this never fetches on its own, it just
  // subscribes so poolHashes below updates once that pool's page has
  // actually loaded its BeatSaver data somewhere else in the app.
  const { data: bsData } = useQuery<FetchSongsByHashesResult>({
    queryKey: ["poolBeatSaverSongs", poolId],
    queryFn: () => Promise.resolve({ songs: [], queryHashByEntry: new Map() }),
    enabled: false,
  });

  // -- Playlist import (.bplist/.json or a beatsaver.com/playlists/<id>
  //    link) — handlePlaylistUrl is handed to useBeatSaverSearch below
  //    since a playlist link pasted into the search bar redirects here
  //    too, rather than showing as a search result. --
  const {
    playlistFileInputRef,
    playlistLoading,
    playlistError,
    playlist,
    setPlaylist,
    isDraggingPlaylist,
    setIsDraggingPlaylist,
    showOnlyNewFromPlaylist,
    setShowOnlyNewFromPlaylist,
    handlePlaylistFile,
    handlePlaylistUrl,
  } = usePlaylistImport();

  // -- BeatSaver search/browse: the actual replacement for manually
  //    copy-pasting links. Empty query browses the latest uploads
  //    instead of showing nothing, so there's always something to pick
  //    from without typing anything first. --
  const [activeTab, setActiveTab] = useState<"search" | "import">("search");
  const {
    query,
    setQuery,
    includeAI,
    setIncludeAI,
    hideInPool,
    setHideInPool,
    results,
    resultsLoading,
    hasMoreResults,
    searchError,
    mapper,
    setForceTextSearch,
    resolvedDirectly,
    handleLoadMoreResults,
    highlightWords,
    pastedPlaylistId,
  } = useBeatSaverSearch(handlePlaylistUrl);

  // -- Songs staged to actually rank, and their per-difficulty options --
  const {
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
  } = useRankQueue(poolId);

  // Hashes already present somewhere in this pool, if its song list has
  // been loaded/cached already (usePoolSongs populates this query when
  // the pool's own page is visited) — purely an informational "IN POOL"
  // tag on search results, not a hard dependency (a song can still have
  // un-ranked diffs worth adding).
  const poolHashes = new Set(
    (bsData?.songs || []).map((s) => s.versions?.[0]?.hash?.toUpperCase()),
  );
  const isNewToPool = (song: BSSongInfo) => {
    const hash = song.versions?.[0]?.hash?.toUpperCase();
    return !hash || !poolHashes.has(hash);
  };
  // A playlist entry's highlighted difficulties, looked up by the
  // song's current hash — handed to addSongFromPlaylist, which stays
  // ignorant of where that data actually comes from.
  const highlightedDiffsFor = (song: BSSongInfo): string[] | undefined => {
    const hash = song.versions?.[0]?.hash?.toUpperCase();
    return hash ? playlist?.diffsByHash[hash] : undefined;
  };
  const newFromPlaylist = playlist ? playlist.resolved.filter(isNewToPool) : [];
  const visiblePlaylistSongs = playlist
    ? showOnlyNewFromPlaylist
      ? newFromPlaylist
      : playlist.resolved
    : [];
  const visibleResults = hideInPool ? results.filter(isNewToPool) : results;

  return (
    <>
      {/* Same topbar recipe as SongInfo.tsx/PoolSongListPage — logo,
          breadcrumb, a "◂ BACK TO ..." pixel-tab link pinned to the
          right — instead of a standalone Back button sitting in the
          page content, which was the one page not matching this. */}
      <div className="pixel-topbar">
        <Link to="/" className="pixel-icon-btn shrink-0">
          <img
            src={logo}
            alt="Hitbloq Pool Manager"
            className="h-9 w-auto"
            style={{ imageRendering: "pixelated" }}
          />
        </Link>
        {poolId && (
          <span className="text-xs text-[#6a7690]">
            /{" "}
            <Link to={`/pool/${poolId}`} className="text-cyan-300">
              {poolId}
            </Link>{" "}
            / <span className="text-[#b7c0d6]">Rank New Maps</span>
          </span>
        )}
        <div className="flex-1" />
        <Link to={poolId ? `/pool/${poolId}` : "/"} className="pixel-tab nav">
          ◂ BACK TO POOL
        </Link>
        <AccountMenu />
      </div>

      <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <h2 className="pixel-font text-base sm:text-lg text-cyan-300 pixel-page-flyin">
            RANK NEW MAPS
          </h2>

          <div className="pixel-ranknew-layout">
            {/* LEFT: search/import, tabbed instead of stacked so only
                one of the two ever takes up space at a time. */}
            <div className="flex flex-col gap-4 pixel-page-flyin" style={{ animationDelay: "0.08s" }}>
              <div className="pixel-tabs">
                <button
                  className={`pixel-tab${activeTab === "search" ? " active" : ""}`}
                  onClick={() => setActiveTab("search")}
                >
                  SEARCH BEATSAVER
                </button>
                <button
                  className={`pixel-tab${activeTab === "import" ? " active" : ""}`}
                  onClick={() => setActiveTab("import")}
                >
                  IMPORT PLAYLIST
                </button>
              </div>

              {activeTab === "import" && (
                <div className="pixel-rank-panel flex flex-col gap-4">
                  <div
                    className={`pixel-dropzone${isDraggingPlaylist ? " dragging" : ""}`}
                    onClick={() => playlistFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPlaylist(true);
                    }}
                    onDragLeave={() => setIsDraggingPlaylist(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPlaylist(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handlePlaylistFile(file);
                    }}
                  >
                    <span>
                      {playlistLoading
                        ? "Reading playlist..."
                        : "Drop a .bplist/.json playlist file here, or click to browse"}
                    </span>
                    <input
                      ref={playlistFileInputRef}
                      type="file"
                      accept=".bplist,.json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePlaylistFile(file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {playlistError && <p className="text-xs text-red-400">{playlistError}</p>}

                  {playlist && (
                    <>
                      <div className="flex items-center gap-3">
                        {playlist.image && (
                          <img
                            src={playlist.image}
                            alt={playlist.title}
                            className="pixel-cover w-12 h-12 object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-cyan-200 truncate">{playlist.title}</div>
                          {playlist.author && (
                            <div className="text-xs text-[#b7c0d6] truncate">
                              by {playlist.author}
                            </div>
                          )}
                        </div>
                        <button className="pixel-toggle-link" onClick={() => setPlaylist(null)}>
                          ✕ clear
                        </button>
                      </div>

                      {playlist.unresolvedCount > 0 && (
                        <p className="text-xs text-[#6a7690]">
                          {playlist.unresolvedCount} song{playlist.unresolvedCount === 1 ? "" : "s"}{" "}
                          from this playlist couldn't be found on BeatSaver (deleted, or a hash
                          mismatch).
                        </p>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <button
                          className={`pixel-toggle-chip${showOnlyNewFromPlaylist ? " on" : ""}`}
                          onClick={() => setShowOnlyNewFromPlaylist((v) => !v)}
                        >
                          HIDE IN POOL
                        </button>
                        {newFromPlaylist.length > 0 && (
                          <button
                            className="pixel-btn secondary"
                            onClick={() =>
                              newFromPlaylist.forEach((song) =>
                                addSongFromPlaylist(song, highlightedDiffsFor(song)),
                              )
                            }
                          >
                            Add All New ({newFromPlaylist.length})
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6a7690]">
                        Difficulties highlighted in the playlist are auto-selected when a song's
                        added.
                      </p>

                      <div className="pixel-search-grid">
                        {visiblePlaylistSongs.length === 0 && (
                          <p className="text-xs text-[#6a7690]">
                            {showOnlyNewFromPlaylist
                              ? "Every map in this playlist is already in the pool."
                              : "No maps resolved from this playlist."}
                          </p>
                        )}
                        {visiblePlaylistSongs.map((song, index) => {
                          const hash = song.versions?.[0]?.hash?.toUpperCase();
                          return (
                            <MapResultRow
                              key={song.id}
                              index={index}
                              song={song}
                              added={stagedIds.has(song.id)}
                              inPool={hash ? poolHashes.has(hash) : false}
                              highlightWords={[]}
                              onAdd={() => addSongFromPlaylist(song, highlightedDiffsFor(song))}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "search" && (
                <div className="pixel-rank-panel flex flex-col gap-4">
                  <div className="pixel-searchbox">
                    <span className="prompt">&gt;</span>
                    <input
                      type="text"
                      placeholder="song, mapper, link/ID or playlist link"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setForceTextSearch(false);
                      }}
                      onPaste={(e) => {
                        // A plain single-line <input> silently mangles a
                        // multi-line paste (several links/IDs, one per
                        // line — the old paste-a-list textarea's use
                        // case) — browsers strip/collapse newlines
                        // inconsistently. Read the clipboard ourselves
                        // and join lines with spaces so
                        // looksLikeIdOrLink's tokenizing sees every line
                        // intact, regardless of the browser's own
                        // behavior.
                        const text = e.clipboardData.getData("text");
                        if (/[\r\n]/.test(text)) {
                          e.preventDefault();
                          const joined = text
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .join(" ");
                          setQuery(joined);
                          setForceTextSearch(false);
                        }
                      }}
                    />
                  </div>

                  {mapper && (
                    <div className="pixel-mapper-banner">
                      <span className="pixel-font text-[8px] text-cyan-300">MAPPER</span>
                      <img
                        src={mapper.avatar}
                        alt={mapper.name}
                        className="pixel-cover w-8 h-8 object-cover shrink-0"
                      />
                      <span className="text-xs text-cyan-200 font-semibold flex-1">
                        {mapper.name}
                      </span>
                      <button className="pixel-toggle-link" onClick={() => setForceTextSearch(true)}>
                        search maps instead
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      className={`pixel-toggle-chip${hideInPool ? " on" : ""}`}
                      onClick={() => setHideInPool((v) => !v)}
                    >
                      HIDE IN POOL
                    </button>
                    <button
                      className={`pixel-toggle-chip${includeAI ? " on" : ""}`}
                      onClick={() => setIncludeAI((v) => !v)}
                    >
                      AI MAPS: {includeAI ? "ON" : "OFF"}
                    </button>
                  </div>

                  {resolvedDirectly && (
                    <p className="text-xs text-[#6a7690]">
                      Loaded {results.length} map{results.length === 1 ? "" : "s"} directly from the
                      pasted link{results.length === 1 ? "" : "s"}/ID{results.length === 1 ? "" : "s"}.
                    </p>
                  )}
                  {pastedPlaylistId && (
                    <p className="text-xs text-[#6a7690]">
                      {playlistLoading
                        ? "Loading that playlist from BeatSaver..."
                        : "That's a BeatSaver playlist link — switch to IMPORT PLAYLIST above."}
                    </p>
                  )}

                  {resultsLoading && results.length === 0 && !pastedPlaylistId && (
                    <p className="text-xs text-[#6a7690]">Searching BeatSaver...</p>
                  )}
                  {searchError && (
                    <p className="text-xs text-red-400">
                      Couldn't reach BeatSaver. Try again in a moment.
                    </p>
                  )}
                  {!resultsLoading && !searchError && visibleResults.length === 0 && !pastedPlaylistId && (
                    <p className="text-xs text-[#6a7690]">
                      {results.length > 0 ? "Every result is already in this pool." : "No maps found."}
                    </p>
                  )}

                  {visibleResults.length > 0 && (
                    <div className="pixel-search-grid">
                      {visibleResults.map((song, index) => {
                        const hash = song.versions?.[0]?.hash?.toUpperCase();
                        return (
                          <MapResultRow
                            key={song.id}
                            index={index}
                            song={song}
                            added={stagedIds.has(song.id)}
                            inPool={hash ? poolHashes.has(hash) : false}
                            highlightWords={highlightWords}
                            onAdd={() => addSong(song)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {results.length > 0 && hasMoreResults && (
                    <button
                      className="pixel-btn secondary self-center"
                      onClick={handleLoadMoreResults}
                      disabled={resultsLoading}
                    >
                      {resultsLoading ? "Loading..." : "Load More"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: sticky rank queue — stays in view while scrolling
                through search results on the left. */}
            <div className="pixel-ranknew-queue-col pixel-page-flyin" style={{ animationDelay: "0.16s" }}>
              <div className="pixel-rank-panel flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="pixel-section-label">RANK QUEUE</span>
                  {songs.length > 0 && (
                    <button className="pixel-toggle-link" onClick={handleClearQueue}>
                      clear all
                    </button>
                  )}
                </div>

                {songs.length === 0 ? (
                  <p className="text-xs text-[#6a7690]">
                    Nothing queued yet — add maps from the left.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-[#6a7690]">
                      {songs.length} song{songs.length === 1 ? "" : "s"} · {totalSelected} diff
                      {totalSelected === 1 ? "" : "s"} selected
                    </p>

                    <div className="flex flex-col gap-2">
                      {songs.map((song, index) => (
                        <StagedSongCard
                          key={song.id}
                          index={index}
                          song={song}
                          selectedDiffs={selected[song.id] || []}
                          diffOptions={diffOptions[song.id] || {}}
                          onToggleDiff={(diffKey) => toggleDiff(song.id, diffKey)}
                          onOptionsChange={(diffKey, rating) => setDiffRating(song.id, diffKey, rating)}
                          onRemove={() => removeSong(song.id)}
                        />
                      ))}
                    </div>

                    <button
                      className="pixel-btn secondary"
                      onClick={handleSetRatingForAll}
                      disabled={totalSelected === 0}
                    >
                      Set Star Rating For All
                    </button>

                    <button
                      className="pixel-btn"
                      onClick={handleBatchRank}
                      disabled={ranking || totalSelected === 0}
                    >
                      {ranking
                        ? "Ranking..."
                        : `Rank ${totalSelected} Difficult${totalSelected === 1 ? "y" : "ies"}`}
                    </button>
                    {ranking && (
                      <div className="pixel-loading">
                        <span className="pixel-font text-[10px] text-cyan-300">
                          {rankStage || "Ranking..."}
                        </span>
                        <div className={`pixel-progress${rankProgress ? "" : " indeterminate"}`}>
                          <div
                            className="pixel-progress-fill"
                            style={
                              rankProgress
                                ? {
                                    width: `${Math.min(
                                      100,
                                      Math.round(
                                        (rankProgress.current / Math.max(rankProgress.total, 1)) *
                                          100,
                                      ),
                                    )}%`,
                                  }
                                : undefined
                            }
                          />
                        </div>
                        {rankProgress && (
                          <span className="text-[11px] text-neutral-500">
                            {rankProgress.current} / {rankProgress.total}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RankNewMaps;
