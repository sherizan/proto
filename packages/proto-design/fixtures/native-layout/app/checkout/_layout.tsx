import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ProtoConfigProvider } from '../../components/proto';
import config from '../../constants/warm.json';
export default function Layout(){return <ProtoConfigProvider config={config}><NativeTabs><NativeTabs.Trigger name="menu"><NativeTabs.Trigger.Icon sf="cup.and.saucer.fill"/><NativeTabs.Trigger.Label>Menu</NativeTabs.Trigger.Label></NativeTabs.Trigger><NativeTabs.Trigger name="orders"><NativeTabs.Trigger.Icon sf="receipt"/><NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label></NativeTabs.Trigger></NativeTabs></ProtoConfigProvider>}
