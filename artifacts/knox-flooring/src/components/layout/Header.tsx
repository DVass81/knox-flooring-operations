import { useEffect, useState } from "react";
import { Search, Menu, LogOut, Plus, BookOpen, UserRoundCog, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarBody } from "./Sidebar";
import { NotificationCenter } from "./NotificationCenter";
import { CommandPalette } from "./CommandPalette";
import { useAuth } from "@/contexts/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocation, useSearch } from "wouter";
import { canAccess, createItems } from "./nav";
import { contextualCreateHref, createContextRefs } from "@/lib/create-context";

export function Header() {
  const { logout, user, switchPersona } = useAuth();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const createContext = createContextRefs(location, search);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const shortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
  const availableCreate = createItems.filter((item) => canAccess(item, user?.role ?? "installer"));
  const canPreview = user?.actualRole === "owner" || user?.role === "owner";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((previous) => !previous);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b bg-white px-3 md:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden shrink-0" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>
          <SheetContent side="left" className="w-72 border-r-sidebar-border p-0"><SheetTitle className="sr-only">Main navigation</SheetTitle><SidebarBody onNavigate={() => setMobileOpen(false)} /></SheetContent>
        </Sheet>
        <button type="button" onClick={() => setPaletteOpen(true)} aria-label={`Search workspace (${shortcut})`} className="flex min-h-11 min-w-0 w-full max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Search className="h-4 w-4 shrink-0" /><span className="hidden min-w-0 truncate min-[360px]:inline"><span className="sm:hidden">Search</span><span className="hidden sm:inline">Search records or go to a page</span></span>
          <kbd className="ml-auto hidden shrink-0 rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">{shortcut}</kbd>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {availableCreate.length > 0 && <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" className="min-h-11" aria-label="Create new record"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create</span><ChevronDown className="hidden h-3.5 w-3.5 sm:block" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Start new</DropdownMenuLabel>{availableCreate.map((item) => <DropdownMenuItem key={item.href} onClick={() => navigate(contextualCreateHref(item.href, createContext, crypto.randomUUID()))}>{item.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
        <Button variant="ghost" size="sm" className="hidden min-h-11 md:flex" title="Open Training Center" onClick={() => window.dispatchEvent(new Event("knox:demo-center"))}><BookOpen className="h-4 w-4" />Training</Button>
        <Button variant="ghost" size="icon" className="md:hidden" title="Open Training Center" aria-label="Open Training Center" onClick={() => window.dispatchEvent(new Event("knox:demo-center"))}><BookOpen className="h-4 w-4" /></Button>
        <NotificationCenter />
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant={user?.previewRole ? "secondary" : "ghost"} size="icon" aria-label="Account and role options"><UserRoundCog className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel className="truncate">{user?.name || "Account"}</DropdownMenuLabel><p className="px-2 pb-2 text-xs capitalize text-muted-foreground">{user?.previewRole ? `Previewing ${user.role}` : user?.role}</p>{canPreview && <><DropdownMenuSeparator /><DropdownMenuLabel>Preview role</DropdownMenuLabel>{["sales", "operations", "installer"].map((role) => <DropdownMenuItem key={role} onClick={() => void switchPersona(role as "sales" | "operations" | "installer")}>{role[0].toUpperCase() + role.slice(1)}</DropdownMenuItem>)}{user?.previewRole && <DropdownMenuItem onClick={() => void switchPersona(null)}>Exit preview</DropdownMenuItem>}</>}<DropdownMenuSeparator /><DropdownMenuItem onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
