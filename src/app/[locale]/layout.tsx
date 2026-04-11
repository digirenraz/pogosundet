import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

// Locale layout — loads translations and makes them available to all
// child Server Components (via getTranslations) and Client Components
// (via useTranslations, powered by NextIntlClientProvider).
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
