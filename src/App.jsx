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
import ImportServices from "./pages/ImportServices";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The first page anyone sees is now the Platform Service Hub */}
        <Route path="/" element={<ServiceSelection />} /> 
        
        {/* The modules open up once a service is picked */}
        <Route path="/dashboard" element={<StylistDashboard />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/passport" element={<BeautyPassport />} />
        <Route path="/route" element={<RouteEngine />} />
        <Route path="/business" element={<BusinessEngine />} />
        <Route path="/ai" element={<AIEngine />} />
        <Route path="/salon" element={<SalonEngine />} />
        <Route path="/client-portal" element={<ClientPortal />} />
        <Route path="/import-services" element={<ImportServices />} />
      </Routes>
    </BrowserRouter>
  );
}