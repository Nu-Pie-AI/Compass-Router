# M25 Design System

## Standardized tokens

The existing Compass palette remains the base system: green accent, neutral light surfaces, semantic warning/error colors, and dark product surfaces. M25 adds dark console tokens for background, surface, foreground, muted text, borders, and accent-soft states.

## Interaction standards

- Theme switching is an icon control with an accessible label and tooltip.
- Existing `:focus-visible` styling remains active and is preserved for the new control.
- Existing buttons, cards, tables, dialogs, empty states, and responsive breakpoints remain in place.
- Theme preference is stored in `localStorage` under `compass.console.theme`.
- No new frontend dependency was added.

## Accessibility

Dark utility panels now inherit readable foreground/muted text and border colors rather than retaining white light-theme surfaces. The toggle is keyboard reachable and exposes its next action through `aria-label` and `title`.
