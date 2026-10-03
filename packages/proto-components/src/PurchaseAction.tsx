import { useWindowDimensions } from 'react-native';
import { Stack } from './Stack';
import { Row } from './Row';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from './useTheme';

export type PurchaseActionProps = {
  total: string;
  detail?: string;
  label?: string;
  disabled?: boolean;
  onPress?: () => void;
};

// Formatting and price arithmetic stay in the caller's model. The action repeats
// its current total without delaying it for animation or inventing cart state.
export function PurchaseAction({ total, detail, label = 'Checkout', disabled, onPress }: PurchaseActionProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <Stack gap={theme.space.sm}>
      {fontScale > 1.3 ? (
        <Stack gap={theme.space.xs}>
          {detail ? <Text size="caption" color="secondary">{detail}</Text> : null}
          <Text size="headline">{total}</Text>
        </Stack>
      ) : (
        <Row align="center" gap={theme.space.sm} style={{ justifyContent: 'space-between' }}>
          <Stack style={{ flex: 1 }}>{detail ? <Text size="caption" color="secondary">{detail}</Text> : null}</Stack>
          <Text size="headline">{total}</Text>
        </Row>
      )}
      <Button label={label} onPress={onPress} disabled={disabled} />
    </Stack>
  );
}
