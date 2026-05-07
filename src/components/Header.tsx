import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Server Component — reads the active session to show login or logout state.
// Rendered inside the hero area so uses white text with a drop shadow for contrast.
export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("Header");

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
      <Link
        href="/"
        className="text-white font-bold text-lg drop-shadow-sm"
      >
        {t("appName")}
      </Link>

      {!user && (
        <Link
          href="/login"
          className="text-sm font-semibold text-white drop-shadow-sm"
        >
          {t("loginLink")}
        </Link>
      )}
    </header>
  );
}
