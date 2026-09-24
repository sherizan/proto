import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { deepLinkToSubscriptions, ErrorCode, getAvailablePurchases, useIAP } from 'expo-iap';
import { Button, Card, Divider, Stack, Text } from 'proto-components';
import { useAuth } from '../lib/auth-context';
import { confirmPurchase, fetchPlusStatus, PLUS_SKUS, settlePurchase, type PlusStatus } from '../lib/plus';

const REJECTED = "This purchase couldn't be added to your account. If you were charged, you can ask Apple for a refund in your App Store settings.";
const RETRY = "We couldn't confirm your purchase yet. We'll try again next time you open Prototo.";

export function PlusCard({ onStatus }: { onStatus?: (s: PlusStatus | null) => void }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const userId = session?.user.id;
  const [status, setStatus] = useState<PlusStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!token) return;
    const s = await fetchPlusStatus(token);
    setStatus(s);
    onStatus?.(s);
  }, [token, onStatus]);

  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction, restorePurchases } =
    useIAP({
      onPurchaseSuccess: async (purchase) => {
        if (!token) return;
        const result = await settlePurchase(purchase, token, {
          confirm: confirmPurchase,
          finish: () => finishTransaction({ purchase, isConsumable: false }),
        });
        setMessage(result === 'ok' ? '' : result === 'rejected' ? REJECTED : RETRY);
        setBusy(false);
        await refresh();
      },
      onPurchaseError: (error) => {
        setBusy(false);
        if (error.code !== ErrorCode.UserCancelled) setMessage("The purchase didn't go through. Please try again.");
      },
    });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Loading products, and quietly re-sending the current entitlement so a
  // renewal the server missed heals on open (spec open risk 3).
  useEffect(() => {
    if (!connected || !token) return;
    void fetchProducts({ skus: [...PLUS_SKUS], type: 'subs' });
    void (async () => {
      const owned = await getAvailablePurchases();
      for (const p of owned ?? []) {
        await settlePurchase(p, token, { confirm: confirmPurchase, finish: () => finishTransaction({ purchase: p, isConsumable: false }) });
      }
      await refresh();
    })();
  }, [connected, token]);

  async function buy(sku: string) {
    if (!userId || busy) return;
    setBusy(true);
    setMessage('');
    await requestPurchase({ request: { apple: { sku, appAccountToken: userId } }, type: 'subs' });
  }

  async function restore() {
    if (!token || busy) return;
    setBusy(true);
    setMessage('');
    await restorePurchases();
    const owned = await getAvailablePurchases();
    for (const p of owned ?? []) {
      await settlePurchase(p, token, { confirm: confirmPurchase, finish: () => finishTransaction({ purchase: p, isConsumable: false }) });
    }
    await refresh();
    setBusy(false);
  }

  if (!token || !status) return null;

  if (status.plus) {
    return (
      <Card padding={0}>
        <Stack gap={4} style={{ padding: 16 }}>
          <Text size="headline">Prototo Plus</Text>
          <Text size="caption" color="secondary">You're on Plus.</Text>
        </Stack>
        {status.via === 'apple' ? (
          <>
            <Divider />
            <Pressable onPress={() => deepLinkToSubscriptions()} style={{ padding: 16 }}>
              <Text size="body">Manage subscription</Text>
            </Pressable>
          </>
        ) : null}
      </Card>
    );
  }

  const product = (sku: string) => subscriptions.find((s) => s.id === sku);
  const monthly = product('plus.monthly');
  const annual = product('plus.annual');

  return (
    <Card>
      <Stack gap={12}>
        <Stack gap={4}>
          <Text size="headline">Prototo Plus</Text>
          <Text size="body" color="secondary">
            Keep publishing prototypes from your Mac after the free trial, and record longer videos.
          </Text>
        </Stack>
        {monthly ? <Button label={`Monthly · ${monthly.displayPrice}`} disabled={busy} onPress={() => buy('plus.monthly')} /> : null}
        {annual ? <Button label={`Yearly · ${annual.displayPrice}`} variant="ghost" disabled={busy} onPress={() => buy('plus.annual')} /> : null}
        <Button label="Restore purchases" variant="ghost" disabled={busy} onPress={restore} />
        {message ? <Text size="caption" color="destructive">{message}</Text> : null}
        <Text size="caption" color="secondary">
          Renews automatically until you cancel. Cancel anytime in your App Store settings. See Terms and Privacy Policy below.
        </Text>
      </Stack>
    </Card>
  );
}
