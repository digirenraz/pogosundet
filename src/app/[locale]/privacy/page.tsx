import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');

  const sections = [
    { title: t('s1Title'), body: t('s1Body') },
    { title: t('s2Title'), body: t('s2Body'), list: t('s2List') },
    { title: t('s3Title'), body: t('s3Body') },
    { title: t('s4Title'), body: t('s4Body') },
    { title: t('s5Title'), body: t('s5Body') },
    { title: t('s6Title'), body: t('s6Body') },
    { title: t('s7Title'), body: t('s7Body') },
    { title: t('s8Title'), body: t('s8Body') },
    { title: t('s9Title'), body: t('s9Body') },
    { title: t('s10Title'), body: t('s10Body') },
    { title: t('s11Title'), body: t('s11Body') },
    { title: t('s12Title'), body: t('s12Body') },
  ] as { title: string; body: string; list?: string }[];

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#111827] mb-1">{t('title')}</h1>
      <p className="text-xs text-[#6B7280] mb-8">{t('lastUpdated')}</p>

      <div className="flex flex-col gap-6">
        {sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-sm font-semibold text-[#111827] mb-1">{s.title}</h2>
            <p className="text-sm text-[#374151] leading-relaxed">{s.body}</p>
            {s.list && (
              <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">{s.list}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Link href="/register" className="text-sm text-[#2BBFAA] font-semibold">
          ← {t('backLink')}
        </Link>
      </div>
    </div>
  );
}
