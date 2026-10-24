import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";

const sections: Record<"jobs" | "schedule" | "reports", { name: string; href: string; id: string; roles?: string[] }[]> = {
  jobs: [{ name: "List", href: "/jobs", id: "nav-jobs-list" }, { name: "Board", href: "/pipeline", id: "nav-pipeline" }],
  schedule: [{ name: "Installations", href: "/calendar", id: "nav-calendar", roles: ["owner", "operations"] }, { name: "Crews", href: "/schedule", id: "nav-schedule", roles: ["owner", "operations"] }, { name: "Tasks & follow-ups", href: "/tasks", id: "nav-task-calendar" }],
  reports: [{ name: "Overview", href: "/reports", id: "nav-reports", roles: ["owner"] }, { name: "Sales performance", href: "/sales", id: "nav-sales-performance", roles: ["owner", "sales"] }, { name: "Commissions", href: "/commissions", id: "nav-commissions", roles: ["owner"] }],
};

export function SectionTabs({ section }: { section: keyof typeof sections }) {
  const [location] = useLocation();
  const { user } = useAuth();
  return <nav aria-label={`${section} views`} className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-0">
    {sections[section].filter((item) => !item.roles || item.roles.includes(user?.role ?? "installer")).map((item) => <Link key={item.href} href={item.href} data-training-id={item.id} aria-current={location === item.href ? "page" : undefined} className={cn("min-h-11 shrink-0 border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", location === item.href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50")}>{item.name}</Link>)}
  </nav>;
}
