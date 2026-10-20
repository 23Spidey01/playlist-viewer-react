import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  Link,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import SongList from "./components/SongList";
import SongInfo from "./components/SongInfo";
import RankNewMaps from "./components/RankNewMaps";
import logo from "./assets/Logo.png";
import PoolCard from "./components/PoolCard";
import { DialogHost } from "./components/Dialog";
import { AuthProvider } from "./components/AuthContext";
import AccountMenu from "./components/AccountMenu";
import LoginPage from "./components/LoginPage";
import ApiKeysPage from "./components/ApiKeysPage";
import AccountSettingsPage from "./components/AccountSettingsPage";
import ComparePoolsPage from "./components/ComparePoolsPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { usePools } from "./components/usePools";
import "./components/pixel-ui.css";

// One client for the whole app — query results (pool list, a pool's
// songs, search results, ...) are cached and deduped by their query
// key regardless of which component asks for them, replacing what
// used to be several hand-rolled, independent fetch+loading+error
// useState trios scattered across App.tsx/ApiKeysPage.tsx (the exact
// same /proxy/map_pools_detailed fetched twice), usePoolSongs.ts,
// useBeatSaverSearch.ts, and others.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Hitbloq/BeatSaver data doesn't change under you mid-session
      // often enough to justify refetching every time a component
      // remounts or the window regains focus — opt into "fetch once,
      // reuse" rather than React Query's web-app-dashboard-oriented
      // defaults (refetch on every focus).
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

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

    <Link to="/compare" className="pixel-btn with-icon shrink-0">
      <span className="pixel-compare-icon">
        <i />
        <i />
      </span>
      Compare Pools
    </Link>

    <AccountMenu />
  </div>
);

// Card view for all pools with search and sorting
const PoolOverview: React.FC = () => {
  const { pools, isLoading, isError } = usePools();
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

        {isLoading && (
          <div className="pixel-font text-[11px] text-cyan-300 text-center mt-8">
            Loading pools...
          </div>
        )}
        {isError && (
          <div className="pixel-font text-[11px] text-orange-400 text-center mt-8">
            Couldn't load the pool list. Try reloading.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch pb-10">
            {filtered.map((pool, index) => (
              <PoolCard key={pool.id} pool={pool} index={index} />
            ))}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
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
const PoolSongListPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { pools, isLoading } = usePools();
  const pool = pools.find((p) => p.id === id);
  // Owned here (not inside SongList) so this page's own topbar — the
  // one with the site logo — can show the "EDIT MODE!!" call-out too.
  const [editMode, setEditMode] = useState(false);

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
        <Link to="/" className="pixel-tab nav">
          ◂ ALL POOLS
        </Link>
        <AccountMenu />
        {editMode && (
          <div className="pixel-editmode-banner" aria-hidden="true">
            !EDIT MODE!
          </div>
        )}
      </div>
      <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">
        {!id ? (
          <div className="text-orange-400">Pool not found.</div>
        ) : isLoading ? (
          <div className="pixel-font text-[11px] text-cyan-300">Loading...</div>
        ) : !pool ? (
          // Only shown once the pool list has actually finished
          // loading and this id genuinely isn't in it — previously
          // this flashed on every load (pools started out empty while
          // its own fetch was still in flight), not just a real 404.
          <div className="text-orange-400">Pool not found.</div>
        ) : (
          <SongList
            poolId={id}
            pool={pool}
            editMode={editMode}
            onToggleEditMode={() => setEditMode((v) => !v)}
          />
        )}
      </div>
    </>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DialogHost />
      <Router>
        <div className="min-h-screen pixel-bg font-sans">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<PoolOverview />} />
              <Route path="/pool/:id" element={<PoolSongListPage />} />
              {/* SongInfo and RankNewMaps both bring their own topbar
                  (with breadcrumb + back link) and page container, so
                  they skip SubPageShell. */}
              <Route path="/song/:id" element={<SongInfo />} />
              <Route path="/pool/:poolId/rank-new" element={<RankNewMaps />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />
              <Route path="/account" element={<AccountSettingsPage />} />
              <Route path="/compare" element={<ComparePoolsPage />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </Router>
    </AuthProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

export default App;
