import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useStore } from "@/hooks/use-store";
import { navGroups } from "./nav";
import { useAuth } from "@/contexts/auth";

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

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex items-center h-16 px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/kfc-logo.png" alt="Knoxville Flooring Center" className="h-10 w-10 rounded-md bg-white object-contain p-1" />
          <div className="flex flex-col leading-none">
            <span className="font-serif text-lg font-semibold text-white tracking-tight">
              KFC Operations
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
              Flooring Center
            </span>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-5 px-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => ({ ...group, items: group.items.filter((item) => !item.roles || item.roles.includes(user?.role ?? "owner")) })).filter((group) => group.items.length > 0).map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.name} href={item.href} className="block" onClick={onNavigate}>
                    <div
                      data-tour={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sidebar-primary" />
                      )}
                      <item.icon
                        className={cn(
                          "w-[18px] h-[18px] shrink-0 transition-colors",
                          isActive
                            ? "text-sidebar-primary"
                            : "text-sidebar-foreground/50 group-hover:text-white"
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
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold text-sidebar-accent-foreground border border-sidebar-border">
            {getInitials(user?.name || settings.ownerName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">
              {user?.name || settings.ownerName || "Will Hedley"}
            </span>
            <span className="text-xs text-sidebar-foreground/50 truncate">
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
