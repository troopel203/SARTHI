import { useState } from "react";
import Layout from "../components/Layout";
import GoldenHourRing from "../components/GoldenHourRing";
import StatusBadge, { PriorityChip } from "../components/StatusBadge";
import MapView from "../components/MapView";
import { useAuth } from "../lib/AuthContext";
import { useSarthiState, useRoleNotifications } from "../lib/useSarthi";
import { respondToReferral, updateHospitalResources, simulateResourceLoss } from "../lib/db";
import { RESOURCE_TYPES } from "../data/seed";
import { Check, X, Minus, Plus, AlertOctagon, Timer } from "lucide-react";

export default function HospitalDashboard() {
  const { user } = useAuth();
  const state = useSarthiState();
  useRoleNotifications(state, user);
  const [tab, setTab] = useState("incoming");

  const hospital = state.hospitals.find((h) => h.id === user.entityId);
  const incoming = state.referrals.filter((r) => r.hospitalId === user.entityId && r.status === "awaiting_hospital");
  const active = state.referrals.filter((r) => r.hospitalId === user.entityId && ["accepted"].includes(r.status));
  const history = state.referrals.filter(
    (r) => (r.hospitalId === user.entityId || r.rejectedHospitals?.includes(user.entityId)) && !incoming.includes(r) && !active.includes(r)
  );

  return (
    <Layout title={hospital.name} subtitle={`${hospital.tier} · ${hospital.address}`}>
      <div className="flex gap-2 mb-5 border-b border-line overflow-x-auto">
        {[
          ["incoming", `Incoming (${incoming.length})`],
          ["active", `En Route (${active.length})`],
          ["resources", "Resources"],
          ["history", `History (${history.length})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${tab === k ? "border-teal-900 text-teal-900" : "border-transparent text-ink/40 hover:text-ink/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "incoming" && (
        <div className="space-y-3">
          {incoming.length === 0 && <div className="card p-8 text-center text-sm text-ink/45">No incoming referral requests right now.</div>}
          {incoming.map((r) => <IncomingCard key={r.id} referral={r} state={state} />)}
        </div>
      )}

      {tab === "active" && (
        <div className="space-y-3">
          {active.length === 0 && <div className="card p-8 text-center text-sm text-ink/45">No ambulances en route to your facility.</div>}
          {active.map((r) => <ActiveCard key={r.id} referral={r} hospital={hospital} phcs={state.phcs} ambulances={state.ambulances} />)}
        </div>
      )}

      {tab === "resources" && <ResourcesPanel hospital={hospital} />}

      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 && <div className="card p-8 text-center text-sm text-ink/45">No referral history yet.</div>}
          {history.map((r) => (
            <div key={r.id} className="card p-3.5 flex items-center gap-3">
              <GoldenHourRing createdAt={r.createdAt} resolved={r.updatedAt} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{r.patientName} · {r.condition}</p>
                <p className="text-xs text-ink/45">{new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

function IncomingCard({ referral, state }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const secondsLeft = Math.max(0, Math.round((referral.reservationExpiresAt - Date.now()) / 1000));

  return (
    <div className="card p-4 sm:p-5 border-l-4 border-l-coral-500">
      <div className="flex items-start gap-3">
        <GoldenHourRing createdAt={referral.createdAt} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-sm">{referral.patientName}, {referral.age} · {referral.gender}</p>
            <PriorityChip priority={referral.priority} />
          </div>
          <p className="text-xs text-ink/60 mt-0.5">{referral.condition}</p>
          <p className="text-xs text-ink/45 mt-1">
            Needs: <b className="text-ink/70">{RESOURCE_TYPES.find((r) => r.key === referral.requiredResource)?.label}</b>
            {referral.requiredSpecialist && <> · {referral.requiredSpecialist}</>}
          </p>
          {referral.notes && <p className="text-xs text-ink/50 mt-1 italic">"{referral.notes}"</p>}
        </div>
        <div className="chip bg-amber-100 text-amber-600 shrink-0"><Timer size={12} /> {secondsLeft}s</div>
      </div>

      {!rejecting ? (
        <div className="flex gap-2 mt-4">
          <button onClick={() => respondToReferral(referral.id, referral.hospitalId, true)} className="btn-primary flex-1">
            <Check size={16} /> Accept & reserve bed
          </button>
          <button onClick={() => setRejecting(true)} className="btn-outline flex-1">
            <X size={16} /> Can't accept
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <input className="input" placeholder="Reason (e.g. ICU just filled)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => respondToReferral(referral.id, referral.hospitalId, false, note)} className="btn-coral flex-1">Confirm reject & escalate</button>
            <button onClick={() => setRejecting(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveCard({ referral, hospital, phcs, ambulances }) {
  const phc = phcs.find((p) => p.id === referral.phcId);
  const ambulance = ambulances?.find((a) => a.id === referral.ambulanceId);
  const pct = Math.round(referral.progress * 100);
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-sm">{referral.patientName} · {referral.condition}</p>
          <p className="text-xs text-ink/45">Coming from {phc?.name}{ambulance ? ` · Ambulance ${ambulance.code}` : ""}</p>
        </div>
        <StatusBadge status={referral.status} />
      </div>
      <div className="w-full h-2 rounded-full bg-line overflow-hidden mb-1">
        <div className="h-full bg-coral-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-ink/45 mb-3">{pct}% of the way to your facility</p>
      <MapView
        height={240}
        phcs={phc ? [phc] : []}
        hospitals={[hospital]}
        ambulances={[{ id: "live", code: ambulance?.code, driver: ambulance?.driver, ...referral.currentPos }]}
        plannedRoutes={phc ? [{ positions: [[phc.lat, phc.lng], [hospital.lat, hospital.lng]] }] : []}
        routes={[{ positions: [[referral.currentPos.lat, referral.currentPos.lng], [hospital.lat, hospital.lng]] }]}
        routeLabel={phc ? `${phc.name} → ${hospital.name}` : undefined}
      />
      <button onClick={() => simulateResourceLoss(referral.id)} className="btn-outline w-full mt-3 !text-coral-600 !border-coral-200">
        <AlertOctagon size={14} /> Demo: report resource unavailable (trigger reroute)
      </button>
    </div>
  );
}

function ResourcesPanel({ hospital }) {
  return (
    <div className="card p-5">
      <p className="label !mb-4">Live resource availability</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {RESOURCE_TYPES.map((r) => (
          <div key={r.key} className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
            <span className="text-sm font-medium">{r.label}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateHospitalResources(hospital.id, { [r.key]: Math.max(0, hospital.resources[r.key] - 1) })}
                className="w-7 h-7 rounded-lg border border-line flex items-center justify-center hover:bg-canvas"
              ><Minus size={14} /></button>
              <span className={`w-6 text-center font-bold font-display ${hospital.resources[r.key] === 0 ? "text-coral-500" : "text-ink"}`}>{hospital.resources[r.key]}</span>
              <button
                onClick={() => updateHospitalResources(hospital.id, { [r.key]: hospital.resources[r.key] + 1 })}
                className="w-7 h-7 rounded-lg border border-line flex items-center justify-center hover:bg-canvas"
              ><Plus size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink/40 mt-4">Updates sync instantly to every PHC and the district dashboard — this is what the matching engine reads before recommending your facility.</p>
    </div>
  );
}
