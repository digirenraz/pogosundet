"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Signs the user out of Supabase and refreshes the page to clear server-side state.
export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("Home");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="h-[52px] w-full border border-border rounded-md flex items-center justify-center text-base font-semibold text-foreground bg-card"
    >
      {t("logoutButton")}
    </button>
  );
}
