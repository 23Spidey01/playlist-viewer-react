import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import logo from "../assets/Logo.png";

const LoginPage: React.FC = () => {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from || "/";

  if (user) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter both a username and a password.");
      return;
    }

    setBusy(true);
    setError(null);

    if (mode === "register") {
      const result = await register(username.trim(), password);
      if (!result.ok) {
        setError(result.error || "Registration failed.");
        setBusy(false);
        return;
      }
    }

    const result = await login(username.trim(), password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error || "Login failed.");
      return;
    }

    navigate(redirectTo, { replace: true });
  };

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
        <div className="flex-1" />
        <Link to="/" className="pixel-tab" style={{ color: "#b7c0d6" }}>
          ◂ ALL POOLS
        </Link>
      </div>

      <div className="w-full max-w-screen-2xl mx-auto px-6 py-10 flex justify-center">
        <form
          onSubmit={handleSubmit}
          className="pixel-card pixel-card-static pixel-page-flyin"
          style={{
            maxWidth: 360,
            width: "100%",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div className="pixel-font text-[14px] text-cyan-300">
            {mode === "login" ? "LOG IN" : "CREATE ACCOUNT"}
          </div>

          <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
            USERNAME
            <input
              className="pixel-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[#b7c0d6]">
            PASSWORD
            <input
              className="pixel-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div className="text-xs text-red-400">{error}</div>}

          <button type="submit" className="pixel-btn" disabled={busy}>
            {busy ? "..." : mode === "login" ? "LOG IN" : "REGISTER"}
          </button>

          <button
            type="button"
            className="pixel-tab"
            style={{ color: "#6a7690" }}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </>
  );
};

export default LoginPage;
