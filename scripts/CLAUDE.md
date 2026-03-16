# scripts/CLAUDE.md

## combat-distances.js

Single file with two classes:

### `CombatDistances`
Core module class. Key responsibilities:
- `registerSettings()` — registers `ranges` setting (object keyed by ring name, each with `distance`, `label`, `color`)
- `toggleRings(token)` — draws or removes all rings for a token based on HUD button toggle state
- `drawRings(token)` / `removeRings(token)` — PIXI canvas operations attached to the token's display hierarchy
- `defaultRanges()` — returns 5 default rings: Close (2ft), Short (4ft), Medium (6ft), Long (8ft), Extreme (10ft)

### `CombatDistancesConfig`
Extends Foundry's `ApplicationV2` (v13 API). Renders `templates/config.html` for adding/removing/editing rings. `_prepareContext()` feeds current settings into the template; form submission updates `game.settings`.
