// AccountMenu.tsx — account state, shown in every page's topbar:
// "LOG IN" when signed out, or the user's username + a link to manage
// saved API keys + log out when signed in.
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";

const AccountMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login" className="pixel-tab nav">
        LOG IN
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Link to="/api-keys" className="pixel-tab nav">
        API KEYS
      </Link>
      <Link to="/account" className="pixel-tab nav">
        {user.username}
      </Link>
      <button
        className="pixel-tab"
        onClick={async () => {
          await logout();
          navigate("/");
        }}
      >
        LOG OUT
      </button>
    </div>
  );
};

export default AccountMenu;
