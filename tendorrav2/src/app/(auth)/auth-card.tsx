import Link from "next/link";
import { Logo } from "@/components/logo";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-brand-50 px-4">
      <Logo />
      <div className="card mt-6 w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{footer}</p>
      <Link href="/" className="mt-2 text-xs text-slate-400 hover:text-slate-600">tendorra</Link>
    </main>
  );
}
