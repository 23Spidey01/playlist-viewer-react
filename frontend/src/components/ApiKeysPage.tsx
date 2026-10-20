import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { listApiKeys, createApiKey, updateApiKey, deleteApiKey, type ApiKeySummary } from "./authApi";
import { alertDialog, confirmDialog } from "./dialogStore";
import AccountMenu from "./AccountMenu";
import { usePools } from "./usePools";
import logo from "../assets/Logo.png";

const ApiKeysPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { pools } = usePools();
  const queryClient = useQueryClient();

  const { data: keys = [], isLoading: loading } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: listApiKeys,
    enabled: Boolean(user),
  });
  const invalidateKeys = () => queryClient.invalidateQueries({ queryKey: ["apiKeys"] });

  const [pool, setPool] = useState("");
  const [manualPool, setManualPool] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? updateApiKey(editingId, pool.trim(), apiKey.trim())
        : createApiKey(pool.trim(), apiKey.trim()),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
  });
  const busy = saveMutation.isPending || deleteMutation.isPending;

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

    const result = await saveMutation.mutateAsync();

    if (!result.ok) {
      await alertDialog(result.error || "Could not save the API key.");
      return;
    }

    cancelEdit();
    invalidateKeys();
  };

  const handleDelete = async (k: ApiKeySummary) => {
    const poolLabel = pools.find((p) => p.id === k.pool)?.title || k.pool;
    const ok = await confirmDialog(`Delete the saved key for "${poolLabel}"?`, {
      danger: true,
      okLabel: "Delete",
    });
    if (!ok) return;

    const deleted = await deleteMutation.mutateAsync(k.id);
    if (deleted) invalidateKeys();
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
        <Link to="/" className="pixel-tab nav">
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
