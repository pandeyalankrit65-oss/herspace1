import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { I18nProvider } from "./i18n";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import NativeBridge from "./components/NativeBridge";
import BottomNav from "./components/BottomNav";
// Home and SOS ship in the main bundle so the emergency page never waits on a download.
import Index from "./pages/Index";
import SOS from "./pages/SOS";

const Report = lazy(() => import("./pages/Report"));
const Support = lazy(() => import("./pages/Support"));
const Map = lazy(() => import("./pages/Map"));
const Circles = lazy(() => import("./pages/Circles"));
const Corporate = lazy(() => import("./pages/Corporate"));
const About = lazy(() => import("./pages/About"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ConfirmContact = lazy(() => import("./pages/ConfirmContact"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Account = lazy(() => import("./pages/Account"));
const Track = lazy(() => import("./pages/Track"));
const SafetyTimer = lazy(() => import("./pages/SafetyTimer"));
const Walk = lazy(() => import("./pages/Walk"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <BrowserRouter>
                <NativeBridge />
                <Suspense fallback={<div className="min-h-screen" />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/sos" element={<SOS />} />
                    <Route path="/report" element={<Report />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/map" element={<Map />} />
                    <Route path="/circles" element={<Circles />} />
                    <Route path="/corporate" element={<Corporate />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/confirm-contact/:token" element={<ConfirmContact />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/track/:token" element={<Track />} />
                    <Route path="/timer" element={<SafetyTimer />} />
                  <Route path="/walk" element={<Walk />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <BottomNav />
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
