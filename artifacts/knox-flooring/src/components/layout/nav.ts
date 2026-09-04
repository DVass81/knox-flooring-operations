import {
  LayoutDashboard,
  Briefcase,
  KanbanSquare,
  Calculator,
  FileText,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Trophy,
  Wallet,
  Receipt,
  Contact,
  Package,
  Boxes,
  BarChart3,
  Settings,
  Activity,
  Send,
  Target,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Extra terms to help fuzzy search in the command palette */
  keywords?: string;
  roles?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home overview kpi" },
    ],
  },
  {
    label: "Sales",
    items: [
      { name: "Leads", href: "/leads", icon: Target, keywords: "prospects inquiries crm" },
      { name: "Pipeline", href: "/pipeline", icon: KanbanSquare, keywords: "stages board funnel" },
      { name: "AI Quote Copilot", href: "/estimator", icon: Calculator, keywords: "quote estimate measure", roles: ["owner", "sales"] },
      { name: "Proposals", href: "/proposals", icon: FileText, keywords: "quotes contracts sign" },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Jobs", href: "/jobs", icon: Briefcase, keywords: "projects installs work orders" },
      { name: "Schedule", href: "/schedule", icon: CalendarDays, keywords: "crew install dates" },
      { name: "Calendar", href: "/calendar", icon: CalendarRange, keywords: "events appointments google" },
      { name: "Task Calendar", href: "/tasks", icon: CalendarCheck, keywords: "tasks to-do assignee follow-up google sync" },
      { name: "Materials", href: "/materials", icon: Package, keywords: "orders delivery supplier" },
      { name: "Inventory", href: "/inventory", icon: Boxes, keywords: "catalog products stock" },
    ],
  },
  {
    label: "Finance",
    items: [
      { name: "Invoices", href: "/invoices", icon: Receipt, keywords: "billing payments balance", roles: ["owner"] },
      { name: "Commissions", href: "/commissions", icon: Wallet, keywords: "payouts rep pay", roles: ["owner"] },
      { name: "Sales Performance", href: "/sales", icon: Trophy, keywords: "leaderboard reps ranking", roles: ["owner", "sales"] },
    ],
  },
  {
    label: "Records",
    items: [
      { name: "Customers", href: "/customers", icon: Contact, keywords: "clients people accounts", roles: ["owner", "sales"] },
      { name: "Reports", href: "/reports", icon: BarChart3, keywords: "analytics insights charts", roles: ["owner"] },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Settings", href: "/settings", icon: Settings, keywords: "config company preferences", roles: ["owner"] },
      { name: "Integration Health", href: "/integration-health", icon: Activity, keywords: "connections quickbooks ai calendar demo", roles: ["owner", "operations"] },
      { name: "Demo Outbox", href: "/demo-outbox", icon: Send, keywords: "email sms messages safe preview", roles: ["owner", "sales"] },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
