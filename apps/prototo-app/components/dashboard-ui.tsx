import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Card, Row, Stack, Text, useAccent } from 'proto-components';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';

export function OpenButton({ onPress }: { onPress: () => void }) {
  return <Button label="Open" variant="secondary" onPress={onPress} />;
}

export function TapCard({
  title,
  caption,
  onPress,
  action,
}: {
  title: string;
  caption?: string;
  onPress: () => void;
  action?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Stack gap={4}>
              <Text size="headline">{title}</Text>
              {caption ? (
                <Text size="caption" color="secondary">
                  {caption}
                </Text>
              ) : null}
            </Stack>
          </View>
          {action}
        </Row>
      </Card>
    </Pressable>
  );
}

// Empty states are deliberately NOT cards — cards represent prototypes.
export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <Text size="body" color="secondary" style={{ paddingVertical: 8 }}>
      {children}
    </Text>
  );
}

export function AvatarButton() {
  const { session } = useAuth();
  const router = useRouter();
  const accent = useAccent();
  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';
  const initial = name.charAt(0).toUpperCase();
  return (
    <Pressable onPress={() => router.push('/profile')} hitSlop={8} accessibilityLabel="Profile">
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text size="headline" style={{ color: '#FFFFFF' }}>
          {initial}
        </Text>
      </View>
    </Pressable>
  );
}
