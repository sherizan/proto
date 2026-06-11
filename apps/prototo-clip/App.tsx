import type { Manifest } from '@sherizan/proto-manifest';
import { ManifestRenderer } from '@sherizan/proto-renderer';
import demo from './manifests/demo.json';

// Parent app and App Clip share this bundle (react-native-app-clip). Both render
// the bundled demo manifest natively via proto-components — no code crosses the
// wire (Apple Guideline 2.5.2). In Phase F the clip fetches the manifest by token
// from prototo.app/p/<token>; for now it is bundled in.
export default function App() {
  return <ManifestRenderer manifest={demo as unknown as Manifest} />;
}
