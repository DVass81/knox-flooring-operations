import { useEffect, useState } from "react";
import { Search, Menu, LogOut, Plus, BookOpen, UserRoundCog, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarBody } from "./Sidebar";
import { NotificationCenter } from "./NotificationCenter";
import { CommandPalette } from "./CommandPalette";
import { useAuth } from "@/contexts/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

export function Header() {
  const { logout, user, switchPersona } = useAuth();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="h-16 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-8 sticky top-0 z-20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-sidebar-border">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="group flex items-center gap-2.5 w-full max-w-md rounded-md border border-transparent bg-muted/50 px-3 h-9 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">Search jobs, customers, proposals…</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" className="hidden sm:flex"><Plus className="mr-1.5 h-4 w-4" />Create<ChevronDown className="ml-1.5 h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Start new</DropdownMenuLabel>{[["Lead","/leads"],["AI estimate","/estimator"],["Job","/jobs"],["Appointment","/calendar"],["Task","/tasks"],["Invoice","/invoices"]].map(([label,href]) => <DropdownMenuItem key={label} onClick={() => navigate(href)}>{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
        <Button variant="ghost" size="icon" title="Open Demo Center" aria-label="Open Demo Center" onClick={() => window.dispatchEvent(new Event("knox:demo-center"))}><BookOpen className="h-4 w-4" /></Button>
        {(user?.actualRole === "owner" || user?.role === "owner") && <DropdownMenu><DropdownMenuTrigger asChild><Button variant={user?.previewRole ? "secondary" : "ghost"} size="sm" className="hidden md:flex"><UserRoundCog className="mr-1.5 h-4 w-4" />{user?.previewRole ? `${user.role} preview` : "Preview role"}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>View the app as…</DropdownMenuLabel>{["sales","operations","installer"].map((role) => <DropdownMenuItem key={role} onClick={() => void switchPersona(role as "sales" | "operations" | "installer")}>{role[0].toUpperCase()+role.slice(1)}</DropdownMenuItem>)}{user?.previewRole && <><DropdownMenuSeparator/><DropdownMenuItem onClick={() => void switchPersona(null)}>Exit preview</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>}
        <NotificationCenter />
        <Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={() => void logout()}><LogOut className="h-4 w-4" /></Button>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
