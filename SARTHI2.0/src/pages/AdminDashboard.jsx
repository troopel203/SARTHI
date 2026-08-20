import { useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import Layout from "../components/Layout";
import MapView from "../components/MapView";
import StatusBadge, { PriorityChip } from "../components/StatusBadge";
import GoldenHourRing from "../components/GoldenHourRing";
import { useAuth } from "../lib/AuthContext";
import { useSarthiState, useRoleNotifications } from "../lib/useSarthi";
import { Activity, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function AdminDashboard() {
  const { user } = useAuth();
  const state = useSarthiState();
  useRoleNotifications(state, user);
  const [tab, setTab] = useState("overview");

  const referrals = state.referrals;
  const active = referrals.filter((r) => ["awaiting_hospital", "accepted"].includes(r.status));
  const completed = referrals.filter((r) => r.status === "completed");
  const escalated = referrals.filter((r) => r.timeline.some((t) => t.event.includes("escalated")));

  const avgResponseMin = useMemo(() => {
    const withDispatch = referrals.filter((r) => r.dispatchedAt);
    if (!withDispatch.length) return null;
    const total = withDispatch.reduce((sum, r) => sum + (r.dispatchedAt - r.createdAt), 0);
    return Math.round(total / withDispatch.length / 60000);
  }, [referrals]);

  const enRoute = referrals.filter((r) => r.status === "accepted");

  const liveAmbulances = enRoute.map((r) => {
    const amb = state.ambulances.find((a) => a.id === r.ambulanceId);
    return { id: r.id, code: amb?.code, driver: amb?.driver, ...r.currentPos };
  });

  const routes = enRoute
    .map((r) => {
      const h = state.hospitals.find((x) => x.id === r.hospitalId);
      return h ? { positions: [[r.currentPos.lat, r.currentPos.lng], [h.lat, h.lng]] } : null;
    })
    .filter(Boolean);

  const plannedRoutes = enRoute
    .map((r) => {
      const h = state.hospitals.find((x) => x.id === r.hospitalId);
      const phc = state.phcs.find((p) => p.id === r.phcId);
      return h && phc ? { positions: [[phc.lat, phc.lng], [h.lat, h.lng]] } : null;
    })
    .filter(Boolean);

  return (
    <Layout title="Pune District Health Network" subtitle="Real-time referral oversight">
      <div className="flex gap-2 mb-5 border-b border-line overflow-x-auto">
        {[["overview", "Overview"], ["referrals", `Referrals (${referrals.length})`], ["hospitals", "Hospitals"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition ${tab === k ? "border-teal-900 text-teal-900" : "border-transparent text-ink/40 hover:text-ink/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi icon={Activity} label="Active referrals" value={active.length} color="teal" />
            <Kpi icon={CheckCircle2} label="Completed" value={completed.length} color="mint" />
            <Kpi icon={Clock} label="Avg. dispatch time" value={avgResponseMin !== null ? `${avgResponseMin} min` : "—"} color="amber" />
            <Kpi icon={AlertTriangle} label="Escalations" value={escalated.length} color="coral" />
          </div>

          <MapView height={380} hospitals={state.hospitals} phcs={state.phcs} ambulances={liveAmbulances} routes={routes} plannedRoutes={plannedRoutes} showLabels={false} />

          <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-5">
              <p className="label !mb-4">Referrals by status</p>
              <div className="h-56">
                <Doughnut
                  data={{
                    labels: ["Awaiting hospital", "En route", "Arrived", "Completed", "No hospital found"],
                    datasets: [{
                      data: ["awaiting_hospital", "accepted", "arrived", "completed", "no_hospital_found"].map(
                        (s) => referrals.filter((r) => r.status === s).length
                      ),
                      backgroundColor: ["#F2A93B", "#1B8A9E", "#22B573", "#0B5566", "#FF6B4A"],
                      borderWidth: 0,
                    }],
                  }}
                  options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } } }}
                />
              </div>
            </div>
            <div className="card p-5">
              <p className="label !mb-4">Hospital resource load (units available)</p>
              <div className="h-56">
                <Bar
                  data={{
                    labels: state.hospitals.map((h) => h.name.split(" ").slice(0, 2).join(" ")),
                    datasets: [
                      { label: "ICU", data: state.hospitals.map((h) => h.resources.icuBed), backgroundColor: "#FF6B4A" },
                      { label: "General beds", data: state.hospitals.map((h) => h.resources.generalBed), backgroundColor: "#1B8A9E" },
                    ],
                  }}
                  options={{ scales: { x: { ticks: { font: { size: 9 } } } }, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } } }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "referrals" && (
        <div className="space-y-2">
          {referrals.length === 0 && <div className="card p-8 text-center text-sm text-ink/45">No referrals created yet across the network.</div>}
          {referrals.map((r) => {
            const hospital = state.hospitals.find((h) => h.id === r.hospitalId);
            const phc = state.phcs.find((p) => p.id === r.phcId);
            const resolved = ["completed", "arrived"].includes(r.status) ? r.updatedAt : null;
            return (
              <div key={r.id} className="card p-4 flex flex-wrap items-center gap-3">
                <GoldenHourRing createdAt={r.createdAt} resolved={resolved} />
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{r.patientName}</p>
                    <PriorityChip priority={r.priority} />
                  </div>
                  <p className="text-xs text-ink/45">{phc?.name} → {hospital?.name || "—"}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            );
          })}
        </div>
      )}

      {tab === "hospitals" && (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40 border-b border-line">
                <th className="px-4 py-3">Hospital</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">ICU</th>
                <th className="px-4 py-3">General</th>
                <th className="px-4 py-3">Oxygen</th>
                <th className="px-4 py-3">Blood O+</th>
              </tr>
            </thead>
            <tbody>
              {state.hospitals.map((h) => (
                <tr key={h.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{h.name}</td>
                  <td className="px-4 py-3 text-ink/55">{h.tier}</td>
                  <td className="px-4 py-3"><Cell v={h.resources.icuBed} /></td>
                  <td className="px-4 py-3"><Cell v={h.resources.generalBed} /></td>
                  <td className="px-4 py-3"><Cell v={h.resources.oxygen} /></td>
                  <td className="px-4 py-3"><Cell v={h.resources.bloodOPos} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

function Cell({ v }) {
  return <span className={`font-semibold ${v === 0 ? "text-coral-500" : v <= 2 ? "text-amber-600" : "text-mint-600"}`}>{v}</span>;
}

const KPI_COLOR = {
  teal: "bg-teal-100 text-teal-700",
  mint: "bg-mint-100 text-mint-600",
  amber: "bg-amber-100 text-amber-600",
  coral: "bg-coral-100 text-coral-600",
};

function Kpi({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${KPI_COLOR[color]}`}>
        <Icon size={16} />
      </div>
      <p className="text-xl font-extrabold font-display">{value}</p>
      <p className="text-xs text-ink/45 mt-0.5">{label}</p>
    </div>
  );
}
