import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { changeUsername, changeEmail, changePassword } from "./authApi";
import { alertDialog } from "./dialogStore";
import AccountMenu from "./AccountMenu";
import logo from "../assets/Logo.png";

type FormKind = "username" | "email" | "password";

const EMPTY: Record<FormKind, string> = { username: "", email: "", password: "" };

// Username/email/password changes each invalidate the current session
// server-side the instant they succeed (AccountController logs the
// session out on every successful call — see authApi.ts) — that's
// deliberate, not a bug to work around: it means an old session token
// can't outlive a password change made specifically because it might
// have leaked. Every form below reflects that locally too (force the
// cached user to null, redirect to /login) once a change succeeds,
// instead of leaving the topbar looking logged-in when the session
// underneath it is already dead.
const AccountSettingsPage: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState<Record<FormKind, string>>(EMPTY);
  const [newValue, setNewValue] = useState<Record<FormKind, string>>(EMPTY);
  const [busy, setBusy] = useState<FormKind | null>(null);

  const handleSubmit = async (kind: FormKind) => {
    const password = currentPassword[kind].trim();
    const value = newValue[kind].trim();
    if (!password || !value) {
      await alertDialog("Enter your current password and the new value.");
      return;
    }

    setBusy(kind);
    const result =
      kind === "username"
        ? await changeUsername(password, value)
        : kind === "email"
          ? await changeEmail(password, value)
          : await changePassword(password, value);
    setBusy(null);

    if (!result.ok) {
      await alertDialog(result.error || "That didn't work.");
      return;
    }

    await alertDialog(
      `Your ${kind} was changed. For security, you've been logged out — log back in to continue.`,
    );
    // The session is already dead server-side; this just makes the
    // frontend's own cached state (topbar, etc.) agree with that.
    await logout();
    navigate("/login");
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
          / <span className="text-[#b7c0d6]">ACCOUNT</span>
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
              You need to be logged in to change your account settings.
            </div>
            <Link to="/login" state={{ from: "/account" }} className="pixel-btn inline-block">
              LOG IN
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2.5 pb-3.5">
              <span className="pixel-section-label">ACCOUNT SETTINGS</span>
              <span className="text-xs text-neutral-500">logged in as {user.username}</span>
            </div>

            <div className="flex flex-col gap-4" style={{ maxWidth: 420 }}>
              <div
                className="pixel-card pixel-card-static pixel-page-flyin"
                style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="pixel-font text-[11px] text-cyan-300">CHANGE USERNAME</div>

                <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                  NEW USERNAME
                  <input
                    className="pixel-input"
                    value={newValue.username}
                    onChange={(e) => setNewValue((old) => ({ ...old, username: e.target.value }))}
                    autoComplete="username"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                  CURRENT PASSWORD
                  <input
                    className="pixel-input"
                    type="password"
                    value={currentPassword.username}
                    onChange={(e) =>
                      setCurrentPassword((old) => ({ ...old, username: e.target.value }))
                    }
                    autoComplete="current-password"
                  />
                </label>

                <button
                  className="pixel-btn self-start"
                  onClick={() => handleSubmit("username")}
                  disabled={busy === "username"}
                >
                  {busy === "username" ? "..." : "SAVE USERNAME"}
                </button>
              </div>

              <div
                className="pixel-card pixel-card-static pixel-page-flyin"
                style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="pixel-font text-[11px] text-cyan-300">CHANGE EMAIL</div>

                <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                  NEW EMAIL
                  <input
                    className="pixel-input"
                    type="email"
                    value={newValue.email}
                    onChange={(e) => setNewValue((old) => ({ ...old, email: e.target.value }))}
                    autoComplete="email"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                  CURRENT PASSWORD
                  <input
                    className="pixel-input"
                    type="password"
                    value={currentPassword.email}
                    onChange={(e) =>
                      setCurrentPassword((old) => ({ ...old, email: e.target.value }))
                    }
                    autoComplete="current-password"
                  />
                </label>

                <button
                  className="pixel-btn self-start"
                  onClick={() => handleSubmit("email")}
                  disabled={busy === "email"}
                >
                  {busy === "email" ? "..." : "SAVE EMAIL"}
                </button>
              </div>

              <div
                className="pixel-card pixel-card-static pixel-page-flyin"
                style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="pixel-font text-[11px] text-cyan-300">CHANGE PASSWORD</div>

                <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                  NEW PASSWORD
                  <input
                    className="pixel-input"
                    type="password"
                    value={newValue.password}
                    onChange={(e) => setNewValue((old) => ({ ...old, password: e.target.value }))}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
                  CURRENT PASSWORD
                  <input
                    className="pixel-input"
                    type="password"
                    value={currentPassword.password}
                    onChange={(e) =>
                      setCurrentPassword((old) => ({ ...old, password: e.target.value }))
                    }
                    autoComplete="current-password"
                  />
                </label>

                <button
                  className="pixel-btn self-start"
                  onClick={() => handleSubmit("password")}
                  disabled={busy === "password"}
                >
                  {busy === "password" ? "..." : "SAVE PASSWORD"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default AccountSettingsPage;
