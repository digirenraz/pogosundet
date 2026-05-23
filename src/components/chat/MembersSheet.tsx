'use client';

import { MessageCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/Avatar';
import type { OnlineStripProfile } from './OnlineStrip';

interface MembersSheetProps {
  open: boolean;
  onClose: () => void;
  profiles: OnlineStripProfile[];
  onlineIds: Set<string>;
  currentUserId: string | null;
  // Slice 17: tap a non-self row → opens a DM with that partner. The sheet
  // closes first via onClose; the parent does the routing.
  onOpenDM?: (partnerId: string) => void;
}

// Bottom-sheet member list. Online + offline sections. Non-self rows are
// tappable when `onOpenDM` is provided — closes the sheet then routes.
export function MembersSheet({
  open,
  onClose,
  profiles,
  onlineIds,
  currentUserId,
  onOpenDM,
}: MembersSheetProps) {
  const t = useTranslations('Chat');
  if (!open) return null;

  const online = profiles.filter((p) => onlineIds.has(p.user_id));
  const offline = profiles.filter((p) => !onlineIds.has(p.user_id));

  function handleSelect(partnerId: string) {
    onClose();
    onOpenDM?.(partnerId);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative bg-background rounded-t-3xl max-h-[76%] flex flex-col shadow-2xl">
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>
        <div className="flex justify-between items-center px-5 pb-3 border-b border-border">
          <div>
            <div className="text-[17px] font-bold text-card-foreground">{t('members')}</div>
            <div className="text-[12px] font-semibold text-muted-foreground">
              {t('membersSummary', { online: online.length, total: profiles.length })}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="w-9 h-9 rounded-full bg-input flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-3 pt-2 pb-5">
          <MemberSection
            title={t('online_section')}
            members={online}
            showOnline
            currentUserId={currentUserId}
            onSelect={onOpenDM ? handleSelect : undefined}
          />
          <MemberSection
            title={t('offline_section')}
            members={offline}
            showOnline={false}
            currentUserId={currentUserId}
            onSelect={onOpenDM ? handleSelect : undefined}
          />
        </div>
      </div>
    </div>
  );
}

interface MemberSectionProps {
  title: string;
  members: OnlineStripProfile[];
  showOnline: boolean;
  currentUserId: string | null;
  onSelect?: (partnerId: string) => void;
}

function MemberSection({
  title,
  members,
  showOnline,
  currentUserId,
  onSelect,
}: MemberSectionProps) {
  const t = useTranslations('Chat');
  if (members.length === 0) return null;
  return (
    <div className="flex flex-col">
      <div className="px-2 pt-3.5 pb-2 text-[12px] font-bold text-muted-foreground uppercase tracking-wider">
        {title} — {members.length}
      </div>
      <div className="flex flex-col">
        {members.map((p) => {
          const isMe = p.user_id === currentUserId;
          const tappable = !isMe && Boolean(onSelect);
          const rowContent = (
            <>
              <Avatar
                src={p.avatar_url}
                name={p.trainer_name}
                team={p.team ?? 'none'}
                level={p.level}
                online={showOnline}
                size={40}
                ring={false}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold text-card-foreground">
                  {p.trainer_name}
                  {isMe && (
                    <span className="text-[12px] font-semibold text-muted-foreground"> · {t('you')}</span>
                  )}
                </div>
                <div
                  className={`text-[12px] font-semibold ${
                    showOnline ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {showOnline ? t('online') : t('offline')}
                </div>
              </div>
              {tappable && (
                <MessageCircle
                  size={18}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
            </>
          );
          if (tappable) {
            return (
              <button
                type="button"
                key={p.user_id}
                onClick={() => onSelect?.(p.user_id)}
                className="flex items-center gap-3 px-2 py-2.5 rounded-md text-left"
              >
                {rowContent}
              </button>
            );
          }
          return (
            <div
              key={p.user_id}
              className="flex items-center gap-3 px-2 py-2.5 rounded-md"
            >
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
