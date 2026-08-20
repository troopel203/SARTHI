import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { getState, backendMode } from "../lib/db";
import { Stethoscope, Building2, Truck, LayoutDashboard, ArrowRight, Eye } from "lucide-react";
import AuthPanel from "../components/AuthPanel";

const ROLES = [
  {
    key: "phc", label: "PHC Doctor", desc: "Create & track referrals", icon: Stethoscope, color: "mint",
    preview: ["Log a new patient referral in under a minute", "See the matched hospital and exactly why it was picked", "Watch each referral's live status and golden-hour timer"],
  },
  {
    key: "hospital", label: "Hospital", desc: "Accept referrals, manage beds", icon: Building2, color: "teal",
    preview: ["Incoming referrals with a response countdown", "One-tap accept/reject with auto-escalation on timeout", "Live bed, ICU, blood & oxygen counters you control"],
  },
  {
    key: "ambulance", label: "Ambulance", desc: "Live transit & handover", icon: Truck, color: "coral",
    preview: ["See the assigned patient, pickup & destination", "Live map with route and progress toward the hospital", "Mark arrival and confirm handover in two taps"],
  },
  {
    key: "admin", label: "District Admin", desc: "Network-wide oversight", icon: LayoutDashboard, color: "amber",
    preview: ["Live map of every hospital, PHC and ambulance", "Network KPIs — active cases, escalations, avg. dispatch time", "Full referral log and hospital resource table"],
  },
];

const COLOR_CLS = {
  mint: { ring: "ring-mint-500", bg: "bg-mint-100", text: "text-mint-600" },
  teal: { ring: "ring-teal-500", bg: "bg-teal-100", text: "text-teal-700" },
  coral: { ring: "ring-coral-500", bg: "bg-coral-100", text: "text-coral-600" },
  amber: { ring: "ring-amber-500", bg: "bg-amber-100", text: "text-amber-600" },
};

const ROLE_ROUTE = { phc: "/phc", hospital: "/hospital", ambulance: "/ambulance", admin: "/admin" };

export default function Login() {
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState("");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const users = getState().users.filter((u) => u.role === role);

  // Already signed in (e.g. the user hit the browser Back button from their
  // dashboard) — send them straight back in instead of showing a blank login.
  useEffect(() => {
    if (user) navigate(ROLE_ROUTE[user.role], { replace: true });
  }, [user, navigate]);

  function handleEnter() {
    if (!userId) return;
    login(userId);
    navigate(ROLE_ROUTE[role]);
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 pt-10 pb-16">
        {/* Hero */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-teal-900 flex items-center justify-center">
            <svg width="21" height="21" viewBox="0 0 64 64"><path d="M17 40 L26 27 L33 35 L47 18" stroke="#FF6B4A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="47" cy="18" r="5" fill="#F2A93B"/><circle cx="17" cy="40" r="3.5" fill="white"/></svg>
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight">SARTHI</span>
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-start">
          <div className="md:col-span-3">
            <p className="chip bg-coral-100 text-coral-600 mb-4">PS-B01 · Golden Hour Coordination</p>
            <h1 className="text-3xl sm:text-[2.6rem] leading-[1.08] font-extrabold tracking-tight text-ink">
              Every referral confirmed<br />before the ambulance <span className="text-coral-500">leaves.</span>
            </h1>
            <p className="mt-4 text-ink/60 text-[15px] leading-relaxed max-w-md">
              SARTHI checks live beds, specialists, blood and oxygen at the destination hospital first — so no
              patient is transferred on a guess. Pick a role below to open its live dashboard.
            </p>

            <div className="mt-8 flex items-center gap-3 text-xs text-ink/45">
              <span className="w-2 h-2 rounded-full bg-mint-500 animate-pulse" />
              {backendMode === "production"
                ? "Connected to live Supabase backend — real accounts, real cross-device sync"
                : "Realtime demo running locally — every dashboard updates instantly across tabs"}
            </div>
          </div>

          {/* Golden hour mini flow — signature element echo */}
          <div className="md:col-span-2 card p-5">
            <p className="label !mb-3">Referral lifecycle</p>
            <ol className="space-y-3 text-sm">
              {[
                ["PHC creates referral", "bg-mint-500"],
                ["Engine matches eligible hospital", "bg-teal-700"],
                ["Hospital confirms & reserves bed", "bg-amber-500"],
                ["Ambulance dispatched, tracked live", "bg-coral-500"],
                ["Patient handed over on arrival", "bg-mint-500"],
              ].map(([step, c], i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${c}`}>{i + 1}</span>
                  <span className="text-ink/70">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Role selection */}
        <div className="mt-12">
          <p className="label !mb-3">Sign in as</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.key;
              const c = COLOR_CLS[r.color];
              return (
                <button
                  key={r.key}
                  onClick={() => { setRole(r.key); setUserId(""); }}
                  className={`card p-4 text-left transition ${active ? `ring-2 ${c.ring}` : "hover:border-teal-300"}`}
                >
                  <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.text} flex items-center justify-center mb-3`}>
                    <Icon size={18} />
                  </div>
                  <p className="font-semibold text-sm">{r.label}</p>
                  <p className="text-xs text-ink/45 mt-0.5">{r.desc}</p>
                </button>
              );
            })}
          </div>

          {role && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4 max-w-2xl animate-slideIn">
              <div className="card p-5">
                <p className="label !mb-3 flex items-center gap-1.5"><Eye size={13} /> What you'll see here</p>
                <ul className="space-y-2 text-sm text-ink/70">
                  {ROLES.find((r) => r.key === role).preview.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-teal-500 mt-1 text-[8px]">●</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {backendMode === "production" ? (
                <AuthPanel role={role} roleLabel={ROLES.find((r) => r.key === role).label} />
              ) : (
                <div className="card p-5 flex flex-col">
                  <label className="label">Choose your {ROLES.find((r) => r.key === role).label.toLowerCase()} account</label>
                  <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
                    <option value="">Select an account…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.entityLabel}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleEnter} disabled={!userId} className="btn-primary w-full mt-3 mt-auto">
                    Enter dashboard <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
