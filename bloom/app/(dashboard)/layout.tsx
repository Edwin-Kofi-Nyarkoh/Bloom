import { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import BottomNav from "@/components/layout/BottomNav";
import AuthGate from "@/components/layout/AuthGate";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="bloom-bg min-h-screen px-4 pb-28 pt-2 md:px-6 md:pb-10 md:pt-6">
        <div className="mx-auto flex max-w-4xl gap-6">
          <Sidebar />
          <div className="min-w-0 flex-1 space-y-5">
            <Topbar />
            <main className="mx-auto max-w-xl space-y-5 md:mx-0 md:max-w-none">{children}</main>
          </div>
        </div>
      </div>
      <BottomNav />
    </AuthGate>
  );
}
