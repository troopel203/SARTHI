import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import { Navigation2 } from "lucide-react";

function dotIcon(color, size = 16, pulse = false) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse ? `<div style="position:absolute;inset:-8px;border-radius:9999px;background:${color};opacity:0.35;animation:pulseRing 1.8s infinite;"></div>` : ""}
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const HOSPITAL_ICON = dotIcon("#0B5566", 18);
const PHC_ICON = dotIcon("#188F5C", 14);
const AMBULANCE_ICON = dotIcon("#FF6B4A", 16, true);

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 11);
    }
  }, [JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapView({
  hospitals = [],
  phcs = [],
  ambulances = [],
  routes = [],
  plannedRoutes = [], // full origin→destination path, drawn solid & faint under the live dashed route
  routeLabel, // e.g. "Mulshi PHC → Bharati Sahyadri District Hospital" — shown as an overlay banner
  showLabels = true,
  height = 380,
  fitAll = true,
  center = [18.55, 73.9],
  zoom = 9,
}) {
  const allPoints = [
    ...hospitals.map((h) => [h.lat, h.lng]),
    ...phcs.map((p) => [p.lat, p.lng]),
    ...ambulances.map((a) => [a.lat, a.lng]),
  ];

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-line relative z-0">
      {routeLabel && (
        <div className="absolute top-3 left-3 right-3 z-[1000] flex justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur rounded-full px-3.5 py-1.5 shadow-pop border border-line flex items-center gap-1.5 text-xs font-semibold text-ink/80 max-w-full">
            <Navigation2 size={12} className="text-coral-500 shrink-0" />
            <span className="truncate">{routeLabel}</span>
          </div>
        </div>
      )}
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fitAll && <FitBounds points={allPoints} />}

        {plannedRoutes.map((r, i) => (
          <Polyline key={`plan-${i}`} positions={r.positions} pathOptions={{ color: "#0B5566", weight: 2, opacity: 0.3 }} />
        ))}

        {routes.map((r, i) => (
          <Polyline key={i} positions={r.positions} pathOptions={{ color: "#FF6B4A", weight: 3.5, dashArray: "1 8", lineCap: "round", opacity: 0.9 }} />
        ))}

        {phcs.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={PHC_ICON}>
            {showLabels && <Tooltip permanent direction="top" offset={[0, -10]} className="!bg-mint-600 !text-white !border-0 !text-[10px] !font-semibold !px-2 !py-0.5 !rounded-full">{p.name}</Tooltip>}
            <Popup>
              <strong>{p.name}</strong>
              <br />
              PHC · {p.address}
            </Popup>
          </Marker>
        ))}

        {hospitals.map((h) => (
          <Marker key={h.id} position={[h.lat, h.lng]} icon={HOSPITAL_ICON}>
            {showLabels && <Tooltip permanent direction="top" offset={[0, -12]} className="!bg-teal-900 !text-white !border-0 !text-[10px] !font-semibold !px-2 !py-0.5 !rounded-full">{h.name}</Tooltip>}
            <Popup>
              <strong>{h.name}</strong>
              <br />
              {h.tier}
              <br />
              ICU beds: {h.resources.icuBed} · General beds: {h.resources.generalBed}
            </Popup>
          </Marker>
        ))}

        {ambulances.map((a) => (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={AMBULANCE_ICON}>
            {showLabels && a.code && <Tooltip permanent direction="bottom" offset={[0, 10]} className="!bg-coral-500 !text-white !border-0 !text-[10px] !font-semibold !px-2 !py-0.5 !rounded-full">{a.code}</Tooltip>}
            <Popup>
              <strong>{a.code || "Ambulance"}</strong>
              <br />
              {a.driver}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
