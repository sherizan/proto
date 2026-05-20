import { useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '../../../components/proto';

export default function DynamicScreen() {
  const params = useLocalSearchParams<{ screen?: string[] }>();
  const name = params.screen?.[0] ?? 'Home';

  let Component: React.ComponentType | null = null;
  try {
    Component = require(`../../../screens/${name}`).default;
  } catch {
    Component = null;
  }

  if (!Component) {
    return (
      <Screen title="Not found">
        <Text size="body">No screen named "{name}" yet.</Text>
      </Screen>
    );
  }

  return <Component />;
}
