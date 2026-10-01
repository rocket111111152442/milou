import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { MemberProvider } from "@/components/account/MemberProvider";
import { currentMember } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const member = await currentMember();
  return (
    <MemberProvider initial={member}>
      <Nav />
      <main>{children}</main>
      <Footer />
    </MemberProvider>
  );
}
