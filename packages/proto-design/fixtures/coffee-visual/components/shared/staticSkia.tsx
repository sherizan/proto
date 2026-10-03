import { useEffect, useState } from 'react';
import { drawAsPicture, Skia } from '@shopify/react-native-skia';
import type { ReactElement } from 'react';

const cache = new Map<string, Promise<string | null>>();

function renderArt(element: ReactElement, width: number, height: number) {
  return drawAsPicture(element).then((picture) => {
    const surface = Skia.Surface.Make(width, height);
    try {
      if (!surface) return null;
      surface.getCanvas().drawPicture(picture);
      surface.flush();
      const snapshot = surface.makeImageSnapshot();
      try {
        const encoded = snapshot.encodeToBase64();
        return encoded ? 'data:image/png;base64,' + encoded : null;
      } finally {
        snapshot.dispose();
      }
    } finally {
      surface?.dispose();
      picture.dispose();
    }
  }).catch(() => null);
}

export function useStaticSkia(key: string, element: ReactElement, width: number, height: number, enabled = true) {
  const [result, setResult] = useState<{ key: string; source: string | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending = cache.get(key);
    if (!pending) {
      if (cache.size >= 6) cache.delete(cache.keys().next().value!);
      pending = renderArt(element, width, height);
      cache.set(key, pending);
    }
    pending.then((source) => { if (active) setResult({ key, source }); });
    return () => { active = false; };
  }, [key, width, height, enabled]);
  return enabled && result?.key === key ? result.source : null;
}
