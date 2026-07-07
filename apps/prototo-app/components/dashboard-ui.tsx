import { Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Card, Row, Stack, Text, useAccent, useTheme } from 'proto-components';

export function TapCard({
  title,
  caption,
  badge,
  onPress,
}: {
  title: string;
  caption?: string;
  badge?: string;
  onPress: () => void;
}) {
  const accent = useAccent();
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Stack gap={4}>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <Text size="headline">{title}</Text>
                {badge ? (
                  <View
                    style={{
                      backgroundColor: `${accent}1F`,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text size="label" color="accent">
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </Row>
              {caption ? (
                <Text size="caption" color="secondary">
                  {caption}
                </Text>
              ) : null}
            </Stack>
          </View>
          <SymbolView name="chevron.right" size={14} tintColor={theme.text.secondary} />
        </Row>
      </Card>
    </Pressable>
  );
}
