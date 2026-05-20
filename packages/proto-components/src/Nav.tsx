import { Platform, Pressable, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useTheme, useAccent } from './useTheme';
import { Text } from './Text';

export type NavTab = {
  icon: string;
  label: string;
  screen: string;
};

export type NavProps = {
  tabs: NavTab[];
  active?: string;
  onSelect?: (screen: string) => void;
};

export function Nav({ tabs, active, onSelect }: NavProps) {
  const theme = useTheme();
  const accent = useAccent();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderTopWidth: 1,
        borderTopColor: theme.border.default,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.screen === active;
        return (
          <Pressable
            key={tab.screen}
            onPress={() => onSelect?.(tab.screen)}
            style={{ flex: 1, alignItems: 'center', gap: 2 }}
          >
            <Text size="label" style={{ color: isActive ? accent : theme.text.secondary }}>
              {tab.icon}
            </Text>
            <Text size="caption" style={{ color: isActive ? accent : theme.text.secondary }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (theme.blur.nav > 0) {
    return (
      <BlurView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        // blurType placeholder — Android tuning lands in Phase 2.
        blurType={Platform.OS === 'ios' ? 'light' : 'light'}
        blurAmount={theme.blur.nav}
        reducedTransparencyFallbackColor={theme.surface.nav}
      >
        {content}
      </BlurView>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.surface.nav,
      }}
    >
      {content}
    </View>
  );
}
