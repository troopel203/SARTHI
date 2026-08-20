import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import GoldenHourRing from "../components/GoldenHourRing";
import StatusBadge, { PriorityChip } from "../components/StatusBadge";
import MapView from "../components/MapView";
import { useAuth } from "../lib/AuthContext";
import { useSarthiState, useRoleNotifications } from "../lib/useSarthi";
import { createReferral, reportConditionDeterioration } from "../lib/db";
import { queueReferral, subscribeQueue, initOfflineSync } from "../lib/offlineQueue";
import { toast } from "../lib/notify";
import { RESOURCE_TYPES, SPECIALISTS, CONDITIONS } from "../data/seed";
import { ChevronDown, PlusCircle, Sparkles, Truck, Navigation2, AlertTriangle, Loader2, WifiOff } from "lucide-react";

const emptyForm = {
  patientName: "", age: "", gender: "Female", condition: CONDITIONS[0],
  requiredResource: "icuBed", requiredSpecialist: "", priority: "high", notes: "",
};

export default function PHCDashboard() {
  const { user } = useAuth();
  const state = useSarthiState();
  useRoleNotifications(state, user);
  useEffect(() => { initOfflineSync(); }, []);
  const [tab, setTab] = useState("new");
  const [form, setForm] = useState(emptyForm);
  const [lastCreated, setLastCreated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [pendingQueue, setPendingQueue] = useState([]);

  useEffect(() => subscribeQueue(setPendingQueue), []);

  const myReferrals = state.referrals.filter((r) => r.phcId === user.entityId);
  const phc = state.phcs.find((p) => p.id === user.entityId);

  function submit(e) {
    e.preventDefault();
    if (!form.patientName || !form.age) return;
    setSubmitting(true);
    const payload = { ...form, age: Number(form.age), phcId: user.entityId };

    if (!navigator.onLine) {
      queueReferral(payload).then(() => {
        toast(`No connection — ${payload.patientName}'s referral is queued and will send automatically once you're back online.`, "warning");
        setForm(emptyForm);
        setSubmitting(false);
      });
      return;
    }

    Promise.resolve(createReferral(payload))
      .then((ref) => {
        setLastCreated(ref.id);
        setForm(emptyForm);
        setTab("mine");
      })
      .catch(() => {
        // Create failed even though we appear online (flaky rural signal) —
        // don't lose the referral, queue it for automatic retry instead.
        queueReferral(payload);
        setSubmitError("Connection issue — this referral has been queued and will sync automatically.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Layout title="PHC Referral Desk" subtitle={phc?.name}>
      <div className="flex gap-2 mb-5 border-b border-line">
        {[["new", "New Referral"], ["mine", `My Referrals (${myReferrals.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === k ? "border-teal-900 text-teal-900" : "border-transparent text-ink/40 hover:text-ink/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {pendingQueue.length > 0 && (
        <div className="card p-3.5 mb-4 flex items-center gap-3 border-amber-200 bg-amber-100/40">
          <WifiOff size={16} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            {pendingQueue.length} referral{pendingQueue.length > 1 ? "s" : ""} queued offline — will sync automatically the moment you're back online.
          </p>
        </div>
      )}

      {tab === "new" && (
        <div className="grid lg:grid-cols-5 gap-5">
          <form onSubmit={submit} className="card p-5 space-y-4 lg:col-span-3">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Patient name</label>
                <input required className="input" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Age</label>
                  <input required type="number" min="0" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option>Female</option><option>Male</option><option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Clinical condition</label>
              <select className="input" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Required resource</label>
                <select className="input" value={form.requiredResource} onChange={(e) => setForm({ ...form, requiredResource: e.target.value })}>
                  {RESOURCE_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Specialist needed (optional)</label>
                <select className="input" value={form.requiredSpecialist} onChange={(e) => setForm({ ...form, requiredSpecialist: e.target.value })}>
                  <option value="">No preference</option>
                  {SPECIALISTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Priority</label>
              <div className="flex gap-2">
                {["critical", "high", "medium", "low"].map((p) => (
                  <button type="button" key={p} onClick={() => setForm({ ...form, priority: p })}
                    className={`flex-1 rounded-xl border py-2 text-xs font-semibold capitalize transition ${form.priority === p ? "border-teal-900 bg-teal-900 text-white" : "border-line hover:border-teal-500"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes for receiving hospital (optional)</label>
              <textarea rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Vitals, ongoing treatment, transport constraints…" />
            </div>

            {submitError && <p className="text-xs text-coral-600 -mt-2">{submitError}</p>}
            <button disabled={submitting} className="btn-coral w-full">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              {submitting ? "Matching hospitals…" : "Create referral & match hospital"}
            </button>
          </form>

          <div className="lg:col-span-2 card p-5">
            <p className="label !mb-3 flex items-center gap-1.5"><Sparkles size={13} /> How matching works</p>
            <ol className="space-y-3 text-sm text-ink/70">
              <li><b className="text-ink">1. Hard filter.</b> Only hospitals with the required resource and specialist available right now are considered — never distance alone.</li>
              <li><b className="text-ink">2. Ranking.</b> Eligible hospitals are scored on travel time, resource headroom and specialist match, weighted by case priority.</li>
              <li><b className="text-ink">3. Reservation.</b> The top match's bed is held for 45s (demo timer) while it confirms — if it doesn't respond, the referral auto-escalates to the next hospital.</li>
            </ol>
          </div>
        </div>
      )}

      {tab === "mine" && (
        <div className="space-y-3">
          {myReferrals.length === 0 && (
            <div className="card p-8 text-center text-sm text-ink/45">No referrals yet — create one from the "New Referral" tab.</div>
          )}
          {myReferrals.map((r) => (
            <ReferralCard key={r.id} referral={r} hospitals={state.hospitals} phcs={state.phcs} ambulances={state.ambulances} highlighted={r.id === lastCreated} />
          ))}
        </div>
      )}
    </Layout>
  );
}

function ReferralCard({ referral, hospitals, phcs, ambulances, highlighted }) {
  const [open, setOpen] = useState(highlighted);
  const hospital = hospitals.find((h) => h.id === referral.hospitalId);
  const phc = phcs?.find((p) => p.id === referral.phcId);
  const ambulance = ambulances?.find((a) => a.id === referral.ambulanceId);
  const resolved = ["completed", "arrived"].includes(referral.status) ? referral.updatedAt : null;
  const assignedAndTravelling = ambulance && ["accepted", "arrived"].includes(referral.status);
  const progress = Math.round((referral.progress || 0) * 100);
  const remainingMinutes = Math.max(0, Math.ceil((referral.etaMinutesAtDispatch || 0) * (1 - (referral.progress || 0))));
  const mapHospitals = hospital
    ? [hospital]
    : referral.candidates.map((candidate) => hospitals.find((item) => item.id === candidate.hospitalId)).filter(Boolean);

  return (
    <div className={`card p-4 sm:p-5 ${highlighted ? "ring-2 ring-coral-500" : ""}`}>
      <div className="flex items-start gap-3">
        <GoldenHourRing createdAt={referral.createdAt} resolved={resolved} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-sm truncate">{referral.patientName}, {referral.age}</p>
            <PriorityChip priority={referral.priority} />
            <StatusBadge status={referral.status} />
          </div>
          <p className="text-xs text-ink/50 mt-0.5">{referral.condition}</p>
          <p className="text-xs text-ink/60 mt-1.5">
            {hospital
              ? <>Destination: <b className="text-ink">{hospital.name}</b></>
              : "No accepting hospital is currently assigned; previous matches are shown on the map below."}
          </p>
          {hospital && (
            <p className="text-xs text-ink/60 mt-1 flex items-center gap-1.5">
              <Truck size={12} className="text-coral-500" />
              {ambulance
                ? <><b className="text-ink">{ambulance.code}</b> driven by {ambulance.driver} is assigned to this trip.</>
                : "Ambulance will be assigned as soon as the hospital confirms."}
            </p>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="btn-ghost !px-2 shrink-0">
          <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-line grid md:grid-cols-2 gap-4">
          <div>
            <p className="label">Timeline</p>
            <ul className="space-y-2 text-xs">
              {referral.timeline.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ink/35 shrink-0 w-14">{new Date(t.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-ink/75">{t.event}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Hospital candidates ranked</p>
            {referral.aiExplanation && (
              <p className="text-xs bg-teal-100 text-teal-700 rounded-lg p-2.5 mb-2 leading-relaxed">
                <b>AI rationale:</b> {referral.aiExplanation}
              </p>
            )}
            <ul className="space-y-2">
              {referral.candidates.map((c, i) => {
                const h = hospitals.find((x) => x.id === c.hospitalId);
                const isCurrent = c.hospitalId === referral.hospitalId;
                return (
                  <li key={i} className={`rounded-lg border p-2.5 text-xs ${isCurrent ? "border-teal-500 bg-teal-100/50" : "border-line"}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{i + 1}. {h?.name}</span>
                      <span className="text-ink/45">{c.eta} min</span>
                    </div>
                    <p className="text-ink/50 mt-1">{c.reasons.join(" · ")}</p>
                  </li>
                );
              })}
            </ul>
          </div>
          {hospital && phc && (
            <div className="rounded-xl border border-line bg-canvas p-3 text-xs md:col-span-2">
              <p className="label !mb-2 flex items-center gap-1.5"><Navigation2 size={13} /> Transport tracking</p>
              {assignedAndTravelling ? (
                <div className="grid sm:grid-cols-3 gap-2 text-ink/65">
                  <span><b className="text-ink">Vehicle:</b> {ambulance.code}</span>
                  <span><b className="text-ink">Progress:</b> {progress}% en route</span>
                  <span><b className="text-ink">ETA:</b> {referral.status === "arrived" ? "Arrived" : `~${remainingMinutes} min remaining`}</span>
                </div>
              ) : (
                <p className="text-ink/60">Route is ready from {phc.name} to {hospital.name}. Waiting for hospital confirmation before dispatch.</p>
              )}
            </div>
          )}
          {hospital && !["completed", "arrived"].includes(referral.status) && (
            <button onClick={() => reportConditionDeterioration(referral.id)} className="btn-outline !py-2 text-xs md:col-span-2 !text-coral-600 !border-coral-100">
              <AlertTriangle size={14} /> Alert teams: patient condition deteriorated
            </button>
          )}
          {phc && mapHospitals.length > 0 && (
            <div className="md:col-span-2">
              <MapView
                height={240}
                phcs={[phc]}
                hospitals={mapHospitals}
                ambulances={assignedAndTravelling ? [{ id: "live", code: ambulance.code, driver: ambulance.driver, ...referral.currentPos }] : []}
                plannedRoutes={hospital ? [{ positions: [[phc.lat, phc.lng], [hospital.lat, hospital.lng]] }] : []}
                routes={assignedAndTravelling && hospital ? [{ positions: [[referral.currentPos.lat, referral.currentPos.lng], [hospital.lat, hospital.lng]] }] : []}
                routeLabel={hospital ? `${phc.name} → ${hospital.name}` : `${phc.name} → no current accepting hospital`}
                fitAll
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
