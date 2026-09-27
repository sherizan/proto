import { useEffect } from 'react';
import { Alert as RNAlert, Platform } from 'react-native';
import { Alert as SwiftUIAlert, Button as SwiftUIButton, Host, Text as SwiftUIText } from '@expo/ui/swift-ui';
import { frame, opacity } from '@expo/ui/swift-ui/modifiers';

export type AlertAction = {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  cancel?: boolean;
};

export type AlertProps = {
  title: string;
  message?: string;
  visible: boolean;
  onClose?: () => void;
  actions: AlertAction[];
};

const roleOf = (action: AlertAction) =>
  action.destructive ? 'destructive' : action.cancel ? 'cancel' : undefined;

/**
 * Apple's own alert. Controlled by `visible`; onClose fires after any action or dismiss.
 */
export function Alert({ title, message, visible, onClose, actions }: AlertProps) {
  useEffect(() => {
    if (Platform.OS === 'ios' || !visible) return;
    // ponytail: iOS-first product; Android uses the system alert, which closes itself.
    RNAlert.alert(
      title,
      message,
      actions.map((action) => ({
        text: action.label,
        style: roleOf(action) ?? 'default',
        onPress: () => {
          action.onPress?.();
          onClose?.();
        },
      })),
      { onDismiss: onClose },
    );
  }, [visible]);

  if (Platform.OS !== 'ios') return null;

  return (
    <Host matchContents>
      <SwiftUIAlert
        title={title}
        isPresented={visible}
        onIsPresentedChange={(open) => {
          if (!open) onClose?.();
        }}
      >
        {/* ponytail: SwiftUI hangs the alert off a trigger view; an invisible one keeps it controlled by `visible`. */}
        <SwiftUIAlert.Trigger>
          <SwiftUIText modifiers={[frame({ width: 0, height: 0 }), opacity(0)]}> </SwiftUIText>
        </SwiftUIAlert.Trigger>
        {message ? (
          <SwiftUIAlert.Message>
            <SwiftUIText>{message}</SwiftUIText>
          </SwiftUIAlert.Message>
        ) : null}
        <SwiftUIAlert.Actions>
          {actions.map((action) => (
            <SwiftUIButton
              key={action.label}
              label={action.label}
              role={roleOf(action)}
              onPress={action.onPress}
            />
          ))}
        </SwiftUIAlert.Actions>
      </SwiftUIAlert>
    </Host>
  );
}
