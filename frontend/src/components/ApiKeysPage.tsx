import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth";
import { listApiKeys, createApiKey, updateApiKey, deleteApiKey, type ApiKeySummary } from "./authApi";
import { alertDialog, confirmDialog } from "./dialogStore";
import AccountMenu from "./AccountMenu";
import logo from "../assets/Logo.png";

interface PoolOption {
  id: string;
  title: string;
}

const ApiKeysPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState<PoolOption[]>([]);
  const [pool, setPool] = useState("");
  const [manualPool, setManualPool] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    listApiKeys().then((data) => {
      setKeys(data);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    fetch("http://localhost:3001/proxy/map_pools_detailed")
      .then((res) => res.json())
      .then((data) =>
        setPools(data.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title }))),
      )
      .catch(() => setPools([]));
  }, []);

  const refresh = async () => setKeys(await listApiKeys());

  const startEdit = (k: ApiKeySummary) => {
    setEditingId(k.id);
    setPool(k.pool);
    setManualPool(!pools.some((p) => p.id === k.pool));
    setApiKey("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPool("");
    setManualPool(false);
    setApiKey("");
  };

  const handleSave = async () => {
    if (!pool.trim() || !apiKey.trim()) {
      await alertDialog("Enter both a pool and an API key.");
      return;
    }

    setBusy(true);
    const result = editingId
      ? await updateApiKey(editingId, pool.trim(), apiKey.trim())
      : await createApiKey(pool.trim(), apiKey.trim());
    setBusy(false);

    if (!result.ok) {
      await alertDialog(result.error || "Could not save the API key.");
      return;
    }

    cancelEdit();
    refresh();
  };

  const handleDelete = async (k: ApiKeySummary) => {
    const poolLabel = pools.find((p) => p.id === k.pool)?.title || k.pool;
    const ok = await confirmDialog(`Delete the saved key for "${poolLabel}"?`, {
      danger: true,
      okLabel: "Delete",
    });
    if (!ok) return;

    if (await deleteApiKey(k.id)) refresh();
    else await alertDialog("Could not delete the API key.");
  };

  if (authLoading) return null;

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
          / <span className="text-[#b7c0d6]">API KEYS</span>
        </span>
        <div className="flex-1" />
        <Link to="/" className="pixel-tab" style={{ color: "#b7c0d6" }}>
          ◂ ALL POOLS
        </Link>
        <AccountMenu />
      </div>

      <div className="w-full max-w-screen-2xl mx-auto px-6 py-8">
        {!user ? (
          <div className="pixel-card pixel-card-static pixel-page-flyin" style={{ padding: 24, maxWidth: 420 }}>
            <div className="text-sm text-[#b7c0d6] mb-3">
              You need to be logged in to save API keys.
            </div>
            <Link to="/login" state={{ from: "/api-keys" }} className="pixel-btn inline-block">
              LOG IN
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2.5 pb-3.5">
              <span className="pixel-section-label">SAVED API KEYS</span>
              <span className="text-xs text-neutral-500">{keys.length} saved</span>
            </div>

            <div
              className="pixel-card pixel-card-static pixel-page-flyin"
              style={{
                padding: 20,
                maxWidth: 480,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div className="pixel-font text-[11px] text-cyan-300">
                {editingId ? "EDIT KEY" : "ADD A KEY"}
              </div>

              <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                POOL
                {manualPool ? (
                  <input
                    className="pixel-input"
                    value={pool}
                    onChange={(e) => setPool(e.target.value)}
                    placeholder="Pool id"
                    autoFocus
                  />
                ) : (
                  <select
                    className="pixel-select"
                    value={pool}
                    onChange={(e) => {
                      if (e.target.value === "__manual__") {
                        setManualPool(true);
                        setPool("");
                      } else {
                        setPool(e.target.value);
                      }
                    }}
                  >
                    <option value="" disabled>
                      Select a pool…
                    </option>
                    {[...pools]
                      .sort((a, b) => a.title.localeCompare(b.title))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    <option value="__manual__">Enter pool id manually…</option>
                  </select>
                )}
                {manualPool && (
                  <button
                    type="button"
                    className="pixel-tab self-start"
                    style={{ color: "#6a7690" }}
                    onClick={() => {
                      setManualPool(false);
                      setPool("");
                    }}
                  >
                    ← choose from list instead
                  </button>
                )}
              </label>

              <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                API KEY
                <input
                  className="pixel-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editingId ? "Enter a new key to replace it" : "API key"}
                />
              </label>

              <div className="flex gap-2">
                <button className="pixel-btn" onClick={handleSave} disabled={busy}>
                  {busy ? "..." : editingId ? "SAVE CHANGES" : "ADD KEY"}
                </button>
                {editingId && (
                  <button className="pixel-tab" onClick={cancelEdit}>
                    CANCEL
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-xs text-neutral-500">Loading...</div>
            ) : keys.length === 0 ? (
              <div className="pixel-font text-[11px] text-orange-400">No saved keys yet.</div>
            ) : (
              <div className="flex flex-col gap-2" style={{ maxWidth: 480 }}>
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="pixel-card"
                    style={{
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div className="text-sm text-[#eafcff]">
                        {pools.find((p) => p.id === k.pool)?.title || k.pool}
                      </div>
                      <div className="text-xs text-[#6a7690]">{k.pool}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="pixel-tab" onClick={() => startEdit(k)}>
                        EDIT
                      </button>
                      <button
                        className="pixel-tab"
                        style={{ color: "#ff6b6b" }}
                        onClick={() => handleDelete(k)}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ApiKeysPage;
