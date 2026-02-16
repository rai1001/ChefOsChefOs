import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { shouldRetryQueryError } from "@/lib/networkRetry";
import {
  captureRuntimeError,
  setRuntimeErrorContext,
} from "@/lib/runtimeErrorLogger";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const Status = lazy(() => import("./pages/Status"));
const Events = lazy(() => import("./pages/Events"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Menus = lazy(() => import("./pages/Menus"));
const Products = lazy(() => import("./pages/Products"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Tickets = lazy(() => import("./pages/Tickets"));
const DailyPlan = lazy(() => import("./pages/DailyPlan"));
const Shifts = lazy(() => import("./pages/Shifts"));
const MyShift = lazy(() => import("./pages/MyShift"));
const Operations = lazy(() => import("./pages/Operations"));
const Settings = lazy(() => import("./pages/Settings"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Staff = lazy(() => import("./pages/Staff"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      void captureRuntimeError("query_error", error, {
        queryKey: query.queryKey,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      void captureRuntimeError("mutation_error", error, {
        mutationKey: mutation.options.mutationKey ?? null,
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        failureCount < 3 && shouldRetryQueryError(error),
      refetchOnReconnect: true,
    },
  },
});

function RuntimeErrorLifecycle() {
  const location = useLocation();
  const { user, profile, roles } = useAuth();

  useEffect(() => {
    setRuntimeErrorContext({
      hotelId: profile?.current_hotel_id ?? null,
      userId: user?.id ?? null,
      route: location.pathname,
      roles,
    });
  }, [location.pathname, profile?.current_hotel_id, roles, user?.id]);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      void captureRuntimeError("window_error", event.error ?? event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      void captureRuntimeError("unhandled_rejection", event.reason);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

function RouteFallback() {
  const isMobile = typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false;

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-4 bg-background p-4">
      <Skeleton className="h-12 w-2/3 rounded-xl" />
      <div className="grid gap-3 grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="chefos-theme">
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RuntimeErrorLifecycle />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />
              <Route path="/status" element={
                <ProtectedRoute requiredRoles={['super_admin']}>
                  <Status />
                </ProtectedRoute>
              } />
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
              <Route path="/tickets" element={
                <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'maitre', 'produccion', 'rrhh', 'super_admin']}>
                  <Tickets />
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
              <Route path="/my-shift" element={
                <ProtectedRoute>
                  <MyShift />
                </ProtectedRoute>
              } />
              <Route path="/operations" element={
                <ProtectedRoute requiredRoles={['admin', 'jefe_cocina', 'produccion', 'rrhh', 'super_admin']}>
                  <Operations />
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
