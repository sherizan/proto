/**
 * Marks a value as placeholder/mock data — not yet wired to a real source.
 *
 * It's an identity function: it returns exactly what you pass in, so wrapping
 * a value changes nothing at runtime. Its job is to make stubbed data obvious
 * at a glance (and greppable) so it's never shipped believing it's real. When
 * the value gets wired to a live source, drop the `mock()` wrapper.
 *
 *   const conditions = mock({ wave: '0.8m', wind: '8 km/h' });
 */
export function mock<T>(value: T): T {
  return value;
}
