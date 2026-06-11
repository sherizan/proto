import { isClip } from 'react-native-app-clip';

// One Expo app, two iOS targets sharing this bundle. The App Clip renders a
// shared prototype manifest natively; the full viewer app boots expo-router.
// react-native-app-clip's isClip() tells the two apart at runtime.
if (isClip()) {
  const { registerRootComponent } = require('expo');
  registerRootComponent(require('./ClipApp').default);
} else {
  require('expo-router/entry');
}
