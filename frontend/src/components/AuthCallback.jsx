import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const session_id = params.get("session_id");
    if (!session_id) {
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id });
        setUser(data.user);
        // clear hash, redirect to dashboard or admin
        const dest = data.user.role === "admin" ? "/admin" : "/dashboard";
        window.history.replaceState(null, "", window.location.pathname);
        navigate(dest, { replace: true, state: { user: data.user } });
      } catch (e) {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="overline mb-2">Joy Automart</div>
        <div className="text-xl font-display">Authenticating…</div>
      </div>
    </div>
  );
};

export default AuthCallback;
