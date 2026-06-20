export type AppleFullName = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
};

/** Apple only returns the user's name on the FIRST sign-in. Join the parts it gave us. */
export function formatAppleFullName(fullName: AppleFullName | null | undefined): string {
  if (!fullName) return '';
  return [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');
}

/** Map an Apple sign-in failure to designer-facing copy. Cancellation shows nothing. */
export function appleSignInErrorMessage(code: string | undefined): string {
  if (code === 'ERR_REQUEST_CANCELED') return '';
  return "Couldn't sign in with Apple. Please try again.";
}
