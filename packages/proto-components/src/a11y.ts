/**
 * Accessibility floors for native iOS prototypes. Small, fixed values that don't
 * belong to a theme — they hold across light/dark and every palette.
 */
export const a11y = {
  /** Apple's Human Interface minimum for a comfortable tap target, in points. */
  minTapTarget: 44,
  /** WCAG AA contrast floor for normal-size text (foreground vs background). */
  minTextContrast: 4.5,
  /** WCAG AA contrast floor for large text (≥ 24pt, or 19pt bold). */
  minLargeTextContrast: 3,
} as const;
