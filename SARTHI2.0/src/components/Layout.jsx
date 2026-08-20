import { LogOut, RotateCcw, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { resetDemo, backendMode } from "../lib/db";
import { useSarthiState } from "../lib/useSarthi";
import { subscribeToPush } from "../lib/push";
import LiveActivity from "./LiveActivity";

const ROLE_LABEL = {
  phc: "PHC Doctor",
  hospital: "Hospital",
  ambulance: "Ambulance",
  admin: "District Admin",
};

const ROLE_COLOR = {
  phc: "bg-mint-500",
  hospital: "bg-teal-900",
  ambulance: "bg-coral-500",
  admin: "bg-amber-500",
};

export default function Layout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const state = useSarthiState();
  const [dark, setDark] = useState(() => localStorage.getItem("sarthi_theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("sarthi_theme", dark ? "dark" : "light");
  }, [dark]);

  // Real cross-device push (production mode only) — fires even when this
  // tab isn't open. Silently does nothing in demo mode or if the person
  // hasn't set up a VAPID key yet (see .env.example).
  useEffect(() => {
    if (backendMode === "production" && user) subscribeToPush(user.id);
  }, [user]);

  return (
    <div className="min-h-dvh bg-canvas pb-10">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-900 flex items-center justify-center shrink-0">
              <svg width="19" height="19" viewBox="0 0 64 64"><path d="M17 40 L26 27 L33 35 L47 18" stroke="#FF6B4A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="47" cy="18" r="5" fill="#F2A93B"/><circle cx="17" cy="40" r="3.5" fill="white"/></svg>
            </div>
            <div className="leading-tight">
              <p className="font-display font-extrabold text-[15px] tracking-tight">SARTHI</p>
              <p className="text-[11px] text-ink/45 -mt-0.5 hidden sm:block">Emergency referral coordination</p>
            </div>
            <span className={`chip ml-1 ${backendMode === "production" ? "bg-mint-100 text-mint-600" : "bg-amber-100 text-amber-600"}`}>
              {backendMode === "production" ? "Live" : "Demo"}
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-semibold">{user.name}</span>
                <span className="text-[11px] text-ink/45">{user.entityLabel}</span>
              </div>
              <span className={`chip text-white ${ROLE_COLOR[user.role]}`}>{ROLE_LABEL[user.role]}</span>
              <button onClick={() => setDark((value) => !value)} title="Toggle dark mode" className="btn-ghost !px-2">
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {backendMode === "demo" && (
                <button
                  onClick={() => {
                    if (confirm("Reset all demo data? This clears every referral and resets hospital resources.")) resetDemo();
                  }}
                  title="Reset demo data"
                  className="btn-ghost !px-2"
                >
                  <RotateCcw size={16} />
                </button>
              )}
              <button onClick={logout} title="Log out" className="btn-ghost !px-2">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        {title && (
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-ink/50 mt-0.5">{subtitle}</p>}
          </div>
        )}
        {user && <LiveActivity state={state} user={user} />}
        {children}
      </main>
    </div>
  );
}
