import type { Metadata } from "next";
import { Toaster } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Espace fleuriste", robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-scope min-h-screen bg-[#F5F2F7] font-sans text-noir">
      {children}
      <Toaster />
    </div>
  );
}
