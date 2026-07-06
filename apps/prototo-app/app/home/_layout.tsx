import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAccent } from 'proto-components';

export default function HomeLayout() {
  const accent = useAccent();
  return (
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
  );
}
