// Stub — replaced in Slice 5 with the real Privacy Policy.
// This page exists so the GDPR consent checkbox on /register has a valid link target.
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  return (
    <div className="min-h-screen bg-background px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-2">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-foreground mb-8">{t("lastUpdated")}</p>

      <p className="text-[15px] text-foreground leading-relaxed mb-8">
        {t("stub")}
      </p>

      <Link href="/register" className="text-primary font-semibold text-sm">
        ← {t("backLink")}
      </Link>
    </div>
  );
}
