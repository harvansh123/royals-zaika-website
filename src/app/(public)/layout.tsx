import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import ReviewPopup from "@/components/reviews/ReviewPopup";
import { RecoverySetupPopup } from "@/components/auth/RecoverySetupPopup";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        {children}
      </main>
      <Footer />
      <ReviewPopup />
      <RecoverySetupPopup />
    </>
  );
}

