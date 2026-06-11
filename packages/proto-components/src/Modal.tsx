import { Modal as RNModal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type ModalProps = {
  title: string;
  visible: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

/**
 * Modal presented as iOS 26's native page sheet (UISheetPresentationController):
 * native spring-in, backdrop dim, the screen behind receding, and swipe-to-dismiss
 * — no hand-rolled overlay. onClose fires on both the swipe-dismiss (onRequestClose)
 * and programmatic close.
 */
export function Modal({ title, visible, onClose, children }: ModalProps) {
  const theme = useTheme();
  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.primary }} edges={['bottom']}>
        <View style={{ flex: 1, padding: theme.space.lg, gap: theme.space.md }}>
          <Text size="headline">{title}</Text>
          {children}
        </View>
      </SafeAreaView>
    </RNModal>
  );
}
