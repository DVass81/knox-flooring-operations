import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { navGroups, utilityItems, canAccess, isNavActive } from "./nav";
import { useAuth } from "@/contexts/auth";
import { ProductBrand } from "./Brand";
import { Settings, ChevronUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const trainingIds: Record<string, string> = {
  "/": "nav-dashboard",
  "/ai-operations": "nav-ai-operations",
  "/leads": "nav-leads",
  "/pipeline": "nav-pipeline",
  "/estimator": "nav-ai-quote-copilot",
  "/proposals": "nav-proposals",
  "/jobs": "nav-jobs",
  "/schedule": "nav-schedule",
  "/calendar": "nav-calendar",
  "/tasks": "nav-task-calendar",
  "/materials": "nav-materials",
  "/inventory": "nav-inventory",
  "/invoices": "nav-invoices",
  "/commissions": "nav-commissions",
  "/sales": "nav-sales-performance",
  "/customers": "nav-customers",
  "/reports": "nav-reports",
  "/settings": "nav-settings",
  "/integration-health": "nav-integration-health",
  "/demo-outbox": "nav-demo-outbox",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { settings } = useStore();
  const { user } = useAuth();
  const utilities = utilityItems.filter((item) => canAccess(item, user?.role ?? "installer"));

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <ProductBrand dark />
        <p className="mt-4 truncate border-t border-white/10 pt-3 text-xs text-slate-300" title={settings.companyName}>{settings.companyName || "Knoxville Flooring Center"}</p>
      </div>
      <nav aria-label="Main navigation" className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => ({ ...group, items: group.items.filter((item) => canAccess(item, user?.role ?? "installer")) })).filter((group) => group.items.length > 0).map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isNavActive(item, location);
                return (
                  <Link key={item.href} href={item.href} className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-current={isActive ? "page" : undefined} onClick={onNavigate}>
                    <div
                      data-tour={item.href}
                      data-training-id={trainingIds[item.href]}
                      className={cn(
                        "group relative flex min-h-10 items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent text-white"
                          : "text-slate-300 hover:bg-sidebar-accent/50 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon
                        className={cn(
                          "w-[18px] h-[18px] shrink-0 transition-colors",
                          isActive
                            ? "text-slate-100"
                            : "text-slate-400 group-hover:text-white"
                        )}
                      />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        {utilities.length > 0 && <DropdownMenu><DropdownMenuTrigger className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-slate-300 hover:bg-sidebar-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Settings className="h-4 w-4" />Workspace tools<ChevronUp className="ml-auto h-4 w-4" /></DropdownMenuTrigger><DropdownMenuContent side="top" align="start" className="w-56">{utilities.map((item) => <DropdownMenuItem key={item.href} asChild><Link href={item.href} onClick={onNavigate} aria-current={location === item.href ? "page" : undefined}><item.icon className="mr-2 h-4 w-4" />{item.name}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold text-sidebar-accent-foreground border border-sidebar-border">
            {getInitials(user?.name || settings.ownerName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">
              {user?.name || settings.ownerName || "Team member"}
            </span>
            <span className="text-xs capitalize text-slate-400 truncate">
              {user?.previewRole ? `Previewing ${user.role}` : (user?.role || settings.ownerRole || "Owner")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <div className="hidden lg:flex flex-col w-64 border-r border-sidebar-border min-h-screen sticky top-0 h-screen">
      <SidebarBody />
    </div>
  );
}
