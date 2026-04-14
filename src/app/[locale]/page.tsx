import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/Hero";
import { LogoutButton } from "@/components/LogoutButton";

// Home page — shows login/register prompts when logged out,
// or a greeting when logged in. Redirects to profile setup if no profile exists.
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("Home");

  // Redirect logged-in users who haven't created a profile yet
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      redirect("/profile/setup");
    }
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

        {user ? (
          <div className="flex flex-col gap-4">
            <p className="text-center font-semibold text-foreground">
              {t("loggedInGreeting", { email: user.email ?? "" })}
            </p>
            <LogoutButton />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
