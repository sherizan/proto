import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type ScreenProps = {
  title?: string;
  scrollable?: boolean;
  children?: ReactNode;
};

export function Screen({ title, scrollable = true, children }: ScreenProps) {
  const theme = useTheme();
  const Body = scrollable ? ScrollView : View;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.surface.primary }}
      edges={['top', 'left', 'right']}
    >
      {title ? (
        <View style={{ paddingHorizontal: theme.space.md, paddingTop: theme.space.md, paddingBottom: theme.space.sm }}>
          <Text size="title">{title}</Text>
        </View>
      ) : null}
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={
          scrollable
            ? { padding: theme.space.md, gap: theme.space.md }
            : undefined
        }
      >
        {scrollable ? children : <View style={{ flex: 1, padding: theme.space.md }}>{children}</View>}
      </Body>
    </SafeAreaView>
  );
}
