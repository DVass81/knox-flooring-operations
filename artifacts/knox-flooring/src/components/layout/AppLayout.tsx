import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DemoCenter } from "@/components/demo/DemoCenter";
import { Link, useLocation } from "wouter";
import { SectionTabs } from "./SectionTabs";
import { useAuth } from "@/contexts/auth";
import { canAccess, navItems } from "./nav";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const destinations = navItems.filter((item) => item.href === location || (item.href !== "/" && location.startsWith(`${item.href}/`)));
  const allowed = destinations.length === 0 || destinations.some((item) => canAccess(item, user?.role ?? "installer"));
  useEffect(() => { document.title = `${destinations[0]?.name ?? "Workspace"} · Catalyst Works`; }, [location]);
  const section = ["/jobs", "/pipeline"].includes(location) ? "jobs" : ["/calendar", "/schedule", "/tasks"].includes(location) ? "schedule" : ["/reports", "/sales", "/commissions"].includes(location) ? "reports" : null;
  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3">Skip to content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main id="main-content" tabIndex={-1} className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-24">{allowed ? <>{section && <SectionTabs section={section} />}{children}</> : <div className="mx-auto max-w-xl rounded-lg border bg-white p-8"><h1 className="text-xl font-semibold">This page is outside your current role</h1><p className="mt-3 text-sm text-muted-foreground">Use the navigation to open the tools available to you{user?.previewRole ? ", or leave role preview in the account menu" : ""}.</p><Button className="mt-5" asChild><Link href="/">Go to Today</Link></Button></div>}</main>
      </div>
      <DemoCenter />
    </div>
  );
}
