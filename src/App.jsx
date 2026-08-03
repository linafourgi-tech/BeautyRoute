import { BrowserRouter, Routes, Route } from "react-router-dom";
import ServiceSelection from "./pages/ServiceSelection"; // Our new entry landing page
import StylistDashboard from "./pages/StylistDashboard";
import Appointments from "./pages/Appointments";
import BeautyPassport from "./pages/BeautyPassport";
import RouteEngine from "./pages/RouteEngine";
import BusinessEngine from "./pages/BusinessEngine";
import AIEngine from "./pages/AIEngine";
import SalonEngine from "./pages/SalonEngine";
import ClientPortal from "./pages/ClientPortal";
import Clients from "./pages/Clients";
import Services from "./pages/Services";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";
import { OnboardingRoute } from "./components/routing/OnboardingRoute";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          {/* The first page anyone sees is now the Platform Service Hub */}
          <Route path="/" element={<ProtectedRoute><ServiceSelection /></ProtectedRoute>} />

          {/* The modules open up once a service is picked -- all professional-facing,
              all gated by sign-in + completed onboarding + an active subscription */}
          <Route path="/dashboard" element={<ProtectedRoute><StylistDashboard /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
          <Route path="/passport" element={<ProtectedRoute><BeautyPassport /></ProtectedRoute>} />
          <Route path="/route" element={<ProtectedRoute><RouteEngine /></ProtectedRoute>} />
          <Route path="/business" element={<ProtectedRoute><BusinessEngine /></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute><AIEngine /></ProtectedRoute>} />
          <Route path="/salon" element={<ProtectedRoute><SalonEngine /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />

          {/* Client-facing, not a professional-session page -- has no
              onboarding_completed/workspace relationship to gate on, so it's
              intentionally left outside ProtectedRoute rather than forced
              through a guard built for the professional side of the app */}
          <Route path="/client-portal" element={<ClientPortal />} />

          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Its own guard: signed in + NOT yet onboarded */}
          <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
