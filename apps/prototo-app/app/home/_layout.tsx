import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { View } from 'react-native';
import { useAccent } from 'proto-components';
import { ScanFab } from '../../components/HomeBar';
import { ClipboardPrompt } from '../../components/ClipboardPrompt';

// Native Liquid Glass tab bar (the system pill is the real thing) + our two
// overlays: the accent scan FAB and the app-open clipboard prompt.
export default function HomeLayout() {
  const accent = useAccent();
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={accent}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="square.stack.3d.up.fill" md="dashboard" />
          <NativeTabs.Trigger.Label>Prototypes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="person" />
          <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      <ScanFab />
      <ClipboardPrompt />
    </View>
  );
}
