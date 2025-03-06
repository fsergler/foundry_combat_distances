# Combat Distances for Foundry VTT

Foundry VTT module that displays configurable combat distances around tokens for easy distance measurement during combat.

## Features

- Adds a toggle button to the token HUD for displaying combat distances
- Fully configurable combat distances with customizable:
  - Distances (supports decimal values)
  - Labels
  - Colors
- Dynamic ring updates when tokens move
- Support for multiple rings per token
- Visual distance indicators with labels

## Usage

### Basic Usage

1. Select any token on the map
2. Click the combat distances icon (circle) in the token HUD
3. Combat distances will appear around the selected token

### Configuring Combat Distances

1. Go to Game Settings > Configure Settings > Module Settings
2. Find "Combat Distances" and click "Configure Ranges"
3. In the configuration window you can:
   - Add new rings using the "Add Ring" button
   - Remove existing rings using the trash can icon
   - Modify ring properties:
     - Label: The name of the range (e.g., "Close", "Medium", "Far")
     - Distance: The range in feet/units (supports decimal values like 2.5 or 7.5)
     - Color: The color of the ring

## Support

For bugs, feature requests, or support, please [create an issue](https://github.com/fsergler/foundry_combat_distances/issues) on the GitHub repository.
