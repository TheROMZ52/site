# KillZone Design Context

## Visual identity
- **Mood:** dark, tactical, block-built gaming team; warm industrial surfaces rather than neon cyberpunk.
- **Palette:** ink `#10100e`, surface `#191812`, surface-2 `#211f18`, stroke `#3b362a`, strong-stroke `#59503e`, ember `#df6330`, green `#728b4b`, text `#f4eddc`, muted `#a59b86`.
- **Typography:** Vazirmatn for Persian UI; Press Start 2P for compact KILLZONE / utility accents.
- **Shape language:** wide editorial surfaces, squared cards, restrained radii, thin warm borders, clipped tactical accents on selected game surfaces.

## Layout system
- Desktop content uses a wide `1440px` canvas so pages do not read like narrow receipts.
- Home hero uses a two-zone composition: large brand/content field plus a compact vertical operational stats rail.
- Games and member views use broad grids and horizontal breathing room instead of narrow centered cards.
- Registration, membership and account workflows use full-width surfaces while preserving readable field groupings.
- Mobile collapses deliberately to one-column layouts with touch-sized controls.

## Motion language
- Motion is tactical and restrained: short upward reveals, subtle slide-ins, modal lift-in, hover elevation and a slow squad-presence pulse.
- The homepage reveal is orchestrated rather than every element constantly moving; animation communicates arrival and hierarchy, not decoration.
- Loading uses a restrained shimmer instead of fake progress.
- `prefers-reduced-motion: reduce` disables non-essential animation and hover transforms.

## Signature
The site is styled as a KillZone field console: broad dark surfaces, an ember/orange command accent, subtle tactical grid texture, and small machine-like labels. The homepage's stats rail is the primary composition signature; it should remain quiet while the content carries the hierarchy.

## Join workflow
The account-creation page is separate from team membership. Team membership is requested through a dedicated `join.html` page. A submitted application becomes a ticket with a two-way conversation. Developers, co-owners, and owners can review all applications; applicants can see and reply to only their own ticket.

## Accessibility / behavior
Use semantic controls, visible focus, keyboard-friendly navigation, reduced-motion support, stable loading/error states, and responsive layouts. Keep the existing site shell and terminology consistent across pages.
