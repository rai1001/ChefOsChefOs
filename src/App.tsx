import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const Events = lazy(() => import("./pages/Events"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Menus = lazy(() => import("./pages/Menus"));
const Products = lazy(() => import("./pages/Products"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Tasks = lazy(() => import("./pages/Tasks"));
const DailyPlan = lazy(() => import("./pages/DailyPlan"));
const Shifts = lazy(() => import("./pages/Shifts"));
const Settings = lazy(() => import("./pages/Settings"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Staff = lazy(() => import("./pages/Staff"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
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
              <Route path="/daily-plan" element={
                <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'produccion']}>
                  <DailyPlan />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
