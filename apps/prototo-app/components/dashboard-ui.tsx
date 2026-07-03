import { Pressable, View } from 'react-native';
import { Button, Card, Row, Stack, Text, useTheme } from 'proto-components';
import type { ReactNode } from 'react';

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

// iOS-style segmented control (in-screen "tab view"). Native @expo/ui Picker's build
// path wouldn't resolve, so this is a small themed control instead.
export function Segmented({
  options,
  index,
  onChange,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.surface.card, borderRadius: 10, padding: 3 }}>
      {options.map((opt, i) => {
        const selected = i === index;
        return (
          <Pressable key={opt} onPress={() => onChange(i)} style={{ flex: 1 }}>
            <View
              style={{
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: selected ? theme.surface.primary : 'transparent',
                boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.12)' : undefined,
              }}
            >
              <Text size="label" style={{ color: selected ? theme.text.primary : theme.text.secondary }}>
                {opt}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
