# KillZone Design Context

## Visual identity
- **Mood:** dark, tactical, block-built gaming team; warm industrial surfaces rather than neon cyberpunk.
- **Palette:** ink `#1c1a16`, panel `#262119`, panel-2 `#2e281e`, line `#4a4030`, ember `#e2672c`, grass `#5c7d3c`, paper `#f1ead9`, paper-dim `#a89e88`.
- **Typography:** Vazirmatn for Persian UI; Press Start 2P for compact KILLZONE / tier accents.
- **Shape language:** squared cards, restrained 3px accent edges, thin warm borders, minimal radii.

## Join workflow
The account-creation page is separate from team membership. Team membership is requested through a dedicated `join.html` page. A submitted application becomes a ticket with a two-way conversation. Developers, co-owners, and owners can review all applications; applicants can see and reply to only their own ticket.

## Signature
The membership flow uses a tactical "ticket dossier" treatment: the application reads like a field file, then transitions into a compact message thread for review and follow-up.

## Accessibility / behavior
Use semantic controls, visible focus, keyboard-friendly navigation, reduced-motion support, stable loading/error states, and responsive layouts. Keep the existing site shell and terminology consistent across pages.
