import { Alert as RNAlert, Platform } from 'react-native';
import { Host, Menu as SwiftUIMenu, Button as SwiftUIButton } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { useAccent } from './useTheme';
import { Button, type SFSymbol } from './Button';

export type MenuItem = {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  systemImage?: SFSymbol;
};

export type MenuProps = {
  label: string;
  systemImage?: SFSymbol;
  items: MenuItem[];
};

/**
 * Apple's own pull-down menu: a button that opens a list of actions.
 */
export function Menu({ label, systemImage, items }: MenuProps) {
  const accent = useAccent();

  if (Platform.OS !== 'ios') {
    // ponytail: iOS-first product; Android lists the actions in a system alert.
    return (
      <Button
        label={label}
        variant="ghost"
        onPress={() =>
          RNAlert.alert(
            label,
            undefined,
            items.map((item) => ({
              text: item.label,
              onPress: item.onPress,
              style: item.destructive ? 'destructive' : 'default',
            })),
          )
        }
      />
    );
  }

  return (
    <Host matchContents>
      <SwiftUIMenu label={label} systemImage={systemImage} modifiers={[tint(accent)]}>
        {items.map((item) => (
          <SwiftUIButton
            key={item.label}
            label={item.label}
            systemImage={item.systemImage}
            role={item.destructive ? 'destructive' : undefined}
            onPress={item.onPress}
          />
        ))}
      </SwiftUIMenu>
    </Host>
  );
}
