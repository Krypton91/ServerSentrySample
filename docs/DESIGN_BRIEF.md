# Website design brief

Copy this brief and fill it in. Give it to your developer or AI coding assistant
together with this source repository. Write "use the sample default" where you
have no preference.

## Community and content

- Community name:
- Audience and games:
- Website language:
- Main action visitors should take:
- Required pages and navigation order:
- Landing page sections and copy:
- Community invite URL, or leave hidden:
- Logo and artwork files you own or may use:
- Public references and the specific design details you like:

## Visual direction

- Style and mood:
- Colors and light/dark appearance:
- Typography; use local/system fonts unless supplied:
- Layout density and spacing:
- Mobile navigation:
- Animations and reduced-motion requirements:
- Things to avoid:

## Backend configuration

- Preview with demo data or a configured staging backend:
- Public data provider: ServerSentry or CFTools:
- Displayed server IDs, or all published servers:
- Preferred leaderboard metrics:
- Store layout and variant selector preference:
- Product/variant examples to test, without credentials:
- Buyer fields, gifts and Discord delivery examples:
- Terms and Privacy configured in Landing settings: yes/no:

Set the staging origin in local `.env.local`, not in committed source. Configure
actual prices, billing, permissions, legal content and automation in ServerSentry.
Never include credentials, private player data or payment secrets in this brief.

## Acceptance criteria

- Required design details:
- Devices or viewport sizes to check:
- Accessibility requirements beyond keyboard and visible focus support:
- Performance or asset-size constraints:
- Required staging checks:
- Optional enhancements:

Preserve clean routes, refresh and browser history, sign-in returns,
backend-owned checkout validation, explicit data availability states and labeled
non-transactional demo mode. Run the checks in `AGENTS.md` and report anything
that could not be verified.
