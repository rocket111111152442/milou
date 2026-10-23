import { LoginForm } from "@/components/admin/LoginForm";
import { usingDefaultPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={next && next.startsWith("/admin") ? next : "/admin"} demo={usingDefaultPassword()} />;
}
