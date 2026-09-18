import { Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Card, Row, Stack, Text, useAccent, useTheme } from 'proto-components';

export function TapCard({
  title,
  caption,
  badge,
  muted = false,
  onPress,
}: {
  title: string;
  caption?: string;
  badge?: string;
  muted?: boolean;
  onPress: () => void;
}) {
  const accent = useAccent();
  const theme = useTheme();
  // text.secondary is an rgba() string, so the muted pill uses a surface token.
  const badgeBackground = muted ? theme.surface.secondary : `${accent}1F`;
  return (
    <Pressable onPress={onPress} style={{ opacity: muted ? 0.55 : 1 }}>
      <Card>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Stack gap={4}>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <Text size="headline">{title}</Text>
                {badge ? (
                  <View
                    style={{
                      backgroundColor: badgeBackground,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text size="label" color={muted ? 'secondary' : 'accent'}>
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
