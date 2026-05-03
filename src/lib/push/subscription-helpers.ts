// Client-side helpers for managing web push notification subscriptions.
// These run in the browser only — never import from Server Components.
import { createClient } from '@/lib/supabase/client';

// Converts a VAPID public key from base64url to Uint8Array for PushManager.subscribe().
// The cast to ArrayBuffer is needed to satisfy the strict TypeScript lib type for applicationServerKey.
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const uint8 = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  return uint8.buffer as ArrayBuffer;
}

// Returns the current push permission/subscription state.
export async function getPushStatus(): Promise<'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'> {
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}

// Subscribes the current browser to push notifications and stores the
// subscription in Supabase. Upserts so re-subscribing after reinstall works.
export async function subscribeToPush(userId: string): Promise<{ error: unknown }> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });

    const json = subscription.toJSON();
    const endpoint = json.endpoint!;
    const p256dh = json.keys?.p256dh!;
    const auth = json.keys?.auth!;

    const supabase = createClient();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'user_id' });

    return { error };
  } catch (error) {
    return { error };
  }
}

// Removes the browser subscription and deletes the Supabase row.
export async function unsubscribeFromPush(userId: string): Promise<{ error: unknown }> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    return { error };
  } catch (error) {
    return { error };
  }
}
