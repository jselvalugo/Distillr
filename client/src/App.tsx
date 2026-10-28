import { lazy, Suspense, useEffect } from "react";
import { OnboardingTour } from "./components/onboarding/tour";
import { Route, Switch, useLocation } from "wouter";
import { useAuth } from "./hooks/use-auth";
import Landing from "./pages/landing";
import Login from "./pages/login";
import Signup from "./pages/signup";
const FeaturesPage = lazy(() => import("./pages/features"));
const PricingPage = lazy(() => import("./pages/pricing"));
const FaqPage = lazy(() => import("./pages/faq"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const TermsPage = lazy(() => import("./pages/terms"));
const AcceptableUsePage = lazy(() => import("./pages/acceptable-use"));
const AdminLogin = lazy(() => import("./pages/admin-login"));
const AdminDashboard = lazy(() => import("./pages/admin-dashboard"));
const loadDashboard = () => import("./pages/dashboard");
const Dashboard = lazy(loadDashboard);
const Barrels = lazy(() => import("./pages/barrels"));
const BarrelForm = lazy(() => import("./pages/barrel-form"));
const Production = lazy(() => import("./pages/production"));
const BatchDetail = lazy(() => import("./pages/batch-detail"));
const BatchForm = lazy(() => import("./pages/batch-form"));
const Inventory = lazy(() => import("./pages/inventory"));
const InventoryItemForm = lazy(() => import("./pages/inventory-item-form"));
const InventoryLotForm = lazy(() => import("./pages/inventory-lot-form"));
const CompliancePage = lazy(() => import("./pages/compliance"));
const ComplianceForm = lazy(() => import("./pages/compliance-form"));
const ComplianceDetail = lazy(() => import("./pages/compliance-detail"));
const ComplianceRegulatory = lazy(() => import("./pages/compliance-regulatory"));
const PermitForm = lazy(() => import("./pages/permit-form"));
const ColaForm = lazy(() => import("./pages/cola-form"));
const LabelForm = lazy(() => import("./pages/label-form"));
const ExciseForm = lazy(() => import("./pages/excise-form"));
const Clients = lazy(() => import("./pages/clients"));
const ClientForm = lazy(() => import("./pages/client-form"));
const Properties = lazy(() => import("./pages/properties"));
const PropertyForm = lazy(() => import("./pages/property-form"));
const SalesOrders = lazy(() => import("./pages/sales-orders"));
const SalesOrderForm = lazy(() => import("./pages/sales-order-form"));
const StaffPage = lazy(() => import("./pages/staff"));
const StaffForm = lazy(() => import("./pages/staff-form"));
const Users = lazy(() => import("./pages/users"));
const UserForm = lazy(() => import("./pages/user-form"));
const Reports = lazy(() => import("./pages/reports"));
const Settings = lazy(() => import("./pages/settings"));
const FloorPlan = lazy(() => import("./pages/floor-plan"));
const NotFound = lazy(() => import("./pages/not-found"));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[#737373]">
        Loading…
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}

// Smart root: landing page for visitors, dashboard for authenticated users
function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[#737373]">
        Loading…
      </div>
    );
  }
  if (!user) return <Landing />;
  return <Dashboard />;
}

/** Blank, neutral placeholder while a page's code loads — no dark or "Loading…" flash. */
function PageFallback() {
  return <div className="h-screen" aria-busy="true" />;
}

export default function App() {
  const { user } = useAuth();
  // Once signed in, warm the dashboard chunk so the post-login screen is instant.
  useEffect(() => {
    if (user) void loadDashboard();
  }, [user]);

  return (
    <Suspense fallback={<PageFallback />}>
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/acceptable-use" component={AcceptableUsePage} />
      <Route path="/" component={RootRoute} />
      <Route>
        <AuthGuard>
          <Switch>
            <Route path="/barrels" component={Barrels} />
            <Route path="/barrels/new" component={BarrelForm} />
            <Route path="/barrels/:id/edit" component={BarrelForm} />
            <Route path="/production" component={Production} />
            <Route path="/production/new" component={BatchForm} />
            <Route path="/production/:id" component={BatchDetail} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/inventory/items/new" component={InventoryItemForm} />
            <Route path="/inventory/lots/new" component={InventoryLotForm} />
            <Route path="/compliance" component={CompliancePage} />
            <Route path="/compliance/new" component={ComplianceForm} />
            <Route path="/compliance/:id" component={ComplianceDetail} />
            <Route path="/compliance-regulatory" component={ComplianceRegulatory} />
            <Route path="/permits/new" component={PermitForm} />
            <Route path="/permits/:id/edit" component={PermitForm} />
            <Route path="/cola/new" component={ColaForm} />
            <Route path="/cola/:id/edit" component={ColaForm} />
            <Route path="/labels/new" component={LabelForm} />
            <Route path="/labels/:id/edit" component={LabelForm} />
            <Route path="/excise/new" component={ExciseForm} />
            <Route path="/excise/:id/edit" component={ExciseForm} />
            <Route path="/clients" component={Clients} />
            <Route path="/clients/new" component={ClientForm} />
            <Route path="/clients/:id/edit" component={ClientForm} />
            <Route path="/properties" component={Properties} />
            <Route path="/properties/new" component={PropertyForm} />
            <Route path="/sales-orders" component={SalesOrders} />
            <Route path="/sales-orders/new" component={SalesOrderForm} />
            <Route path="/sales-orders/:id/edit" component={SalesOrderForm} />
            <Route path="/staff" component={StaffPage} />
            <Route path="/staff/new" component={StaffForm} />
            <Route path="/staff/:id/edit" component={StaffForm} />
            <Route path="/users" component={Users} />
            <Route path="/users/new" component={UserForm} />
            <Route path="/users/:id/edit" component={UserForm} />
            <Route path="/reports" component={Reports} />
            <Route path="/reports/:kind" component={Reports} />
            <Route path="/settings" component={Settings} />
            <Route path="/floor-plan" component={FloorPlan} />
            <Route component={NotFound} />
          </Switch>
        </AuthGuard>
      </Route>
    </Switch>
    {/* Mounted once, above the routes, so the tour survives page changes. */}
    <OnboardingTour />
    </Suspense>
  );
}
