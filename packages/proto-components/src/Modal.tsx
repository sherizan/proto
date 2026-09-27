import { Modal as RNModal, Platform, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type ModalProps = {
  title: string;
  visible: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

/**
 * Apple's own bottom sheet (SwiftUI `sheet` with a grabber), sized to its content.
 * onClose fires on swipe-dismiss and on programmatic close.
 */
export function Modal({ title, visible, onClose, children }: ModalProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const body = (
    // ponytail: the hosted RN view is measured in both axes, so it gets the window width by hand
    // (sheets are edge to edge on iPhone; on iPad this over-measures and the sheet clips).
    <View style={{ width, padding: theme.space.lg, paddingBottom: theme.space.xl, gap: theme.space.md }}>
      <Text size="headline">{title}</Text>
      {children}
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <Host matchContents>
        <BottomSheet
          isPresented={visible}
          onIsPresentedChange={(open) => {
            if (!open) onClose?.();
          }}
          fitToContents
        >
          <Group modifiers={[presentationDragIndicator('visible')]}>
            <RNHostView matchContents>{body}</RNHostView>
          </Group>
        </BottomSheet>
      </Host>
    );
  }

  // ponytail: iOS-first product; Android keeps the page sheet.
  return (
    <RNModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.primary }} edges={['bottom']}>
        {body}
      </SafeAreaView>
    </RNModal>
  );
}
