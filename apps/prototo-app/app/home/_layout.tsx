import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { View } from 'react-native';
import { useAccent } from 'proto-components';
import { ClipboardPrompt } from '../../components/ClipboardPrompt';

// Native Liquid Glass tab bar — the system pill is the real thing. Scan takes
// the search-role slot, which iOS 26 renders SEPARATED from the pill (exactly
// the detached thumb-zone action we mocked, but system-made). The app-open
// clipboard prompt overlays everything.
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
        <NativeTabs.Trigger name="scan" role="search">
          <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" md="qr_code_scanner" />
          <NativeTabs.Trigger.Label>Scan</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      <ClipboardPrompt />
    </View>
  );
}
