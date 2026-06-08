"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Hero } from "@/components/Hero";
import { AuthInput } from "@/components/AuthInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GoogleButton } from "@/components/GoogleButton";
import { OrDivider } from "@/components/OrDivider";

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(
        authError.message.includes("Invalid login credentials")
          ? t("errorInvalidCredentials")
          : t("errorGeneric")
      );
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Always show the Google account chooser so a signed-out user can
        // confirm or switch accounts instead of being silently re-authed by
        // Google's SSO into the same account.
        queryParams: { prompt: "select_account" },
      },
    });
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Hero />

      <div className="flex-1 px-6 pb-6 flex flex-col gap-6 mt-4">
        <div className="text-center">
          <h1 className="text-[28px] font-extrabold text-foreground tracking-tight mb-2">
            {t("title")}
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthInput
            label={t("emailLabel")}
            icon={Mail}
            type="email"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <div className="flex flex-col gap-1">
            <AuthInput
              label={t("passwordLabel")}
              icon={Lock}
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Link
              href="/reset"
              className="text-[13px] font-semibold text-primary text-right"
            >
              {t("forgotPassword")}
            </Link>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-4">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "…" : t("submit")}
            </PrimaryButton>

            <OrDivider text={t("or")} />

            <GoogleButton type="button" onClick={handleGoogle}>
              {t("googleButton")}
            </GoogleButton>
          </div>
        </form>

        <p className="mt-auto text-center text-sm text-muted-foreground pt-4">
          {t("footerPrompt")}{" "}
          <Link href="/register" className="text-primary font-semibold">
            {t("footerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
