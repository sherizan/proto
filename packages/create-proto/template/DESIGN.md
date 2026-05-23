# DESIGN.md

> {{APP_NAME}}'s design system. These are starting defaults — change anything by prompting Claude.
>
> Examples:
> - `update DESIGN.md, change accent to indigo`
> - `double the spacing scale`
> - `use SF Pro Rounded for headlines`
> - `add a brand purple to the palette`
>
> Last updated: {{DATE}}

## App
- Name: {{APP_NAME}}
- Platform: iOS

## Tokens

### Accent
#007AFF (iOS system blue)

### Type
iOS system font with dynamic type defaults. Override per-size below if you need custom sizing.

### Spacing
xs 4 · sm 8 · md 16 · lg 24 · xl 32

### Surface
- iOS 26+: Apple Liquid Glass via `expo-glass-effect`
- iOS < 26 + Android: system blur via `expo-blur`

(Add your own tokens below as you describe what you want. Claude rewrites this file as the design system evolves.)

## Screens
- Home — welcome screen with tutorial prompts
