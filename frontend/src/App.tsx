import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  Link,
} from "react-router-dom";
import SongList from "./components/SongList";
import SongInfo from "./components/SongInfo";
import { SongPoolProvider } from "./components/SongPoolProvider";
import RankNewMaps from "./components/RankNewMaps";
import logo from "./assets/Logo.png";
import PoolCard from "./components/PoolCard";
import "./components/pixel-ui.css";

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

type SortKey = "popularity" | "name" | "players";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popularity", label: "POPULAR" },
  { key: "players", label: "PLAYERS" },
  { key: "name", label: "A–Z" },
];

// Topbar: logo + search + sort tabs + compare, all in one row
const TopBar: React.FC<{
  search: string;
  setSearch: (v: string) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
}> = ({ search, setSearch, sort, setSort }) => (
  <div className="pixel-topbar">
    <Link to="/" className="pixel-icon-btn shrink-0">
      <img
        src={logo}
        alt="Hitbloq Pool Manager"
        className="h-9 w-auto"
        style={{ imageRendering: "pixelated" }}
      />
    </Link>

    <div className="pixel-searchbox">
      <span className="prompt">&gt;</span>
      <input
        type="text"
        placeholder="Search pools, authors, ids..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    <div className="pixel-tabs">
      {SORTS.map((s) => (
        <button
          key={s.key}
          className={`pixel-tab${sort === s.key ? " active" : ""}`}
          onClick={() => setSort(s.key)}
        >
          {s.label}
        </button>
      ))}
    </div>

    <button className="pixel-btn with-icon shrink-0">
      <span className="pixel-compare-icon">
        <i />
        <i />
      </span>
      Compare Pools
    </button>
  </div>
);

// Card view for all pools with search and sorting
const PoolOverview: React.FC<{ pools: PoolDetailed[] }> = ({ pools }) => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popularity");

  const filtered = pools
    .filter(
      (pool) =>
        pool.title.toLowerCase().includes(search.toLowerCase()) ||
        pool.author.toLowerCase().includes(search.toLowerCase()) ||
        pool.id.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "popularity") return b.popularity - a.popularity;
      if (sort === "players") return b.player_count - a.player_count;
      return a.title.localeCompare(b.title);
    });

  const sortLabel =
    sort === "popularity" ? "popularity" : sort === "players" ? "players" : "name";

  return (
    <>
      <TopBar
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
      />

      <div className="w-full max-w-screen-2xl mx-auto px-6">
        <div className="flex items-baseline gap-2.5 pt-5 pb-3.5">
          <span className="pixel-section-label">ALL POOLS</span>
          <span className="text-xs text-neutral-500">
            {filtered.length} pools · sorted by {sortLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch pb-10">
          {filtered.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="pixel-font text-[11px] text-orange-400 text-center mt-8">
            No pools found.
          </div>
        )}
      </div>
    </>
  );
};

// Wrapper for SongList, gets Pool ID from URL. Brings its own topbar
// (breadcrumb + "back to all pools" link), same recipe as SongInfo's
// topbar, so it skips SubPageShell's plain logo bar.
const PoolSongListPage: React.FC<{ pools: PoolDetailed[] }> = ({ pools }) => {
  const { id } = useParams<{ id: string }>();
  const pool = pools.find((p) => p.id === id);

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
        {pool && (
          <span className="text-xs text-[#6a7690]">
            / <span className="text-[#b7c0d6]">{pool.id}</span>
          </span>
        )}
        <div className="flex-1" />
        <Link to="/" className="pixel-tab" style={{ color: "#b7c0d6" }}>
          ◂ ALL POOLS
        </Link>
      </div>
      <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">
        {!id || !pool ? (
          <div className="text-orange-400">Pool not found.</div>
        ) : (
          <SongList poolId={id} pool={pool} />
        )}
      </div>
    </>
  );
};

// Header for all non-overview pages (the overview brings its own topbar)
const SubPageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
    </div>
    <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">{children}</div>
  </>
);

const App: React.FC = () => {
  const [pools, setPools] = useState<PoolDetailed[]>([]);

  useEffect(() => {
    fetch("http://localhost:3001/proxy/map_pools_detailed")
      .then((res) => res.json())
      .then((data) =>
        setPools([...data].sort((a, b) => b.popularity - a.popularity)),
      )
      .catch(() => setPools([]));
  }, []);

  return (
    <SongPoolProvider>
      <Router>
        <div className="min-h-screen pixel-bg font-sans">
          <Routes>
            <Route path="/" element={<PoolOverview pools={pools} />} />
            <Route path="/pool/:id" element={<PoolSongListPage pools={pools} />} />
            {/* SongInfo brings its own topbar (with breadcrumb + back
                link) and page container, so it skips SubPageShell. */}
            <Route path="/song/:id" element={<SongInfo />} />
            <Route
              path="/pool/:poolId/rank-new"
              element={
                <SubPageShell>
                  <RankNewMaps />
                </SubPageShell>
              }
            />
          </Routes>
        </div>
      </Router>
    </SongPoolProvider>
  );
};

export default App;
