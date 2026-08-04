import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";
import { OnboardingRoute } from "./components/routing/OnboardingRoute";
import { RouteLoading } from "./components/routing/RouteLoading";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";

// Phase 13 Step 1: every page is now loaded on demand (React.lazy) instead
// of bundled into one eagerly-loaded chunk. This is a pure loading-strategy
// change -- nothing about which component renders for which route, what
// props it receives, or how the guards around it behave is touched. The
// existing RouteLoading component (already used by ProtectedRoute/
// OnboardingRoute while auth/profile/subscription state resolves) is reused
// here as the Suspense fallback while a route's own code downloads, so
// there's exactly one loading visual for "we don't have what we need yet
// to render this route" throughout the app, not a new one invented for
// this.
const ServiceSelection = lazy(() => import("./pages/ServiceSelection")); // Our new entry landing page
const StylistDashboard = lazy(() => import("./pages/StylistDashboard"));
const Appointments = lazy(() => import("./pages/Appointments"));
const BeautyPassport = lazy(() => import("./pages/BeautyPassport"));
const RouteEngine = lazy(() => import("./pages/RouteEngine"));
const BusinessEngine = lazy(() => import("./pages/BusinessEngine"));
const AIEngine = lazy(() => import("./pages/AIEngine"));
const SalonEngine = lazy(() => import("./pages/SalonEngine"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Clients = lazy(() => import("./pages/Clients"));
const Services = lazy(() => import("./pages/Services"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Pricing = lazy(() => import("./pages/Pricing"));

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Suspense fallback={<RouteLoading />}>
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
        </Suspense>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
