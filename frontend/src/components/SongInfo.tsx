// SongInfo.tsx — pixel design: difficulties grouped by characteristic,
// ranked = gold with an outline ring, unranked = muted with a
// difficulty-colored left edge. All API handlers are unchanged.
import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import type { BSSongInfo, BSDifficulty } from "./types";
import { characteristicLabels, characteristicIcons } from "./types";
import logo from "../assets/Logo.png";
import beatsaverIcon from "../assets/Icons/beatsaver.png";
import beatleaderIcon from "../assets/Icons/beatleader.svg";
import "./pixel-ui.css";

function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")} min`;
}

const SongInfo: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const poolId = location.state?.poolId;
  const starRatings: Record<string, Record<string, number>> | undefined =
    location.state?.starRatings;

  const [song, setSong] = useState<BSSongInfo | null>(null);
  const [ranking, setRanking] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!id) return;
    fetch(`https://api.beatsaver.com/maps/id/${id}`)
      .then((res) => res.json())
      .then(setSong);
  }, [id]);

  if (!song)
    return <div className="pixel-font text-[11px] text-cyan-300 p-6">Loading song data...</div>;

  const difficulties: BSDifficulty[] = song.versions?.[0]?.diffs || [];
  const grouped: Record<string, BSDifficulty[]> = {};
  difficulties.forEach((diff) => {
    if (!grouped[diff.characteristic]) grouped[diff.characteristic] = [];
    grouped[diff.characteristic].push(diff);
  });

  const songHash = song.versions?.[0]?.hash?.toUpperCase();
  const rankedCount = difficulties.filter(
    (d) => starRatings?.[d.characteristic]?.[d.difficulty] !== undefined,
  ).length;

  // ---- API handlers (unchanged from the previous version) ----------

  const askKey = () => {
    const key = prompt("Please enter the API key for this pool:");
    if (!key) alert("No API key entered.");
    return key;
  };

  const recalcCR = (key: string) =>
    fetch("http://localhost:3001/proxy/recalculate_cr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId }),
    });

  const setStarRating = async (key: string, formattedId: string) => {
    const isAutomatic = window.confirm(
      "Calculate star rating automatically?\n\nOK = Automatic\nCancel = Manual",
    );
    if (isAutomatic) {
      const res = await fetch("http://localhost:3001/proxy/set_automatic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, pool: poolId, song: formattedId }),
      });
      return res.json();
    }
    let rating = prompt("What star rating should be set? (e.g. 8.5)");
    if (!rating) {
      alert("No star rating entered.");
      return null;
    }
    rating = rating.replace(",", ".");
    const ratingNum = parseFloat(rating);
    if (isNaN(ratingNum) || ratingNum < 0) {
      alert("Invalid star rating.");
      return null;
    }
    const res = await fetch("http://localhost:3001/proxy/set_manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId, song: formattedId, rating: ratingNum }),
    });
    return res.json();
  };

  const makeHandlers = (characteristic: string, difficulty: string) => {
    const diffKey = `${characteristic}-${difficulty}`;
    const formattedId = `${songHash}|_${difficulty}_Solo${characteristic}`;
    const busy = () => setRanking((r) => ({ ...r, [diffKey]: true }));
    const done = () => setRanking((r) => ({ ...r, [diffKey]: false }));

    const handleRank = async () => {
      if (!poolId || !songHash) return;
      busy();
      const key = askKey();
      if (!key) return done();
      const resRank = await fetch("http://localhost:3001/proxy/rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, pool: poolId, song: formattedId }),
      });
      const resultRank = await resRank.json();
      if (resultRank.status !== "success") {
        alert("Error ranking: " + (resultRank.error || resultRank.status));
        return done();
      }
      const resultSet = await setStarRating(key, formattedId);
      if (!resultSet) return done();
      if (resultSet.status === "success") {
        alert("Difficulty ranked and star rating set!");
        await recalcCR(key);
        window.location.reload();
      } else {
        alert("Error setting star rating: " + (resultSet.error || resultSet.status));
      }
      done();
    };

    const handleUnrank = async () => {
      if (!poolId || !songHash) return;
      busy();
      const key = askKey();
      if (!key) return done();
      const res = await fetch("http://localhost:3001/proxy/unrank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, pool: poolId, song: formattedId }),
      });
      const result = await res.json();
      if (result.status === "success") {
        alert("Difficulty unranked!");
        await recalcCR(key);
        window.location.reload();
      } else {
        alert("Error: " + (result.error || result.status));
      }
      done();
    };

    const handleSetStarRating = async () => {
      if (!poolId || !songHash) return;
      busy();
      const key = askKey();
      if (!key) return done();
      const resultSet = await setStarRating(key, formattedId);
      if (!resultSet) return done();
      if (resultSet.status === "success") {
        alert("Star rating set!");
        await recalcCR(key);
        window.location.reload();
      } else {
        alert("Error setting star rating: " + (resultSet.error || resultSet.status));
      }
      done();
    };

    return { diffKey, handleRank, handleUnrank, handleSetStarRating };
  };

  // ---- Render --------------------------------------------------------

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
          {poolId && (
            <>
              / <Link to={`/pool/${poolId}`} className="text-cyan-300">{poolId}</Link>{" "}
            </>
          )}
          / <span className="text-[#b7c0d6]">{song.metadata.songName}</span>
        </span>
        <div className="flex-1" />
        <Link
          to={poolId ? `/pool/${poolId}` : "/"}
          className="pixel-tab"
          style={{ color: "#b7c0d6" }}
        >
          ◂ BACK TO POOL
        </Link>
      </div>

      <div className="w-full max-w-screen-2xl mx-auto px-6 pt-6 pb-9">
        {/* Hero */}
        <div className="pixel-pool-header">
          <div
            className="pixel-pool-header-cover"
            style={{ backgroundImage: `url(${song.versions?.[0]?.coverURL})` }}
          />

          <div className="pixel-pool-header-main">
            <div className="pixel-font text-[18px] text-cyan-300">
              {song.metadata.songName}
            </div>
            <div className="text-[13px] text-[#b7c0d6]">
              {song.metadata.songAuthorName} · mapped by{" "}
              <span className="text-[#eafcff]">{song.uploader.name}</span>
            </div>
            <div
              className="text-xs leading-relaxed text-[#8b95ad] max-w-[72ch]"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {song.description}
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              <span className="pixel-stat">BPM <b>{song.metadata.bpm}</b></span>
              <span className="pixel-stat">
                LENGTH <b>{formatDuration(song.metadata.duration)}</b>
              </span>
              <span className="pixel-stat">
                ▲ <b style={{ color: "#34d399" }}>{song.stats.upvotes}</b>
              </span>
              <span className="pixel-stat">
                ▼ <b style={{ color: "#fb7185" }}>{song.stats.downvotes}</b>
              </span>
            </div>
          </div>

          <div className="pixel-song-links">
            <span className="pixel-font text-[8px] text-[#f3c542]">LINKS</span>
            <a
              href={`https://beatsaver.com/maps/${song.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={beatsaverIcon} alt="" />
              BeatSaver
            </a>
            <a
              href={`https://beatleader.com/leaderboard/global/${song.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src={beatleaderIcon} alt="" />
              BeatLeader
            </a>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 pb-3">
          <span className="pixel-section-label">DIFFICULTIES</span>
          <div className="pixel-rule" />
          <span className="text-xs text-[#b7c0d6]">
            {rankedCount} ranked of {difficulties.length} across{" "}
            {Object.keys(grouped).length} characteristics
          </span>
        </div>

        {/* One card per characteristic */}
        <div className="flex flex-col gap-3">
          {Object.entries(grouped).map(([characteristic, diffs]) => {
            const rankedHere = diffs.filter(
              (d) => starRatings?.[characteristic]?.[d.difficulty] !== undefined,
            ).length;

            return (
              <div key={characteristic} className="pixel-char-card">
                <div className="head">
                  {characteristicIcons[characteristic] && (
                    <img
                      src={characteristicIcons[characteristic]}
                      alt={characteristic}
                    />
                  )}
                  <span className="pixel-font text-[10px] text-cyan-300">
                    {characteristicLabels[characteristic] || characteristic}
                  </span>
                  <span className="text-[11px] text-[#b7c0d6]">
                    {rankedHere} of {diffs.length} ranked
                  </span>
                </div>

                <div className="body">
                  {diffs.map((diff) => {
                    const star = starRatings?.[characteristic]?.[diff.difficulty];
                    const isRanked = star !== undefined;
                    const { diffKey, handleRank, handleUnrank, handleSetStarRating } =
                      makeHandlers(characteristic, diff.difficulty);
                    const busy = ranking[diffKey];

                    return (
                      <div
                        key={diffKey}
                        className={`pixel-diff-tile${isRanked ? " ranked" : ` diff-${diff.difficulty}`}`}
                      >
                        <div className="row">
                          <span className="label">{diff.difficulty}</span>
                          {isRanked && <span className="stars">★ {star}</span>}
                          <div className="actions">
                            {isRanked ? (
                              <>
                                <button
                                  className="pixel-mini danger"
                                  onClick={handleUnrank}
                                  disabled={busy}
                                >
                                  {busy ? "..." : "Unrank"}
                                </button>
                                <button
                                  className="pixel-mini info"
                                  onClick={handleSetStarRating}
                                  disabled={busy}
                                >
                                  {busy ? "..." : "Set Stars"}
                                </button>
                              </>
                            ) : (
                              <button
                                className="pixel-mini warn"
                                onClick={handleRank}
                                disabled={busy || !poolId}
                              >
                                {busy ? "..." : "Rank"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="stats">
                          <span>NJS <b>{diff.njs}</b></span>
                          <span>NPS <b>{diff.nps?.toFixed?.(1) ?? diff.nps}</b></span>
                          <span>NOTES <b>{diff.notes}</b></span>
                          <span>BOMBS <b>{diff.bombs}</b></span>
                          <span>WALLS <b>{diff.obstacles}</b></span>
                          <span>OFFSET <b>{diff.offset}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SongInfo;
