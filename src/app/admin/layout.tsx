import { Navbar } from "@/components/layout/Navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen bg-[#0a0a0a]">
        {children}
      </div>
    </>
  );
}
