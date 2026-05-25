'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import type { DMProfile } from '@/lib/dm/server-helpers';

interface DMHeaderProps {
  partner: DMProfile;
  online: boolean;
}

// Header for /chat/dm/[partnerId]. Back arrow + partner avatar + name + online/offline.
export function DMHeader({ partner, online }: DMHeaderProps) {
  const router = useRouter();
  const t = useTranslations('Chat');

  return (
    <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border h-[60px] flex items-center gap-2 px-2">
      <button
        type="button"
        onClick={() => router.push('/chat')}
        aria-label={t('back')}
        className="w-10 h-10 rounded-full flex items-center justify-center text-card-foreground"
      >
        <ChevronLeft size={24} />
      </button>
      <div className="shrink-0">
        <Avatar
          src={partner.avatar_url}
          name={partner.trainer_name}
          team={partner.team ?? 'none'}
          size={36}
          online={online}
          ring={false}
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] font-bold text-card-foreground truncate">
          {partner.trainer_name}
        </span>
        <span
          className={`text-[12px] font-semibold ${
            online ? 'text-success' : 'text-muted-foreground'
          }`}
        >
          {online ? t('online') : t('offline')}
        </span>
      </div>
    </div>
  );
}
