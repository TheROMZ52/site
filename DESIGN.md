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

## Premium Game Hub
- The Game Hub is a production catalog surface, not a generic game-card gallery.
- Game cards use broad tactical panels, a thin command bar, subtle diagonal field markings, and restrained depth on hover.
- Status, action, focus, disabled and reduced-motion states are part of the component language; unavailable Multiplayer actions stay visibly secondary and explain their state.
- The hub intro carries the page thesis while a compact operational status rail communicates the current state of available titles.
- Mobile game browsing collapses to a single-column mode stack without changing action order or meaning.

## Community features
- Public member cards are **profiles, not ranks**. Rank remains an internal account property and is never rendered on the public profile surface.
- The members page is a **Squad Directory**: a compact operational hero, total/online/game counts, search, game filter, online/offline filter, sorting, result count, and a reset action.
- Public member cards show avatar, username, favorite games, short bio, join date when available, and live presence. Cards open the focused member profile.
- Clicking a member opens a focused profile view with avatar, games, join date, optional bio/social link, and that member's achievements.
- Achievements are stored per member and shown newest-first inside the profile view; staff can add/edit/delete them.
- Staff controls stay in the directory but remain visually secondary: add member, edit/delete member, and guest-account management.
- News and announcements are first-class content with `news`, `announcement`, and `event` categories plus optional pinning.
- The homepage surfaces the latest three news items; the dedicated `/news` page is the full archive and exposes publishing controls to staff.

## Background treatment
- Site pages use the KillZone background image as a shared atmospheric layer.
- The background is intentionally softened with a modest fixed blur, darkening and saturation reduction so content remains the visual priority.
- Content surfaces use their own translucent blur/glass treatment; the effect must stay subtle and tactical rather than becoming a generic glassmorphism theme.

## Join workflow
The account-creation page is separate from team membership. Team membership is requested through a dedicated `join.html` page. A submitted application becomes a ticket with a two-way conversation. Developers, co-owners, and owners can review all applications; applicants can see and reply to only their own ticket.

## Accessibility / behavior
Use semantic controls, visible focus, keyboard-friendly navigation, reduced-motion support, stable loading/error states, and responsive layouts. Keep the existing site shell and terminology consistent across pages. Search controls must have a clear action, filters must be operable by keyboard/touch, and empty filter results must explain how to recover.
