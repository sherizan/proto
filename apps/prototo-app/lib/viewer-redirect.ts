import * as Linking from 'expo-linking';

const DEV_CLIENT_URL_PREFIX = 'prototo://expo-development-client/?url=';

export function buildDevClientUrl(tunnelUrl: string): string {
  return `${DEV_CLIENT_URL_PREFIX}${encodeURIComponent(tunnelUrl)}`;
}

export type LinkingShim = {
  openURL: (url: string) => Promise<boolean | void>;
};

export type RedirectOptions = {
  linking?: LinkingShim;
};

const defaultLinking: LinkingShim = {
  openURL: (url: string) => Linking.openURL(url),
};

export async function redirectToDevClient(
  tunnelUrl: string,
  opts: RedirectOptions = {},
): Promise<void> {
  const linking = opts.linking ?? defaultLinking;
  const url = buildDevClientUrl(tunnelUrl);
  await linking.openURL(url);
}
