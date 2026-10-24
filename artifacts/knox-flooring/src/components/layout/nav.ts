import { LayoutDashboard, Briefcase, KanbanSquare, Calculator, FileText, CalendarDays, CalendarRange, CalendarCheck, Trophy, Wallet, Receipt, Contact, Package, Boxes, BarChart3, Settings, Activity, Send, Target, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
  roles?: string[];
  relatedPaths?: string[];
}
export interface NavGroup { label: string; items: NavItem[] }

export const navGroups: NavGroup[] = [
  { label: "Workspace", items: [
    { name: "Today", href: "/", icon: LayoutDashboard, keywords: "home dashboard overview priorities" },
    { name: "Daily brief", href: "/ai-operations", icon: Sparkles, keywords: "ai operations briefing handoffs risks", roles: ["owner", "sales", "operations"] },
  ] },
  { label: "Sales", items: [
    { name: "Leads", href: "/leads", icon: Target, keywords: "prospects inquiries crm", roles: ["owner", "sales"] },
    { name: "Estimates", href: "/estimator", icon: Calculator, keywords: "AI quote copilot measure", roles: ["owner", "sales"] },
    { name: "Proposals", href: "/proposals", icon: FileText, keywords: "quotes contracts sign", roles: ["owner", "sales"] },
    { name: "Customers", href: "/customers", icon: Contact, keywords: "clients people accounts", roles: ["owner", "sales"] },
  ] },
  { label: "Operations", items: [
    { name: "Jobs", href: "/jobs", icon: Briefcase, keywords: "projects installs work orders pipeline board", relatedPaths: ["/pipeline"] },
    { name: "Schedule", href: "/calendar", icon: CalendarDays, keywords: "crew installations calendar tasks follow-ups", relatedPaths: ["/schedule", "/tasks"], roles: ["owner", "operations"] },
    { name: "Schedule", href: "/tasks", icon: CalendarDays, keywords: "tasks follow-ups appointments", roles: ["sales", "installer"] },
    { name: "Materials", href: "/materials", icon: Package, keywords: "orders delivery supplier", roles: ["owner", "operations"] },
    { name: "Inventory", href: "/inventory", icon: Boxes, keywords: "catalog products stock", roles: ["owner", "operations"] },
  ] },
  { label: "Finance", items: [
    { name: "Invoices", href: "/invoices", icon: Receipt, keywords: "billing payments balance", roles: ["owner"] },
    { name: "Reports", href: "/reports", icon: BarChart3, keywords: "analytics insights charts sales commissions", roles: ["owner"], relatedPaths: ["/sales", "/commissions"] },
    { name: "Reports", href: "/sales", icon: BarChart3, keywords: "sales performance leaderboard", roles: ["sales"] },
  ] },
];
export const utilityItems: NavItem[] = [
  { name: "Settings", href: "/settings", icon: Settings, keywords: "config company preferences", roles: ["owner"] },
  { name: "Integrations", href: "/integration-health", icon: Activity, keywords: "health connections quickbooks calendar", roles: ["owner", "operations"] },
  { name: "Demo messages", href: "/demo-outbox", icon: Send, keywords: "outbox email sms preview", roles: ["owner", "sales"] },
];
export const viewItems: NavItem[] = [
  { name: "Jobs · Board", href: "/pipeline", icon: KanbanSquare, keywords: "pipeline stages" },
  { name: "Schedule · Crews", href: "/schedule", icon: CalendarRange, keywords: "assign installation dates", roles: ["owner", "operations"] },
  { name: "Schedule · Tasks & follow-ups", href: "/tasks", icon: CalendarCheck, keywords: "appointments assignee to-do google sync" },
  { name: "Reports · Sales performance", href: "/sales", icon: Trophy, keywords: "leaderboard reps", roles: ["owner", "sales"] },
  { name: "Reports · Commissions", href: "/commissions", icon: Wallet, keywords: "payouts pay", roles: ["owner"] },
];
export const navItems = [...navGroups.flatMap((group) => group.items), ...utilityItems, ...viewItems];
export const canAccess = (item: Pick<NavItem, "roles">, role: string) => !item.roles || item.roles.includes(role);
export const isNavActive = (item: NavItem, location: string) => [item.href, ...(item.relatedPaths ?? [])].some((path) => path === "/" ? location === "/" : location === path || location.startsWith(`${path}/`));
export const createItems = [
  { name: "Lead", href: "/leads?create=1", roles: ["owner", "sales"] },
  { name: "Estimate", href: "/estimator?create=1", roles: ["owner", "sales"] },
  { name: "Job", href: "/jobs?create=1", roles: ["owner", "operations"] },
  { name: "Task / appointment", href: "/tasks?create=1", roles: ["owner", "sales", "operations", "installer"] },
  { name: "Invoice", href: "/invoices?create=1", roles: ["owner"] },
];
