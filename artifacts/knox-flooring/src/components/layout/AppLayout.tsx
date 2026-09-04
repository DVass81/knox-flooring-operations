import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DemoCenter } from "@/components/demo/DemoCenter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <DemoCenter />
    </div>
  );
}
