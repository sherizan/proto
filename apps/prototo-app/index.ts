import { isClip } from 'react-native-app-clip';

// One Expo app, two iOS targets sharing this bundle. The App Clip renders a
// shared prototype manifest natively; the full app boots the expo-router dev
// client. react-native-app-clip's isClip() tells the two apart at runtime.
if (isClip()) {
  const { registerRootComponent } = require('expo');
  registerRootComponent(require('./ClipApp').default);
} else {
  require('expo-router/entry');
}
