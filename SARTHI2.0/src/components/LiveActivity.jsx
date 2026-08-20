import { Activity, Ambulance, ArrowRight, History } from "lucide-react";

function relevant(referral, user) {
  if (user.role === "admin") return true;
  if (user.role === "phc") return referral.phcId === user.entityId;
  if (user.role === "hospital") return referral.hospitalId === user.entityId || referral.rejectedHospitals?.includes(user.entityId);
  return referral.ambulanceId === user.entityId;
}

export default function LiveActivity({ state, user }) {
  const referrals = state.referrals.filter((referral) => relevant(referral, user)).slice(0, 5);

  return (
    <section className="card p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="label !mb-0 flex items-center gap-1.5"><Activity size={14} /> Live tracking & recent history</p>
        <span className="text-xs text-ink/45 flex items-center gap-1"><History size={12} /> Stored on this device</span>
      </div>
      {referrals.length === 0 ? (
        <p className="text-sm text-ink/50">No referrals to track yet.</p>
      ) : (
        <div className="space-y-2">
          {referrals.map((referral) => {
            const phc = state.phcs.find((item) => item.id === referral.phcId);
            const hospital = state.hospitals.find((item) => item.id === referral.hospitalId);
            const ambulance = state.ambulances.find((item) => item.id === referral.ambulanceId);
            const referrer = state.users.find((item) => item.role === "phc" && item.entityId === referral.phcId);
            return (
              <div key={referral.id} className="rounded-xl border border-line px-3 py-2.5 text-xs sm:text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b>{referral.patientName}</b>
                  <span className="text-ink/50">Referred by {referrer?.name || phc?.name}</span>
                  <span className="chip bg-teal-100 text-teal-700">{referral.status.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-ink/55">
                  <span>{phc?.name || "PHC"}</span><ArrowRight size={12} /><span>{hospital?.name || "Awaiting a hospital"}</span>
                  {ambulance && <span className="ml-2 flex items-center gap-1"><Ambulance size={13} className="text-coral-500" /> {ambulance.code} · {ambulance.driver}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
