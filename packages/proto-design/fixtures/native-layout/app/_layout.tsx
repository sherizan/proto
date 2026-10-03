import { Stack } from 'expo-router';
import TouchDots from '../components/proto/touch-dots';
export default function Layout() { return <TouchDots><Stack screenOptions={{headerShown:false}}><Stack.Screen name="detail" options={{headerShown:true,title:"Coffee details"}}/></Stack></TouchDots>; }
