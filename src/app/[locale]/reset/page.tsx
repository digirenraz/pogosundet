"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Hero } from "@/components/Hero";
import { AuthInput } from "@/components/AuthInput";
import { PrimaryButton } from "@/components/PrimaryButton";

export default function ResetPage() {
  const t = useTranslations("Reset");

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    // redirectTo tells Supabase where to send the user after they click the email link.
    // Our /auth/confirm handler then verifies the token and redirects to /reset/confirm.
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/confirm` }
    );

    if (authError) {
      setError(t("errorGeneric"));
    } else {
      setSuccess(true);
    }
    setLoading(false);
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
            {t("backToLogin")}
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

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">
              {error}
            </p>
          )}

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "…" : t("submit")}
          </PrimaryButton>
        </form>

        <p className="text-center text-sm text-muted-foreground pt-2">
          <Link href="/login" className="text-primary font-semibold">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
