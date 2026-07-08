import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Scanner } from '../../components/Scanner';

// The separated native tab (search-role slot on the iOS 26 Liquid Glass bar,
// repurposed as Scan). Camera runs only while this tab is focused.
export default function ScanTab() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return <Scanner active={focused} clearTabBar />;
}
