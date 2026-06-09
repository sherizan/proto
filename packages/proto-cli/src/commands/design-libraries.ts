export type LibraryId =
  | 'proto'
  | 'tamagui'
  | 'gluestack'
  | 'react-native-paper'
  | 'nativewind'
  | 'custom';

export const LIBRARY_IDS: LibraryId[] = [
  'proto',
  'tamagui',
  'gluestack',
  'react-native-paper',
  'nativewind',
  'custom',
];

export type LibrarySubpath = {
  name: string;
  importFrom: string;
  purpose: string;
};

export type LibraryDescriptor = {
  kind: 'builtin' | 'known' | 'custom';
  label: string;
  designPackage: string;
  importFrom: string;
  installPackage: string | null;
  docs?: string;
  fallback: 'proto';
  subpaths?: LibrarySubpath[];
};

const KNOWN: Record<Exclude<LibraryId, 'custom'>, LibraryDescriptor> = {
  proto: {
    kind: 'builtin',
    label: 'Proto (built-in)',
    designPackage: 'proto (built-in)',
    importFrom: '../components/proto',
    installPackage: null,
    fallback: 'proto',
    subpaths: [
      {
        name: 'motion',
        importFrom: '../components/proto/motion',
        purpose: 'declarative transitions, preferred for animations',
      },
      {
        name: 'gestures',
        importFrom: '../components/proto/gestures',
        purpose: 'drag / scroll / shared-value animations',
      },
      {
        name: 'lottie',
        importFrom: '../components/proto/lottie',
        purpose: 'timeline animations from /assets/lottie/',
      },
      {
        name: 'canvas',
        importFrom: '../components/proto/canvas',
        purpose: 'custom drawing',
      },
      {
        name: 'svg',
        importFrom: '../components/proto/svg',
        purpose: 'vector shapes and .svg files',
      },
    ],
  },
  tamagui: {
    kind: 'known',
    label: 'Tamagui',
    designPackage: '@tamagui/core',
    importFrom: '@tamagui/core',
    installPackage: '@tamagui/core',
    docs: 'https://tamagui.dev/docs/components',
    fallback: 'proto',
  },
  gluestack: {
    kind: 'known',
    label: 'Gluestack UI',
    designPackage: '@gluestack-ui/themed',
    importFrom: '@gluestack-ui/themed',
    installPackage: '@gluestack-ui/themed',
    docs: 'https://ui.gluestack.io/docs',
    fallback: 'proto',
  },
  'react-native-paper': {
    kind: 'known',
    label: 'React Native Paper',
    designPackage: 'react-native-paper',
    importFrom: 'react-native-paper',
    installPackage: 'react-native-paper',
    docs: 'https://callstack.github.io/react-native-paper',
    fallback: 'proto',
  },
  nativewind: {
    kind: 'known',
    label: 'NativeWind',
    designPackage: 'nativewind',
    importFrom: 'nativewind',
    installPackage: 'nativewind',
    docs: 'https://www.nativewind.dev/docs',
    fallback: 'proto',
  },
};

export function getLibrary(id: Exclude<LibraryId, 'custom'>): LibraryDescriptor {
  return KNOWN[id];
}

export type CustomLibraryInput = {
  packageName: string;
  docs?: string;
};

export function resolveCustomLibrary(input: CustomLibraryInput): LibraryDescriptor {
  return {
    kind: 'custom',
    label: input.packageName,
    designPackage: input.packageName,
    importFrom: input.packageName,
    installPackage: input.packageName,
    docs: input.docs,
    fallback: 'proto',
  };
}
