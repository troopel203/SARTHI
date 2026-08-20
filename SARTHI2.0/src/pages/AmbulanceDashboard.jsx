import Layout from "../components/Layout";
import MapView from "../components/MapView";
import GoldenHourRing from "../components/GoldenHourRing";
import { PriorityChip } from "../components/StatusBadge";
import { useAuth } from "../lib/AuthContext";
import { useSarthiState, useRoleNotifications } from "../lib/useSarthi";
import { markArrived, completeReferral } from "../lib/db";
import { CheckCircle2, Navigation, PhoneCall, Siren } from "lucide-react";
import { roadDistanceKm } from "../lib/geo";

export default function AmbulanceDashboard() {
  const { user } = useAuth();
  const state = useSarthiState();
  useRoleNotifications(state, user);

  const ambulance = state.ambulances.find((a) => a.id === user.entityId);
  const referral = state.referrals.find((r) => r.id === ambulance.referralId);
  const phc = state.phcs.find((p) => p.id === ambulance.phcId);
  const hospital = referral ? state.hospitals.find((h) => h.id === referral.hospitalId) : null;
  const totalDistanceKm = referral && phc && hospital ? roadDistanceKm(phc, hospital) : 0;
  const remainingDistanceKm = totalDistanceKm * (1 - (referral?.progress || 0));
  const remainingMinutes = Math.max(0, Math.ceil((referral?.etaMinutesAtDispatch || 0) * (1 - (referral?.progress || 0))));

  return (
    <Layout title={`Ambulance ${ambulance.code}`} subtitle={`Driver: ${ambulance.driver} · Base: ${phc?.name}`}>
      {!referral ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-mint-100 text-mint-600 flex items-center justify-center mx-auto mb-4">
            <Siren size={24} />
          </div>
          <p className="font-semibold">Available — awaiting dispatch</p>
          <p className="text-sm text-ink/45 mt-1 max-w-sm mx-auto">
            You'll be notified the instant a PHC referral is confirmed and assigned to this vehicle.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <GoldenHourRing createdAt={referral.createdAt} resolved={referral.status === "completed" ? referral.updatedAt : null} />
                <div>
                  <p className="font-semibold text-sm">{referral.patientName}, {referral.age}</p>
                  <PriorityChip priority={referral.priority} />
                </div>
              </div>
              <p className="text-sm text-ink/60">{referral.condition}</p>
              {referral.notes && <p className="text-xs text-ink/50 mt-2 italic">"{referral.notes}"</p>}

              <div className="mt-4 pt-4 border-t border-line space-y-2 text-sm">
                <Row label="Pickup" value={phc?.name} />
                <Row label="Destination" value={hospital?.name} />
                <Row label="Assigned vehicle" value={`${ambulance.code} · ${ambulance.driver}`} />
                <Row label="Live travel" value={referral.status === "arrived" ? "At destination" : `~${remainingMinutes} min · ${remainingDistanceKm.toFixed(1)} km left`} />
                <Row label="Estimated speed" value="38 km/h (route estimate)" />
                <Row label="Status" value={referral.status === "arrived" ? "Arrived — hand over patient" : `${Math.round(referral.progress * 100)}% en route`} />
              </div>

              <div className="flex gap-2 mt-4">
                <a href={`tel:${hospital?.phone}`} className="btn-outline flex-1"><PhoneCall size={14} /> Call hospital</a>
                <a href={`https://www.openstreetmap.org/directions?to=${hospital?.lat},${hospital?.lng}`} target="_blank" rel="noreferrer" className="btn-outline flex-1"><Navigation size={14} /> Navigate</a>
              </div>
            </div>

            {referral.status === "accepted" && (
              <button onClick={() => markArrived(referral.id)} className="btn-primary w-full">Mark arrived at hospital</button>
            )}
            {referral.status === "arrived" && (
              <button onClick={() => completeReferral(referral.id)} className="btn-coral w-full">
                <CheckCircle2 size={16} /> Confirm handover & close referral
              </button>
            )}
          </div>

          <div className="lg:col-span-3">
            <MapView
              height={420}
              phcs={phc ? [phc] : []}
              hospitals={hospital ? [hospital] : []}
              ambulances={[{ id: "live", code: ambulance.code, driver: ambulance.driver, ...referral.currentPos }]}
              plannedRoutes={phc && hospital ? [{ positions: [[phc.lat, phc.lng], [hospital.lat, hospital.lng]] }] : []}
              routes={hospital ? [{ positions: [[referral.currentPos.lat, referral.currentPos.lng], [hospital.lat, hospital.lng]] }] : []}
              routeLabel={phc && hospital ? `From ${phc.name} → To ${hospital.name}` : undefined}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/45">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
