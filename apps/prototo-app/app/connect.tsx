import { useRouter } from 'expo-router';
import { Scanner } from '../components/Scanner';

// Pushed scanner (deep links like prototo://connect, and the desktop QR flow
// docs point here). The in-tab scanner lives at home/scan.
export default function Connect() {
  const router = useRouter();
  return <Scanner active showCancel onCancel={() => router.back()} />;
}
