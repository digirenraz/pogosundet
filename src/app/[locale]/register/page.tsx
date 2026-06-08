"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/amplitude";
import { Hero } from "@/components/Hero";
import { AuthInput } from "@/components/AuthInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GoogleButton } from "@/components/GoogleButton";
import { OrDivider } from "@/components/OrDivider";

export default function RegisterPage() {
  const t = useTranslations("Register");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return; // disabled button guards this, but double-check

    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Store the consent timestamp so we have a GDPR audit trail.
        data: { gdpr_consent_at: new Date().toISOString() },
      },
    });

    if (authError) {
      const msg = authError.message.toLowerCase();
      setError(
        msg.includes("already registered") || msg.includes("user already registered")
          ? t("errorEmailTaken")
          : msg.includes("password")
          ? t("errorWeakPassword")
          : t("errorGeneric")
      );
      setLoading(false);
    } else {
      // Analytics: registration submitted successfully (no PII — email is never sent).
      track("account_created");
      // Supabase sends a confirmation email — tell the user to check their inbox.
      setSuccess(true);
      setLoading(false);
    }
  }

  async function handleGoogle() {
    // For Google OAuth, consent is implied by proceeding through this page.
    // The GDPR notice below the button makes this explicit.
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

  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Hero />
        <div className="flex-1 px-6 pb-6 flex flex-col items-center justify-center gap-4 text-center mt-4">
          <p className="text-lg font-semibold text-foreground">
            {t("successMessage")}
          </p>
          <Link href="/login" className="text-primary font-semibold text-sm">
            {t("footerLink")}
          </Link>
        </div>
      </div>
    );
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

          <AuthInput
            label={t("passwordLabel")}
            icon={Lock}
            type="password"
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {/* GDPR consent — must be ticked before the user can register */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
              required
            />
            <span className="text-sm text-foreground leading-snug">
              {t("consentLabel")}
              <Link
                href="/privacy"
                className="text-primary font-semibold underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("consentLink")}
              </Link>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-4">
            <PrimaryButton type="submit" disabled={!consent || loading}>
              {loading ? "…" : t("submit")}
            </PrimaryButton>

            <OrDivider text={t("or")} />

            <div className="flex flex-col gap-1">
              <GoogleButton type="button" onClick={handleGoogle}>
                {t("googleButton")}
              </GoogleButton>
              <p className="text-[12px] text-muted-foreground text-center">
                {t("googleConsentNotice")}{" "}
                <Link href="/privacy" className="underline">
                  {t("consentLink")}
                </Link>
              </p>
            </div>
          </div>
        </form>

        <p className="mt-auto text-center text-sm text-muted-foreground pt-4">
          {t("footerPrompt")}{" "}
          <Link href="/login" className="text-primary font-semibold">
            {t("footerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
