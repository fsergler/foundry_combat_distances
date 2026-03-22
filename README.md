# Combat Distances for Foundry VTT

Foundry VTT module that displays configurable combat distance rings around tokens for easy distance measurement during combat.

## Features

- Toggle button on the token HUD for showing/hiding combat distance rings
- Hotkey (`G`) to toggle rings on selected token(s)
- Fully configurable per-player rings with customizable distances, labels, and colors
- Grid cell shading to highlight which cells fall within each range band
- Dynamic ring and cell updates when tokens move
- Rings are local-only — toggling only affects your own view

## Usage

### Toggling rings

1. Select any token on the map (GM can select all tokens)
2. Click the combat distances icon (circle dot) in the token HUD, or press `G`
3. Rings appear around the token, visible only to you

### Configuring rings

1. Go to **Game Settings → Module Settings → Combat Distances**
2. Add, remove, or edit rings directly on the settings page
3. Each ring has a label, distance (in scene units), and color
4. **Grid Cell Shading** can be set to *None*, *Full cells only*, or *Include partial cells*

### GM: pushing settings to players

1. Configure your rings in Module Settings
2. Click **Save Changes**
3. Use the **Push Settings to Player** section to send your configuration to a specific player or all players at once

## Support

For bugs, feature requests, or support, please [create an issue](https://github.com/fsergler/foundry_combat_distances/issues) on the GitHub repository.
