import Link from "next/link";
import { AuthCard } from "../auth-card";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Create your account"
      subtitle="Joining a colleague's workspace? Use the invite link they sent — it brings you back here."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-brand-600" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}
