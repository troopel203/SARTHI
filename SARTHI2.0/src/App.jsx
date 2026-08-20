import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ToastHost from "./components/ToastHost";
import Login from "./pages/Login";

// Lazy-loaded: each dashboard pulls in Leaflet and/or Chart.js, so splitting
// them keeps the initial load light — the login screen (what most visits
// hit first) ships without any map/chart code at all.
const PHCDashboard = lazy(() => import("./pages/PHCDashboard"));
const HospitalDashboard = lazy(() => import("./pages/HospitalDashboard"));
const AmbulanceDashboard = lazy(() => import("./pages/AmbulanceDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

function PageLoader() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-canvas">
      <div className="w-8 h-8 rounded-full border-2 border-teal-900/20 border-t-teal-900 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastHost />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/phc" element={<ProtectedRoute role="phc"><PHCDashboard /></ProtectedRoute>} />
            <Route path="/hospital" element={<ProtectedRoute role="hospital"><HospitalDashboard /></ProtectedRoute>} />
            <Route path="/ambulance" element={<ProtectedRoute role="ambulance"><AmbulanceDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Login />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
