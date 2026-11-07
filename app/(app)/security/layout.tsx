import type { ReactNode } from "react";
import { SecurityNav } from "@/components/security/security-nav";

export default function SecurityLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <SecurityNav />
      {children}
    </div>
  );
}
