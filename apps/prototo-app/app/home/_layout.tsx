import { Stack } from 'expo-router';
import { View } from 'react-native';
import { HomeBar } from '../../components/HomeBar';
import { ClipboardPrompt } from '../../components/ClipboardPrompt';

export default function HomeLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      <HomeBar />
      <ClipboardPrompt />
    </View>
  );
}
