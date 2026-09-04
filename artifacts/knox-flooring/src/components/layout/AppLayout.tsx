import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { GuidedTour } from "@/components/tour/GuidedTour";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
      <GuidedTour />
    </div>
  );
}
