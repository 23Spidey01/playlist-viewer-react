import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Link } from "react-router-dom";
import SongList from "./components/SongList";
import SongInfo from "./components/SongInfo";
import { SongPoolProvider } from "./components/SongPoolProvider";
import RankNewMaps from "./components/RankNewMaps";

interface PoolDetailed {
  id: string;
  title: string;
  image: string;
  short_description: string;
  author: string;
  player_count: number;
  popularity: number;
  banner_image?: string;
}

// Card view for all pools with search and sorting
const PoolOverview: React.FC<{ pools: PoolDetailed[] }> = ({ pools }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"popularity" | "name" | "players">("popularity");

  // Filter and sort pools
  const filtered = pools
    .filter(
      (pool) =>
        pool.title.toLowerCase().includes(search.toLowerCase()) ||
        pool.author.toLowerCase().includes(search.toLowerCase()) ||
        pool.id.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "popularity") return b.popularity - a.popularity;
      if (sort === "players") return b.player_count - a.player_count;
      return a.title.localeCompare(b.title);
    });

  return (
    <div>
      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center">
        <input
          type="text"
          placeholder="Search pools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-neutral-100 w-full sm:w-72"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-neutral-100"
        >
          <option value="popularity">Sort by: Popularity</option>
          <option value="name">Sort by: Name</option>
          <option value="players">Sort by: Players</option>
        </select>
      </div>
      {/* Pool-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((pool) => (
          <div
            key={pool.id}
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 shadow hover:shadow-lg cursor-pointer flex flex-col items-center transition-all"
            onClick={() => navigate(`/pool/${pool.id}`)}
          >
            <img
              src={pool.image}
              alt={pool.title}
              className="w-32 h-32 object-cover rounded-lg border border-neutral-700 shadow mb-4"
            />
            <div className="text-2xl font-bold text-cyan-300 mb-2 text-center">{pool.title}</div>
            <div className="text-neutral-400 text-base mb-2 text-center">{pool.short_description}</div>
            <div className="flex gap-4 mt-2 text-sm text-neutral-500">
              <span>
                Author: <span className="font-semibold text-neutral-300">{pool.author}</span>
              </span>
              <span>
                Players: <span className="font-semibold text-neutral-300">{pool.player_count}</span>
              </span>
              <span>
                Popularity: <span className="font-semibold text-neutral-300">{pool.popularity}</span>
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
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-orange-400 text-center mt-8">No pools found.</div>
      )}
    </div>
  );
};

// Wrapper for SongList, gets Pool ID from URL
const PoolSongListPage: React.FC<{ pools: PoolDetailed[] }> = ({ pools }) => {
  const { id } = useParams<{ id: string }>();
  const pool = pools.find((p) => p.id === id);
  if (!id || !pool) return <div className="text-orange-400">Pool not found.</div>;
  return (
    <div>
      <div className="flex flex-col md:flex-row items-center gap-6 bg-neutral-800 border border-neutral-700 rounded-xl p-6 shadow w-full max-w-2xl mx-auto mb-8">
        <img
          src={pool.image}
          alt={pool.title}
          className="w-32 h-32 object-cover rounded-lg border border-neutral-700 shadow"
        />
        <div className="flex-1 flex flex-col gap-2">
          <div className="text-2xl font-bold text-cyan-300">{pool.title}</div>
          <div className="text-neutral-400 text-base">{pool.short_description}</div>
          <div className="flex gap-4 mt-2 text-sm text-neutral-500">
            <span>
              Author: <span className="font-semibold text-neutral-300">{pool.author}</span>
            </span>
            <span>
              Players: <span className="font-semibold text-neutral-300">{pool.player_count}</span>
            </span>
            <span>
              Popularity: <span className="font-semibold text-neutral-300">{pool.popularity}</span>
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
      <SongList poolId={id} />
    </div>
  );
};

const App: React.FC = () => {
  const [pools, setPools] = useState<PoolDetailed[]>([]);

  // Fetch pools while loading
  useEffect(() => {
    fetch("http://localhost:3001/proxy/map_pools_detailed")
      .then((res) => res.json())
      .then((data) =>
        setPools(
          [...data].sort((a, b) => b.popularity - a.popularity)
        )
      )
      .catch(() => setPools([]));
  }, []);

  return (
    <SongPoolProvider>
      <Router>
        <div className="min-h-screen bg-neutral-900 font-sans">
          <div className="w-full max-w-screen-2xl mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold mb-8 text-cyan-400 text-center tracking-tight">
              <Link to="/" className="hover:underline hover:text-cyan-300 transition-colors">
                Hitbloq Pool Manager
              </Link>
            </h1>
            <Routes>
              <Route path="/" element={<PoolOverview pools={pools} />} />
              <Route path="/pool/:id" element={<PoolSongListPage pools={pools} />} />
              <Route path="/song/:id" element={<SongInfo />} />
              <Route path="/pool/:poolId/rank-new" element={<RankNewMaps />} />
            </Routes>
          </div>
        </div>
      </Router>
    </SongPoolProvider>
  );
};

export default App;