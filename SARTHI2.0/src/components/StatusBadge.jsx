const STATUS_MAP = {
  awaiting_hospital: { label: "Awaiting Hospital", cls: "bg-amber-100 text-amber-600" },
  accepted: { label: "Ambulance En Route", cls: "bg-teal-100 text-teal-700" },
  arrived: { label: "Arrived", cls: "bg-mint-100 text-mint-600" },
  completed: { label: "Completed", cls: "bg-ink/5 text-ink/60" },
  no_hospital_found: { label: "No Hospital Found", cls: "bg-coral-100 text-coral-600" },
};

export default function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, cls: "bg-ink/5 text-ink/60" };
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function PriorityChip({ priority }) {
  const map = {
    critical: "bg-coral-100 text-coral-600",
    high: "bg-amber-100 text-amber-600",
    medium: "bg-teal-100 text-teal-700",
    low: "bg-mint-100 text-mint-600",
  };
  const label = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }[priority] || priority;
  return <span className={`chip ${map[priority] || "bg-ink/5 text-ink/60"}`}>{label}</span>;
}
