import React, { useEffect, useState } from "react";
import SongList from "./components/SongList";

interface PoolDetailed {
  id: string;
  title: string;
  image: string;
  short_description: string;
  author: string;
  player_count: number;
  popularity: number;
  banner_image?: string; // <--- hinzugefügt
}

const App: React.FC = () => {
  const [pools, setPools] = useState<PoolDetailed[]>([]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  // Pools beim Laden holen
  useEffect(() => {
    fetch("http://localhost:3001/proxy/map_pools_detailed")
      .then((res) => res.json())
      .then((data) =>
        setPools(
          [...data].sort((a, b) => a.title.localeCompare(b.title))
        )
      )
      .catch(() => setPools([]));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-900 font-sans">
      <div className="w-full max-w-screen-2xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-cyan-400 text-center tracking-tight">
          Beat Saber Playlist Viewer
        </h1>
        {/* Pool-Auswahl */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 mb-8 flex flex-col items-center shadow">
          <label className="block mb-4 text-neutral-200 font-semibold text-lg">
            Pool auswählen
          </label>
          <select
            className="px-4 py-2 rounded-lg bg-neutral-900 text-neutral-100 font-semibold"
            value={selectedPool ?? ""}
            onChange={(e) => setSelectedPool(e.target.value)}
          >
            <option value="" disabled>
              Bitte Pool wählen...
            </option>
            {pools.map((pool) => (
              <option key={pool.id} value={pool.id}>
                {pool.title}
              </option>
            ))}
          </select>
          {/* Optional: Mehr Infos zum ausgewählten Pool anzeigen */}
          {selectedPool && (() => {
            const pool = pools.find((p) => p.id === selectedPool);
            if (!pool) return null;
            return (
              <div className="mt-6 w-full flex justify-center">
                <div className="flex flex-col md:flex-row items-center gap-6 bg-neutral-800 border border-neutral-700 rounded-xl p-6 shadow w-full max-w-2xl">
                  <img
                    src={pool.image}
                    alt={pool.title}
                    className="w-32 h-32 object-cover rounded-lg border border-neutral-700 shadow"
                  />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-2xl font-bold text-cyan-300">
                      {pool.title}
                    </div>
                    <div className="text-neutral-400 text-base">
                      {pool.short_description}
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-neutral-500">
                      <span>
                        Autor:{" "}
                        <span className="font-semibold text-neutral-300">
                          {pool.author}
                        </span>
                      </span>
                      <span>
                        Spieler:{" "}
                        <span className="font-semibold text-neutral-300">
                          {pool.player_count}
                        </span>
                      </span>
                      <span>
                        Popularität:{" "}
                        <span className="font-semibold text-neutral-300">
                          {pool.popularity}
                        </span>
                      </span>
                    </div>
                    {pool.banner_image && (
                      <img
                        src={pool.banner_image}
                        alt="Banner"
                        className="mt-2 w-full max-h-16 object-cover rounded"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        {/* SongList anzeigen, wenn Pool gewählt */}
        {selectedPool && <SongList poolId={selectedPool} />}
      </div>
    </div>
  );
};

export default App;