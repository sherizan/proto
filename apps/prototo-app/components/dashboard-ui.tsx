import { Pressable, View } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Button, Card, Row, Stack, Text } from 'proto-components';
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
      onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
    />
  );
}
