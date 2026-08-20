import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { requestNotifyPermission } from "./lib/notify";
import { registerServiceWorker } from "./lib/push";

requestNotifyPermission();
registerServiceWorker(); // installable PWA shell + offline caching (also enables push once subscribed)

// Note: intentionally not wrapped in <StrictMode> — its dev-only double-invoke
// of effects breaks Leaflet's map init ("Map container is already initialized")
// when navigating back/forward between pages that render a map.
createRoot(document.getElementById("root")).render(<App />);
