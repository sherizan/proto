import { Modal as RNModal, Pressable, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { Text } from './Text';

export type ModalProps = {
  title: string;
  visible: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

export function Modal({ title, visible, onClose, children }: ModalProps) {
  const theme = useTheme();
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            marginTop: 'auto',
            backgroundColor: theme.surface.primary,
            borderTopLeftRadius: theme.radius.modal,
            borderTopRightRadius: theme.radius.modal,
            padding: theme.space.lg,
            gap: theme.space.md,
          }}
        >
          <Text size="headline">{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
