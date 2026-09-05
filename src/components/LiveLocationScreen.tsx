'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapPin, MessageCircle, Navigation, X } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Avatar, type AvatarTeam } from '@/components/Avatar';
import { BottomNav } from '@/components/BottomNav';
import { DesktopSidebar } from '@/components/desktop/DesktopSidebar';
import { useLocationShare } from '@/components/LocationShareProvider';
import { useLiveLocations } from '@/lib/location/use-live-locations';
import { locationAgeLabel, isStale, shareEndsLabel } from '@/lib/location/staleness';
import { nearestGymName } from '@/lib/location/nearest';
import { SHARE_DURATIONS, MAX_NOTE_LENGTH, type LiveLocation } from '@/lib/location/types';
import { fetchGyms } from '@/lib/gyms/helpers';
import type { Gym } from '@/lib/gyms/suggestions';
import { haversineMeters, formatDistance } from '@/lib/gyms/suggestions';
import { buildMapsUrl } from '@/lib/gyms/maps';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import type { MapMarker } from '@/components/map/CommunityMap';

// Leaflet reads `window` at import time, so the map can only be loaded in the
// browser. Everything else on this screen renders server-side as normal.
const CommunityMap = dynamic(() => import('@/components/map/CommunityMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#E8EDE8]" />,
});

const CONSENT_KEY = 'pogosundet:location-consent';

interface LiveLocationScreenProps {
  currentUserId: string;
}

