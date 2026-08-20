import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { LogIn, UserPlus, Loader2 } from "lucide-react";

const ENTITY_TABLE = { phc: "phcs", hospital: "hospitals", ambulance: "ambulances" };

export default function AuthPanel({ role, roleLabel }) {
  const { login, signUp, authError } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [busy, setBusy] = useState(false);
  const [entities, setEntities] = useState([]);
  const [form, setForm] = useState({ email: "", password: "", name: "", entityId: "" });

  useEffect(() => {
    setForm({ email: "", password: "", name: "", entityId: "" });
    if (role === "admin" || !ENTITY_TABLE[role]) return;
    supabase
      .from(ENTITY_TABLE[role])
      .select(role === "ambulance" ? "id,code" : "id,name")
      .then(({ data }) => setEntities(data || []));
  }, [role]);

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true);
    await login(form.email, form.password);
    setBusy(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setBusy(true);
    const entity = role === "admin" ? { entityId: "district-network", entityLabel: "District Health Society" } : entities.find((x) => x.id === form.entityId);
    await signUp({
      email: form.email,
      password: form.password,
      role,
      name: form.name,
      entityId: role === "admin" ? "district-network" : entity?.id,
      entityLabel: role === "admin" ? "District Health Society" : entity?.name || entity?.code,
    });
    setBusy(false);
  }

  return (
    <div className="card p-5 flex flex-col animate-slideIn">
      <div className="flex gap-1 mb-4 bg-canvas rounded-lg p-1">
        <button onClick={() => setMode("signin")} className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${mode === "signin" ? "bg-white shadow-sm text-teal-900" : "text-ink/45"}`}>Sign In</button>
        <button onClick={() => setMode("signup")} className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${mode === "signup" ? "bg-white shadow-sm text-teal-900" : "text-ink/45"}`}>Sign Up</button>
      </div>

      {mode === "signin" ? (
        <form onSubmit={handleSignIn} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input required type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {authError && <p className="text-xs text-coral-600">{authError}</p>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Sign in as {roleLabel}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {role !== "admin" && (
            <div>
              <label className="label">{roleLabel} facility / vehicle</label>
              <select required className="input" value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })}>
                <option value="">Select…</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name || e.code}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Password (min. 6 characters)</label>
            <input required minLength={6} type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {authError && <p className="text-xs text-coral-600">{authError}</p>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Create {roleLabel} account
          </button>
        </form>
      )}
    </div>
  );
}
