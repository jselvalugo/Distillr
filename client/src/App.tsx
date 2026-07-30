import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useAuth } from "./hooks/use-auth";
import Landing from "./pages/landing";
import Login from "./pages/login";
import Signup from "./pages/signup";
import AdminLogin from "./pages/admin-login";
import AdminDashboard from "./pages/admin-dashboard";
import Dashboard from "./pages/dashboard";
import Barrels from "./pages/barrels";
import BarrelForm from "./pages/barrel-form";
import Production from "./pages/production";
import BatchDetail from "./pages/batch-detail";
import BatchForm from "./pages/batch-form";
import Inventory from "./pages/inventory";
import InventoryItemForm from "./pages/inventory-item-form";
import InventoryLotForm from "./pages/inventory-lot-form";
import CompliancePage from "./pages/compliance";
import ComplianceForm from "./pages/compliance-form";
import ComplianceRegulatory from "./pages/compliance-regulatory";
import PermitForm from "./pages/permit-form";
import ColaForm from "./pages/cola-form";
import LabelForm from "./pages/label-form";
import ExciseForm from "./pages/excise-form";
import Clients from "./pages/clients";
import ClientForm from "./pages/client-form";
import Properties from "./pages/properties";
import PropertyForm from "./pages/property-form";
import SalesOrders from "./pages/sales-orders";
import SalesOrderForm from "./pages/sales-order-form";
import StaffPage from "./pages/staff";
import StaffForm from "./pages/staff-form";
import Users from "./pages/users";
import UserForm from "./pages/user-form";
import Reports from "./pages/reports";
import Settings from "./pages/settings";
import FloorPlan from "./pages/floor-plan";
import NotFound from "./pages/not-found";

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

export default function App() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
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
            <Route path="/settings" component={Settings} />
            <Route path="/floor-plan" component={FloorPlan} />
            <Route component={NotFound} />
          </Switch>
        </AuthGuard>
      </Route>
    </Switch>
  );
}
