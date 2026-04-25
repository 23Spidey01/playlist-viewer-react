import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const parseBeatSaverId = (urlOrId: string) => {
  // Extract map ID from a BeatSaver link or return it directly
  const match = urlOrId.match(/([0-9a-fA-F]{1,8})$/);
  return match ? match[1] : urlOrId.trim();
};

const RankNewMaps: React.FC = () => {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [diffOptions, setDiffOptions] = useState<
    Record<string, Record<string, { method: "automatic" | "manual"; rating?: string }>>
  >({});

  // Load songs from BeatSaver
  const handleLoad = async () => {
    setLoading(true);
    const ids = input
      .split("\n")
      .map(parseBeatSaverId)
      .filter(Boolean);
    const loaded: any[] = [];
    for (const id of ids) {
      const res = await fetch(`https://api.beatsaver.com/maps/id/${id}`);
      if (res.ok) {
        loaded.push(await res.json());
      }
    }
    setSongs(loaded);
    setLoading(false);
  };

  // Rank all selected difficulties
  const handleBatchRank = async () => {
    const key = prompt("Please enter the API key for this pool:");
    if (!key) return alert("No API key entered.");
    let count = 0;
    for (const song of songs) {
      const hash = song.versions?.[0]?.hash?.toUpperCase();
      const diffs = selected[song.id] || [];
      for (const diff of diffs) {
        const [characteristic, difficulty] = diff.split("|");
        const formattedId = `${hash}|_${difficulty}_Solo${characteristic}`;
        // 1. Rank
        const bodyRank = { key, pool: poolId, song: formattedId };
        await fetch("http://localhost:3001/proxy/rank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyRank),
        });
        // 2. Set star rating
        const options = diffOptions[song.id]?.[diff] || { method: "automatic" };
        if (options.method === "automatic") {
          await fetch("http://localhost:3001/proxy/set_automatic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, pool: poolId, song: formattedId }),
          });
        } else {
          const ratingNum = parseFloat(options.rating?.replace(",", ".") || "");
          if (isNaN(ratingNum) || ratingNum < 0) {
            alert(`Invalid star rating for ${song.metadata.songName} ${diff}. Skipped.`);
            continue;
          }
          await fetch("http://localhost:3001/proxy/set_manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, pool: poolId, song: formattedId, rating: ratingNum }),
          });
        }
        count++;
      }
    }
    // CR recalculate
    await fetch("http://localhost:3001/proxy/recalculate_cr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, pool: poolId }),
    });
    alert(`${count} Difficulties ranked and CR recalculated!`);
    navigate(`/pool/${poolId}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-neutral-900 rounded-xl shadow text-neutral-100">
      <h2 className="text-2xl font-bold text-cyan-300 mb-4">Rank new maps</h2>
      <textarea
        className="w-full h-32 p-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 mb-2"
        placeholder="BeatSaver Links or IDs, one per line"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={loading}
      />
      <button
        className="px-4 py-2 bg-cyan-700 text-white rounded hover:bg-cyan-800 font-semibold disabled:opacity-50 mr-2"
        onClick={handleLoad}
        disabled={loading || !input.trim()}
      >
        {loading ? "Loading..." : "Load Songs"}
      </button>
      <button
        className="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-800 font-semibold"
        onClick={() => navigate(-1)}
      >
        Back
      </button>
      {/* Song selection */}
      {songs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-2">Select Difficulties to Rank:</h3>
          {songs.map((song) => (
            <div key={song.id} className="mb-4 p-3 bg-neutral-800 rounded">
              <div className="flex items-center gap-4">
                <img
                  src={song.versions?.[0]?.coverURL}
                  alt={song.metadata.songName}
                  className="w-16 h-16 object-cover rounded border border-neutral-700"
                />
                <div>
                  <div className="font-bold text-cyan-200">{song.metadata.songName}</div>
                  <div className="text-neutral-400 text-sm">{song.metadata.songAuthorName}</div>
                  <div className="text-neutral-500 text-xs">{song.id}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {song.versions?.[0]?.diffs?.map((diff: any) => {
                  const diffKey = `${diff.characteristic}|${diff.difficulty}`;
                  const checked = selected[song.id]?.includes(diffKey) ?? false;
                  const options = diffOptions[song.id]?.[diffKey] || { method: "automatic", rating: "" };
                  return (
                    <div key={diffKey} className="flex items-center gap-2 bg-neutral-700 px-2 py-1 rounded mb-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelected((old) => {
                            const prev = old[song.id] || [];
                            return {
                              ...old,
                              [song.id]: checked
                                ? prev.filter((d) => d !== diffKey)
                                : [...prev, diffKey],
                            };
                          });
                          // If selected, set default option
                          setDiffOptions((old) => ({
                            ...old,
                            [song.id]: {
                              ...old[song.id],
                              [diffKey]: old[song.id]?.[diffKey] || { method: "automatic", rating: "" },
                            },
                          }));
                        }}
                      />
                      {diff.characteristic} {diff.difficulty}
                      {checked && (
                        <>
                          <select
                            className="ml-2 px-1 py-0.5 rounded bg-neutral-800 text-neutral-100 text-xs"
                            value={options.method}
                            onChange={e => {
                              const method = e.target.value as "automatic" | "manual";
                              setDiffOptions(old => ({
                                ...old,
                                [song.id]: {
                                  ...old[song.id],
                                  [diffKey]: { ...options, method },
                                },
                              }));
                            }}
                          >
                            <option value="automatic">Automatic</option>
                            <option value="manual">Manual</option>
                          </select>
                          {options.method === "manual" && (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="ml-2 w-16 px-1 py-0.5 rounded bg-neutral-800 text-neutral-100 text-xs"
                              placeholder="Stars"
                              value={options.rating}
                              onChange={e => {
                                setDiffOptions(old => ({
                                  ...old,
                                  [song.id]: {
                                    ...old[song.id],
                                    [diffKey]: { ...options, rating: e.target.value },
                                  },
                                }));
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            className="mt-4 px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 font-semibold"
            onClick={handleBatchRank}
          >
            Rank Selected Difficulties & Recalculate CR
          </button>
        </div>
      )}
    </div>
  );
};

export default RankNewMaps;