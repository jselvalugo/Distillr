import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useAuth } from "./hooks/use-auth";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Barrels from "./pages/barrels";
import Production from "./pages/production";
import Inventory from "./pages/inventory";
import CompliancePage from "./pages/compliance";
import Clients from "./pages/clients";
import Properties from "./pages/properties";
import SalesOrders from "./pages/sales-orders";
import StaffPage from "./pages/staff";
import Users from "./pages/users";

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

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AuthGuard>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/barrels" component={Barrels} />
            <Route path="/production" component={Production} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/compliance" component={CompliancePage} />
            <Route path="/clients" component={Clients} />
            <Route path="/properties" component={Properties} />
            <Route path="/sales-orders" component={SalesOrders} />
            <Route path="/staff" component={StaffPage} />
            <Route path="/users" component={Users} />
          </Switch>
        </AuthGuard>
      </Route>
    </Switch>
  );
}
