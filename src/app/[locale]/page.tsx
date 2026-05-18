import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/Hero";

// Home page — logged-out landing page only.
// Logged-in users with a profile go to /players; the profile-setup case is
// handled centrally by the middleware in `src/lib/supabase/middleware.ts`.
export default async function HomePage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const t = await getTranslations("Home");

  if (claimsData?.claims) {
    redirect("/players");
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Hero />

      <div className="flex-1 flex flex-col px-6 pb-6 gap-6 mt-4">
        <div className="text-center">
          <h1 className="text-[28px] font-extrabold text-foreground tracking-tight mb-2">
            {t("title")}
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="h-[52px] w-full bg-primary text-primary-foreground rounded-md flex items-center justify-center text-base font-semibold"
          >
            {t("loginButton")}
          </Link>
          <Link
            href="/register"
            className="h-[52px] w-full bg-card border border-border rounded-md flex items-center justify-center text-base font-semibold text-foreground"
          >
            {t("registerButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
