import { Pressable, View } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { SymbolView } from 'expo-symbols';
import { Button, Card, Row, Stack, Text, useTheme } from 'proto-components';
import type { ReactNode } from 'react';

export function OpenButton({ onPress }: { onPress: () => void }) {
  return <Button label="Open" variant="primary" onPress={onPress} />;
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

// Status/instruction messages (loading, empty states, "publish to see prototypes") — an info card.
export function InfoCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <Row gap={8} style={{ alignItems: 'center' }}>
        <SymbolView name="info.circle" size={18} tintColor={theme.text.secondary} />
        <Text size="body" color="secondary" style={{ flex: 1 }}>
          {children}
        </Text>
      </Row>
    </Card>
  );
}

// Native iOS UISegmentedControl (in-screen "tab view").
export function Segmented({
  options,
  index,
  onChange,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <SegmentedControl
      values={options}
      selectedIndex={index}
      style={{ height: 40 }}
      fontStyle={{ fontSize: 15 }}
      activeFontStyle={{ fontSize: 15, fontWeight: '600' }}
      onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
    />
  );
}
