'use client';

// The "Opsætning" tab on /admin: how much of the community is actually able to
// receive notifications, and who to nudge.
//
// Push only lands if a member has BOTH installed the app to their home screen
// (mandatory on iOS) and granted notification permission, so both are shown per
// person, each with a direct link into a DM with them.
//
// Admin-only, and rendered only inside /admin, which 404s for non-moderators.
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Send, X } from 'lucide-react';
import type { MemberSetupRow, SetupSummary } from '@/lib/admin/setup-status';

interface SetupPanelProps {
  setup: SetupSummary;
}

export function SetupPanel({ setup }: SetupPanelProps) {
  const t = useTranslations('Setup');

  // A partial load is shown as a failure, not as numbers. Half the data would
  // render as confident zeros ("nobody has notifications on"), which is a
  // worse outcome than no answer on a screen used to decide who to contact.
  if (setup.failed) {
    return (
      <div
        role="alert"
        className="bg-card border border-destructive rounded-lg px-3.5 py-3 flex items-start gap-2.5"
      >
        <AlertTriangle size={18} className="text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-bold text-card-foreground">
            {t('loadErrorTitle')}
          </p>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
            {t('loadErrorBody')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label={t('statInstalled')}
          value={setup.installed}
          total={setup.members}
        />
        <StatCard
          label={t('statPush')}
          value={setup.push}
          total={setup.members}
        />
      </div>

      {/* The caveats that stop the numbers being read as more certain than they
          are. Both are common enough to be worth stating every time. */}
      <p className="text-[12px] text-muted-foreground leading-relaxed">
        {t('measuredHint')}
        {setup.unknown > 0 && ` ${t('unknownHint', { count: setup.unknown })}`}
        {setup.denied > 0 && ` ${t('deniedHint', { count: setup.denied })}`}
      </p>

      {/* Who needs help */}
      <section>
        <h2 className="text-[15px] font-bold text-card-foreground mb-2">
          {t('needsNudgeTitle', { count: setup.needsNudge.length })}
        </h2>
        {setup.needsNudge.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Check size={28} className="text-primary" />
            <p className="text-[14px] text-muted-foreground max-w-[280px]">
              {t('allReady')}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {setup.needsNudge.map((row) => (
              <MemberRow key={row.user_id} row={row} />
            ))}
          </ul>
        )}
      </section>

      {/* Fully set up — collapsed by default; it's the list you don't act on. */}
      {setup.ready.length > 0 && (
        <details className="bg-card border border-border rounded-lg px-3.5 py-2.5">
          <summary className="text-[14px] font-semibold text-card-foreground cursor-pointer">
            {t('readyTitle', { count: setup.ready.length })}
          </summary>
          <ul className="flex flex-col gap-2 mt-2.5">
            {setup.ready.map((row) => (
              <MemberRow key={row.user_id} row={row} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  total: number;
}

function StatCard({ label, value, total }: StatCardProps) {
  // Guard the divide: an empty community is 0 %, not NaN %.
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="bg-card border border-border rounded-lg px-3.5 py-3">
      <div className="text-[12px] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-[22px] font-bold text-card-foreground leading-tight">
        {value}
        <span className="text-[14px] text-muted-foreground font-semibold">
          {' '}
          / {total}
        </span>
      </div>
      <div className="text-[12px] text-muted-foreground">{percent} %</div>
    </div>
  );
}

function MemberRow({ row }: { row: MemberSetupRow }) {
  const t = useTranslations('Setup');

  return (
    <li className="bg-card border border-border rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-card-foreground truncate">
          {row.trainer_name}
        </div>
        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
          {row.unknown ? (
            <span className="text-[12px] text-muted-foreground">
              {t('neverSeen')}
            </span>
          ) : (
            <>
              {/* Three states, not two: `null` means they haven't reported
                  since this shipped, so we genuinely don't know — showing that
                  as a red "Ikke installeret" would invent a fact. */}
              {row.installed === null ? (
                <span className="text-[12px] text-muted-foreground font-semibold">
                  {t('flagInstallUnknown')}
                </span>
              ) : (
                <Flag
                  ok={row.installed}
                  label={
                    row.installed ? t('flagInstalled') : t('flagNotInstalled')
                  }
                />
              )}
              <Flag
                ok={row.push}
                label={
                  row.push
                    ? t('flagPush')
                    : row.push_permission === 'denied'
                      ? t('flagPushDenied')
                      : t('flagNoPush')
                }
              />
              {row.platform && (
                <span className="text-[12px] text-muted-foreground">
                  {t(`platform_${row.platform}`)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Straight into a DM with them — the nudge itself. */}
      <Link
        href={`/chat/dm/${row.user_id}`}
        aria-label={t('messageAria', { name: row.trainer_name })}
        className="shrink-0 h-10 px-3 rounded-md border border-border bg-card flex items-center gap-1.5 text-[13px] font-semibold text-card-foreground"
      >
        <Send size={14} />
        {t('message')}
      </Link>
    </li>
  );
}

// One setup step, read at a glance: green tick = done, red cross = the thing to
// nudge about.
function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1 text-[12px] font-semibold ${
        ok ? 'text-primary' : 'text-destructive'
      }`}
    >
      {ok ? <Check size={13} /> : <X size={13} />}
      {label}
    </span>
  );
}
