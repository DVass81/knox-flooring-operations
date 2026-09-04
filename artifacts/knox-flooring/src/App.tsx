import { AppLayout } from "@/components/layout/AppLayout";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import LeadDetail from "@/pages/lead-detail";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import Pipeline from "@/pages/pipeline";
import Estimator from "@/pages/estimator";
import Proposals from "@/pages/proposals";
import Schedule from "@/pages/schedule";
import CalendarPage from "@/pages/calendar";
import TaskCalendar from "@/pages/task-calendar";
import SalesPerformance from "@/pages/sales-performance";
import Commissions from "@/pages/commissions";
import Invoices from "@/pages/invoices";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Materials from "@/pages/materials";
import Inventory from "@/pages/inventory";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import PublicStatus from "@/pages/public-status";
import PublicQuote from "@/pages/public-quote";
import PublicPrint from "@/pages/public-print";
import Welcome, { hasEnteredDemo } from "@/pages/welcome";
import VideoPage from "@/pages/video";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { Loader2 } from "lucide-react";
import IntegrationHealth from "@/pages/integration-health";
import DemoOutbox from "@/pages/demo-outbox";
import AIOperations from "@/pages/ai-operations";

const queryClient = new QueryClient();

function AdminRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/leads" component={Leads} />
        <Route path="/leads/:id" component={LeadDetail} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/estimator" component={Estimator} />
        <Route path="/ai-operations" component={AIOperations} />
        <Route path="/proposals" component={Proposals} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/tasks" component={TaskCalendar} />
        <Route path="/sales" component={SalesPerformance} />
        <Route path="/commissions" component={Commissions} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/customers/:key" component={CustomerDetail} />
        <Route path="/customers" component={Customers} />
        <Route path="/materials" component={Materials} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route path="/integration-health" component={IntegrationHealth} />
        <Route path="/demo-outbox" component={DemoOutbox} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  return (
    <Switch>
      <Route path="/video" component={VideoPage} />
      <Route path="/p/:token/print/invoice/:invoiceId">
        {(params) => <PublicPrint key={`${params.token}-inv`} />}
      </Route>
      <Route path="/p/:token/print/:kind" component={PublicPrint} />
      <Route path="/p/:token" component={PublicStatus} />
      <Route path="/q/:token" component={PublicQuote} />
      <Route path="/welcome">
        {() => (user ? <Redirect to="/" /> : <Welcome />)}
      </Route>
      <Route path="/">
        {() => (user ? <AdminRouter /> : <Redirect to="/welcome" />)}
      </Route>
      <Route component={AdminRouter} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider><Router /></AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
