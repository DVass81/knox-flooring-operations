import { useEffect, useState } from "react";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarBody } from "./Sidebar";
import { NotificationCenter } from "./NotificationCenter";
import { CommandPalette } from "./CommandPalette";

export function Header() {
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
        <NotificationCenter />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
