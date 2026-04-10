import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import HomePage from "./pages/HomePage";
import MaintenanceHub from "./pages/MaintenanceHub";
import MapHub from "./pages/MapHub";
import SafetyHub from "./pages/SafetyHub";
import Dashboard from "./pages/Dashboard";
import Audit5S from "./pages/Audit5S";
import MaintenanceRequest from "./pages/MaintenanceRequest";
import RepairStatus from "./pages/RepairStatus";
import TechnicianWork from "./pages/TechnicianWork";
import MaintenanceAdmin from "./pages/MaintenanceAdmin";
import WasteLog from "./pages/WasteLog";
import FireCheck from "./pages/FireCheck";
import HospitalMap from "./pages/HospitalMap";
import Wayfinding from "./pages/Wayfinding";
import HazmatInventory from "./pages/HazmatInventory";
import EnvRound from "./pages/EnvRound";

import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import FireInfo from "./pages/FireInfo";
import FireInfoPublic from "./pages/FireInfoPublic";
import FireSafety from "./pages/FireSafety";
import WayfindingAdmin from "./pages/WayfindingAdmin";
import MapAligner from "./pages/MapAligner";
import FiveSHub from "./pages/FiveSHub";
import WaterManagement from "./pages/WaterManagement";
import WaterMeter from "./pages/WaterMeter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
            <Route path="/maintenance-hub" element={<ProtectedRoute><AppLayout><MaintenanceHub /></AppLayout></ProtectedRoute>} />
            <Route path="/map-hub" element={<ProtectedRoute><AppLayout><MapHub /></AppLayout></ProtectedRoute>} />
            <Route path="/safety-hub" element={<ProtectedRoute><AppLayout><SafetyHub /></AppLayout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/5s" element={<ProtectedRoute><AppLayout><Audit5S /></AppLayout></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><AppLayout><MaintenanceRequest /></AppLayout></ProtectedRoute>} />
            <Route path="/repair-status" element={<ProtectedRoute><AppLayout><RepairStatus /></AppLayout></ProtectedRoute>} />
            <Route path="/technician-work" element={<ProtectedRoute><AppLayout><TechnicianWork /></AppLayout></ProtectedRoute>} />
            <Route path="/maintenance-admin" element={<ProtectedRoute><AppLayout><MaintenanceAdmin /></AppLayout></ProtectedRoute>} />
            <Route path="/waste" element={<ProtectedRoute><AppLayout><WasteLog /></AppLayout></ProtectedRoute>} />
            <Route path="/fire-check" element={<ProtectedRoute><AppLayout><FireCheck /></AppLayout></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><AppLayout><HospitalMap /></AppLayout></ProtectedRoute>} />
            <Route path="/wayfinding" element={<ProtectedRoute><AppLayout><Wayfinding /></AppLayout></ProtectedRoute>} />
            <Route path="/hazmat" element={<ProtectedRoute><AppLayout><HazmatInventory /></AppLayout></ProtectedRoute>} />
            <Route path="/env-round" element={<ProtectedRoute><AppLayout><EnvRound /></AppLayout></ProtectedRoute>} />
            
            <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminPage /></AppLayout></ProtectedRoute>} />
            <Route path="/fire-safety" element={<ProtectedRoute><AppLayout><FireSafety /></AppLayout></ProtectedRoute>} />
            <Route path="/wayfinding-admin" element={<ProtectedRoute><AppLayout><WayfindingAdmin /></AppLayout></ProtectedRoute>} />
            <Route path="/5s-hub" element={<ProtectedRoute><AppLayout><FiveSHub /></AppLayout></ProtectedRoute>} />
            <Route path="/map-aligner" element={<ProtectedRoute><AppLayout><MapAligner /></AppLayout></ProtectedRoute>} />
            <Route path="/water" element={<ProtectedRoute><AppLayout><WaterManagement /></AppLayout></ProtectedRoute>} />
            <Route path="/water-meter" element={<ProtectedRoute><AppLayout><WaterMeter /></AppLayout></ProtectedRoute>} />
            <Route path="/fire-info/:id" element={<FireInfoPublic />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
