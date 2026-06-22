/** Parse the `code` from an OAuth redirect URL (query first, then fragment). */
export function extractOAuthCode(redirectUrl: string): string | null {
  try {
    const url = new URL(redirectUrl);
    const fromQuery = url.searchParams.get('code');
    if (fromQuery) return fromQuery;
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
    return new URLSearchParams(hash).get('code');
  } catch {
    return null;
  }
}

/** Translate an auth error into designer-friendly copy. Never surface raw messages. */
export function authErrorMessage(error: unknown): string {
  const obj = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  const message = String(obj.message ?? error ?? '').toLowerCase();
  const status = typeof obj.status === 'number' ? obj.status : undefined;

  if (status === 429 || message.includes('rate') || message.includes('too many')) {
    return 'Too many tries. Wait a moment and try again.';
  }
  if (message.includes('expired') || message.includes('invalid') || message.includes('token')) {
    return "That code didn't work. Check it and try again, or resend.";
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
