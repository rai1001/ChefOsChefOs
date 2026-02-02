import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AcceptInvitation from "./pages/AcceptInvitation";
import Events from "./pages/Events";
import Forecast from "./pages/Forecast";
import Menus from "./pages/Menus";
import Products from "./pages/Products";
import Purchases from "./pages/Purchases";
import Suppliers from "./pages/Suppliers";
import Inventory from "./pages/Inventory";
import Tasks from "./pages/Tasks";
import Shifts from "./pages/Shifts";
import Settings from "./pages/Settings";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound";
import Staff from "./pages/Staff";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/events" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'maitre']}>
                <Events />
              </ProtectedRoute>
            } />
            <Route path="/forecast" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina']}>
                <Forecast />
              </ProtectedRoute>
            } />
            <Route path="/menus" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'maitre']}>
                <Menus />
              </ProtectedRoute>
            } />
            <Route path="/products" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'produccion']}>
                <Products />
              </ProtectedRoute>
            } />
            <Route path="/purchases" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina']}>
                <Purchases />
              </ProtectedRoute>
            } />
            <Route path="/suppliers" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina']}>
                <Suppliers />
              </ProtectedRoute>
            } />
            <Route path="/staff" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'rrhh']}>
                <Staff />
              </ProtectedRoute>
            } />
            <Route path="/inventory" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'produccion']}>
                <Inventory />
              </ProtectedRoute>
            } />
            <Route path="/tasks" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'produccion']}>
                <Tasks />
              </ProtectedRoute>
            } />
            <Route path="/shifts" element={
              <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'rrhh']}>
                <Shifts />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/super-admin" element={
              <ProtectedRoute requiredRoles={['super_admin']}>
                <SuperAdmin />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
