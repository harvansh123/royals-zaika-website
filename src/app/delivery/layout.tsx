import { Navbar } from "@/components/layout/Navbar";

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pt-16 min-h-screen" style={{ background: "var(--bg-primary)" }}>
        {children}
      </div>
    </>
  );
}
