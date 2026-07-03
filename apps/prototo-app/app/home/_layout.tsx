import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function HomeLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="square.stack.3d.up.fill" md="dashboard" />
        <NativeTabs.Trigger.Label>My Prototypes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shared">
        <NativeTabs.Trigger.Icon sf="tray.and.arrow.down.fill" md="inbox" />
        <NativeTabs.Trigger.Label>Shared</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