// "Hvem spiller nu" — the live location screen.
//
// List-first by design. The map is a preview that expands, not the screen
// itself, for two reasons: a failed tile fetch degrades to a working page
// rather than a broken one, and — more importantly — the list states every
// position's age in words. A full-bleed map invites people to read pins as
// live, and they never are: a web app cannot refresh a position in the
// background, so every pin is a snapshot from the last time its owner had the
// app open. See src/lib/location/staleness.ts.
export function LiveLocationScreen({ currentUserId }: LiveLocationScreenProps) {
  const t = useTranslations('LiveLocation');
  const router = useRouter();

  const { locations, loading } = useLiveLocations(true);
  // Stopping lives in the always-visible banner (LocationShareBanner), not here.
  const { isSharing, start } = useLocationShare();
  // Default (low-accuracy, cached) options: this instance only labels distances,
  // it never publishes. The sharing path uses its own high-accuracy instance
  // inside LocationShareProvider.
  const { position: myPosition, status: geoStatus, request: requestGeo } = useGeolocation();

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'consent' | 'share'>('none');
  const [minutes, setMinutes] = useState<number>(60);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGyms().then(rows => {
      if (!cancelled) setGyms(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Rendered ages must tick even when nothing else changes, or a pin would sit
  // at "set 2 min siden" indefinitely — which is precisely the lie this screen
  // exists to avoid.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const decorated = useMemo(
    () =>
      locations.map(location => ({
        location,
        stale: isStale(location.updated_at, now),
        ageLabel: locationAgeLabel(location.updated_at, now),
        endsLabel: shareEndsLabel(location.expires_at, now),
        gym: nearestGymName({ lat: location.lat, lng: location.lng }, gyms),
        distance: myPosition
          ? formatDistance(
              haversineMeters(myPosition, { lat: location.lat, lng: location.lng })
            )
          : null,
        isMe: location.user_id === currentUserId,
      })),
    [locations, gyms, myPosition, now, currentUserId]
  );

  const markers = useMemo<MapMarker[]>(
    () =>
      decorated.map(({ location, stale, ageLabel, isMe }) => ({
        id: location.user_id,
        lat: location.lat,
        lng: location.lng,
        label: isMe ? t('you') : location.trainer_name,
        sublabel: ageLabel,
        initials: location.trainer_name.slice(0, 2).toUpperCase(),
        avatarUrl: location.avatar_url,
        muted: stale,
      })),
    [decorated, t]
  );

  const openShareSheet = useCallback(() => {
    setError(null);
    const consented =
      typeof window !== 'undefined' && window.localStorage.getItem(CONSENT_KEY) === '1';
    setSheet(consented ? 'share' : 'consent');
  }, []);

  const acceptConsent = useCallback(() => {
    try {
      window.localStorage.setItem(CONSENT_KEY, '1');
    } catch {
      // Private mode / storage disabled — the sheet just shows again next time,
      // which is a harmless outcome for a consent explainer.
    }
    setSheet('share');
  }, []);

  const confirmShare = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await start(minutes, note.trim() || null);
      setSheet('none');
      setNote('');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(code === 'no_position' ? t('failed') : t('failed'));
    } finally {
      setBusy(false);
    }
  }, [start, minutes, note, t]);

  const content = (
    <>
      {/* Map preview — tapping expands the same component fullscreen. */}
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="relative block w-full h-[140px] rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#E8EDE8]"
        aria-label={t('openMap')}
      >
        <CommunityMap markers={markers} className="h-full pointer-events-none" interactive={false} />
        <span className="absolute right-2 bottom-2 bg-white border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#2BBFAA] px-2 py-1">
          {t('openMap')}
        </span>
      </button>
      <p className="text-xs text-[#6B7280]">{t('mapAttribution')}</p>

      {/* Share CTA. Stopping is handled by the always-visible banner. */}
      {!isSharing && (
        <button
          type="button"
          onClick={openShareSheet}
          className="w-full bg-[#2BBFAA] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
        >
          <MapPin size={18} aria-hidden />
          {t('share')}
        </button>
      )}

      {geoStatus === 'idle' && (
        <button
          type="button"
          onClick={requestGeo}
          className="w-full text-[#2BBFAA] font-semibold py-2 text-sm"
        >
          {t('centerOnMe')}
        </button>
      )}
      {geoStatus === 'denied' && <p className="text-xs text-[#6B7280]">{t('denied')}</p>}

      {!loading && decorated.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center">
          <p className="text-sm font-semibold text-[#111827]">{t('empty')}</p>
          <p className="text-xs text-[#6B7280] mt-1">{t('emptyHint')}</p>
        </div>
      )}

      {decorated.length > 0 && (
        <p className="text-xs text-[#6B7280]">{t('staleWarning')}</p>
      )}

      <div className="flex flex-col gap-3">
        {decorated.map(({ location, stale, ageLabel, endsLabel, gym, distance, isMe }) => (
          <article
            key={location.user_id}
            className={`bg-white rounded-2xl border border-[#E5E7EB] p-4 ${stale ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-3">
              <Avatar
                src={location.avatar_url}
                name={location.trainer_name}
                size={44}
                team={(location.team as AvatarTeam | null) ?? 'none'}
                level={location.level}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#111827] truncate">
                  {isMe ? t('you') : location.trainer_name}
                </p>
                <p className="text-xs text-[#6B7280] truncate">
                  {[distance, gym ? t('near', { gym }) : null, location.note]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                {endsLabel && (
                  <p className="text-xs font-semibold text-[#111827]">{endsLabel}</p>
                )}
                <p className="text-[11px] text-[#6B7280]">{ageLabel}</p>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              {!isMe && (
                <button
                  type="button"
                  onClick={() => router.push(`/chat/dm/${location.user_id}`)}
                  className="flex-1 bg-[#F3F4F6] text-[#2BBFAA] text-sm font-semibold rounded-xl py-2 flex items-center justify-center gap-1"
                >
                  <MessageCircle size={16} aria-hidden />
                  {t('sendMessage')}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  window.open(
                    buildMapsUrl(location.trainer_name, {
                      lat: location.lat,
                      lng: location.lng,
                    }),
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
                className="flex-1 bg-[#F3F4F6] text-[#2BBFAA] text-sm font-semibold rounded-xl py-2 flex items-center justify-center gap-1"
              >
                <Navigation size={16} aria-hidden />
                {t('showOnMap')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div className="min-h-screen bg-background lg:hidden">
        <AppHeader title={t('title')} />
        <main className="pt-[116px] pb-[140px] px-4 flex flex-col gap-4">{content}</main>
        <BottomNav />
      </div>

      <div className="hidden lg:flex h-screen overflow-hidden bg-background">
        <DesktopSidebar />
        <main className="flex-1 min-w-0 h-screen overflow-y-auto px-8 py-6 flex flex-col gap-4 max-w-3xl">
          <h1 className="text-xl font-bold text-[#111827]">{t('title')}</h1>
          {content}
        </main>
      </div>

      {/* Fullscreen map — the same component, a different container. */}
      {mapOpen && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
            <p className="font-bold text-[#111827]">{t('title')}</p>
            <button type="button" onClick={() => setMapOpen(false)} aria-label={t('closeMap')}>
              <X size={22} className="text-[#111827]" />
            </button>
          </div>
          <div className="flex-1 relative">
            <CommunityMap markers={markers} focus={focus} className="h-full" />
            {myPosition && (
              <button
                type="button"
                onClick={() => setFocus([myPosition.lat, myPosition.lng])}
                className="absolute right-3 top-3 z-[400] bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm font-semibold text-[#2BBFAA]"
              >
                {t('centerOnMe')}
              </button>
            )}
          </div>
          <p className="text-xs text-[#6B7280] px-4 py-2">{t('mapAttribution')}</p>
        </div>
      )}

      {/* Consent explainer — shown once per device before the first share. */}
      {sheet === 'consent' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-5 flex flex-col gap-3">
            <h2 className="text-lg font-bold text-[#111827]">{t('consentTitle')}</h2>
            <p className="text-sm text-[#111827]">{t('consentWhat')}</p>
            <p className="text-sm text-[#111827]">{t('consentDuration')}</p>
            <p className="text-sm text-[#111827]">{t('consentStale')}</p>
            <p className="text-sm font-semibold text-[#111827]">{t('consentHome')}</p>
            <button
              type="button"
              onClick={acceptConsent}
              className="w-full bg-[#2BBFAA] text-white font-semibold py-3 rounded-xl mt-2"
            >
              {t('consentAccept')}
            </button>
            <button
              type="button"
              onClick={() => setSheet('none')}
              className="w-full text-[#2BBFAA] font-semibold py-2"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Duration picker. */}
      {sheet === 'share' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-5 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-[#111827]">{t('shareTitle')}</h2>

            <div>
              <p className="text-sm font-semibold text-[#111827] mb-2">{t('durationLabel')}</p>
              <div className="grid grid-cols-4 gap-2">
                {SHARE_DURATIONS.map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMinutes(value)}
                    className={`py-2 rounded-xl text-sm font-semibold border ${
                      minutes === value
                        ? 'bg-[#2BBFAA] text-white border-[#2BBFAA]'
                        : 'bg-[#F3F4F6] text-[#111827] border-transparent'
                    }`}
                  >
                    {t(`duration${value}` as 'duration15')}
                  </button>
                ))}
              </div>
            </div>

            <input
              value={note}
              onChange={e => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              placeholder={t('notePlaceholder')}
              maxLength={MAX_NOTE_LENGTH}
              className="bg-[#F3F4F6] rounded-xl px-3 py-3 text-sm outline-none placeholder:text-[#9CA3AF]"
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="button"
              onClick={() => void confirmShare()}
              disabled={busy}
              className="w-full bg-[#2BBFAA] text-white font-semibold py-3 rounded-xl disabled:opacity-60"
            >
              {t('startShare')}
            </button>
            <button
              type="button"
              onClick={() => setSheet('none')}
              className="w-full text-[#2BBFAA] font-semibold py-2"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export type { LiveLocation };
