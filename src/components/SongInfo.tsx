import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import type { BSSongInfo, BSDifficulty } from "./types";
import { diffColors, characteristicLabels, characteristicIcons } from "./types";

// Helper function: Convert seconds to minutes:seconds
function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")} min`;
}

const SongInfo: React.FC = () => {
  // Song ID from URL
  const { id } = useParams<{ id: string }>();
  // Router state for star ratings (passed by SongCard)
  const location = useLocation();
  const poolId = location.state?.poolId;
  const starRatings: Record<string, Record<string, number>> | undefined = location.state?.starRatings;

  // State for song data from BeatSaver
  const [song, setSong] = useState<BSSongInfo | null>(null);
  // State for already ranked difficulties (to disable button)
  const [ranking, setRanking] = useState<{ [key: string]: boolean }>({});

  // Load song data from BeatSaver when ID changes
  useEffect(() => {
    if (!id) return;
    fetch(`https://api.beatsaver.com/maps/id/${id}`)
      .then(res => res.json())
      .then(setSong);
  }, [id]);

  // Loading display while song data is being fetched
  if (!song) return <div className="text-cyan-300">Loading song data...</div>;

  // Difficulties grouped by characteristic (e.g. Standard, Lawless, ...)
  const difficulties: BSDifficulty[] = song.versions?.[0]?.diffs || [];
  const grouped: Record<string, BSDifficulty[]> = {};
  difficulties.forEach((diff) => {
    if (!grouped[diff.characteristic]) grouped[diff.characteristic] = [];
    grouped[diff.characteristic].push(diff);
  });

  return (
    <div className="max-w-8xl mx-auto p-6 bg-neutral-900 rounded-xl shadow text-neutral-100">
      {/* Back link */}
      <Link
        to={poolId ? `/pool/${poolId}` : "/"}
        className="text-cyan-400 hover:underline mb-4 inline-block"
      >
        ← Back
      </Link>
      {/* Song-Cover und Metadaten */}
      <div className="flex gap-6 mb-6">
        <img src={song.versions?.[0]?.coverURL} alt={song.metadata.songName} className="w-40 h-40 rounded-lg border border-neutral-700" />
        <div>
          <h2 className="text-4xl font-bold text-cyan-300 mb-2">{song.metadata.songName}</h2>
          <div className="text-neutral-400 mb-1 text-lg">by {song.metadata.songAuthorName}</div>
          <div className="text-neutral-500 text-base mb-2">Uploader: {song.uploader.name}</div>
          <div className="text-neutral-400 text-base">{song.description}</div>
        </div>
      </div>
      {/* Song Statistics */}
      <div className="mt-4 flex flex-wrap gap-8 text-lg">
        <div>BPM: <b>{song.metadata.bpm}</b></div>
        <div>Duration: <b>{formatDuration(song.metadata.duration)}</b></div>
        <div>Upvotes: <b>{song.stats.upvotes}</b></div>
        <div>Downvotes: <b>{song.stats.downvotes}</b></div>
      </div>
      {/* Difficulties large with star rating and detail info */}
      <div className="mt-8">
        <h3 className="text-2xl font-bold text-cyan-200 mb-4">Difficulties</h3>
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([characteristic, diffs]) => (
            <div key={characteristic} className="flex items-center gap-4">
              {/* Icon or label for the characteristic */}
              {characteristicIcons[characteristic] ? (
                <img
                  src={characteristicIcons[characteristic]}
                  alt={characteristicLabels[characteristic] || characteristic}
                  className="w-8 h-8 inline-block"
                />
              ) : (
                <span className="text-lg font-semibold text-cyan-400 min-w-[120px]">
                  {characteristicLabels[characteristic] || characteristic}
                </span>
              )}
              {/* All difficulties of this characteristic */}
              <div className="flex flex-wrap gap-3">
                {diffs.map((diff) => {
                  const star = starRatings?.[characteristic]?.[diff.difficulty];
                  const diffKey = `${characteristic}-${diff.difficulty}`;
                  const songHash = song.versions?.[0]?.hash?.toUpperCase();
                  const canRank = (star === undefined) && poolId && songHash;
                  const canUnrank = (star !== undefined) && poolId && songHash;

                  // Handler for the rank button
                  const handleRank = async () => {
                    if (!poolId || !songHash) return;
                    setRanking((r) => ({ ...r, [diffKey]: true }));
                    const key = prompt("Please enter the API key for this pool:");
                    if (!key) {
                      setRanking((r) => ({ ...r, [diffKey]: false }));
                      return alert("No API key entered.");
                    }
                    const formattedId = `${songHash}|_${diff.difficulty}_Solo${characteristic}`;

                    // First rank difficulty (as before)
                    const bodyRank = { key, pool: poolId, song: formattedId };
                    const resRank = await fetch("http://localhost:3001/proxy/rank", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(bodyRank),
                    });
                    const resultRank = await resRank.json();

                    if (resultRank.status === "success") {
                      // Now ask for Automatic/Manual
                      const isAutomatic = window.confirm(
                        "Calculate star rating automatically?\n\nOK = Automatic\nCancel = Manual"
                      );

                      let resultSet;
                      if (isAutomatic) {
                        // Automatic
                        const body = { key, pool: poolId, song: formattedId };
                        const res = await fetch("http://localhost:3001/proxy/set_automatic", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        resultSet = await res.json();
                      } else {
                        // Manual
                        let rating = prompt("What star rating should be set? (e.g. 8.5)");
                        if (!rating) {
                          setRanking((r) => ({ ...r, [diffKey]: false }));
                          return alert("No star rating entered.");
                        }
                        rating = rating.replace(",", ".");
                        const ratingNum = parseFloat(rating);
                        if (isNaN(ratingNum) || ratingNum < 0) {
                          setRanking((r) => ({ ...r, [diffKey]: false }));
                          return alert("Invalid star rating.");
                        }
                        const body = { key, pool: poolId, song: formattedId, rating: ratingNum };
                        const res = await fetch("http://localhost:3001/proxy/set_manual", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        resultSet = await res.json();
                      }

                      if (resultSet.status === "success") {
                        alert("Difficulty ranked and star rating set!");
                        // RECALCULATE CR
                        await fetch("http://localhost:3001/proxy/recalculate_cr", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ key, pool: poolId }),
                        });
                        window.location.reload();
                      } else {
                        alert("Error setting star rating: " + (resultSet.error || resultSet.status));
                      }
                    } else {
                      alert("Error ranking: " + (resultRank.error || resultRank.status));
                    }
                    setRanking((r) => ({ ...r, [diffKey]: false }));
                  };

                  // Handler for unrank button
                  const handleUnrank = async () => {
                    if (!poolId || !songHash) return;
                    setRanking((r) => ({ ...r, [diffKey]: true }));
                    const key = prompt("Please enter the API key for this pool:");
                    if (!key) {
                      setRanking((r) => ({ ...r, [diffKey]: false }));
                      return alert("No API key entered.");
                    }
                    const formattedId = `${songHash}|_${diff.difficulty}_Solo${characteristic}`;
                    const body = { key, pool: poolId, song: formattedId };
                    const res = await fetch("http://localhost:3001/proxy/unrank", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    const result = await res.json();
                    if (result.status === "success") {
                      alert("Difficulty unranked!");
                      // RECALCULATE CR
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      window.location.reload();
                    } else {
                      alert("Error: " + (result.error || result.status));
                    }
                    setRanking((r) => ({ ...r, [diffKey]: false }));
                  };

                  // Handler for set star rating button
                  const handleSetStarRating = async () => {
                    if (!poolId || !songHash) return;
                    setRanking((r) => ({ ...r, [diffKey]: true }));
                    const key = prompt("Please enter the API key for this pool:");
                    if (!key) {
                      setRanking((r) => ({ ...r, [diffKey]: false }));
                      return alert("No API key entered.");
                    }
                    const formattedId = `${songHash}|_${diff.difficulty}_Solo${characteristic}`;

                    // Automatic or manual?
                    const isAutomatic = window.confirm(
                      "Calculate star rating automatically?\n\nOK = Automatic\nCancel = Manual"
                    );

                    let resultSet;
                    if (isAutomatic) {
                      // Automatic
                      const body = { key, pool: poolId, song: formattedId };
                      const res = await fetch("http://localhost:3001/proxy/set_automatic", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      resultSet = await res.json();
                    } else {
                      // Manual
                      let rating = prompt("What star rating should be set? (e.g. 8.5)");
                      if (!rating) {
                        setRanking((r) => ({ ...r, [diffKey]: false }));
                        return alert("No star rating entered.");
                      }
                      rating = rating.replace(",", ".");
                      const ratingNum = parseFloat(rating);
                      if (isNaN(ratingNum) || ratingNum < 0) {
                        setRanking((r) => ({ ...r, [diffKey]: false }));
                        return alert("Invalid star rating.");
                      }
                      const body = { key, pool: poolId, song: formattedId, rating: ratingNum };
                      const res = await fetch("http://localhost:3001/proxy/set_manual", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      resultSet = await res.json();
                    }

                    if (resultSet.status === "success") {
                      alert("Star Rating wurde gesetzt!");
                      // CR RECALCULATE AUFRUFEN
                      await fetch("http://localhost:3001/proxy/recalculate_cr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, pool: poolId }),
                      });
                      window.location.reload();
                    } else {
                      alert("Fehler beim Setzen des Star Ratings: " + (resultSet.error || resultSet.status));
                    }
                    setRanking((r) => ({ ...r, [diffKey]: false }));
                  };

                  return (
                    <span
                      key={diffKey}
                      className={`px-4 py-2 rounded-lg text-lg font-bold shadow backdrop-blur-sm flex flex-col items-start gap-1 ${
                        star !== undefined
                          ? "border border-yellow-400 bg-yellow-700/40 text-yellow-100"
                          : diffColors[diff.difficulty] ||
                            "bg-neutral-700/60 text-cyan-100"
                      }`}
                    >
                      <span className="flex items-center gap-2 w-full">
                        {diff.difficulty}
                        {star !== undefined && (
                          <span className="inline-flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-yellow-400 inline-block"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.967c.3.921-.755 1.688-1.54 1.118l-3.38-2.455a1 1 0 00-1.175 0l-3.38 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.967a1 1 0 00-.364-1.118L2.049 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
                            </svg>
                            <span className="font-bold">
                              {star % 1 === 0 ? star : star.toString()}
                            </span>
                          </span>
                        )}
                        <span className="ml-auto flex gap-2">
                          {/* Rank-Button für unranked Difficulties */}
                          {canRank && (
                            <button
                              className="px-2 py-1 bg-cyan-700 text-white rounded text-xs hover:bg-cyan-800 transition disabled:opacity-50"
                              onClick={handleRank}
                              disabled={ranking[diffKey]}
                            >
                              {ranking[diffKey] ? "Ranking..." : "Rank"}
                            </button>
                          )}
                          {/* Unrank-Button für gerankte Difficulties */}
                          {canUnrank && (
                            <>
                              <button
                                className="px-2 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-800 transition disabled:opacity-50"
                                onClick={handleUnrank}
                                disabled={ranking[diffKey]}
                              >
                                {ranking[diffKey] ? "Unranking..." : "Unrank"}
                              </button>
                              <button
                                className="px-2 py-1 bg-yellow-700 text-white rounded text-xs hover:bg-yellow-800 transition disabled:opacity-50"
                                onClick={handleSetStarRating}
                                disabled={ranking[diffKey]}
                              >
                                {ranking[diffKey] ? "Setting..." : "Set Star Rating"}
                              </button>
                            </>
                          )}
                        </span>
                      </span>
                      {/* Zusatzinfos direkt im Badge, kleiner und grau */}
                      <span className="text-xs text-neutral-300 font-normal">
                        NJS: <b>{diff.njs}</b> | Offset: <b>{diff.offset}</b> | Notes: <b>{diff.notes}</b> | Bombs: <b>{diff.bombs}</b> | Obstacles: <b>{diff.obstacles}</b> | Events: <b>{diff.events}</b>
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SongInfo;