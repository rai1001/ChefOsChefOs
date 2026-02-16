import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AIChatWidget } from "@/components/ai/AIChatWidget";
import { QuickOpsBar } from "@/components/mobile/QuickOpsBar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { HealthBar } from "./HealthBar";
import { useOpsHeartbeatReporter } from "@/hooks/useOpsCenter";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  useOpsHeartbeatReporter();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-64 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <HealthBar />
        <main className="p-4 lg:p-6 pb-32 lg:pb-6">
          {children}
        </main>
      </div>
      <AIChatWidget />
      <QuickOpsBar />
      <MobileBottomNav />
    </div>
  );
}
