# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **Foundry VTT module** (`combat-distances`) that displays configurable combat distance rings around tokens. Targets Foundry VTT v13+. No build step required — plain JavaScript loaded directly as an ES module.

## Development

To develop, symlink or copy this repo into Foundry's `Data/modules/combat-distances/` directory, enable it in a world, and reload Foundry (F5) after edits. There is no build system, no npm, and no tests.

## Architecture

`scripts/combat-distances.js` is the sole entry point (see [scripts/CLAUDE.md](scripts/CLAUDE.md)).

The module registers settings on `init`, hooks into token lifecycle events (`renderTokenHUD`, `updateToken`, `deleteToken`), and draws PIXI-based ring graphics directly onto each `Token`'s canvas display. Ring configurations are persisted via `game.settings` under the namespace `combat-distances`.

`module.json` is the Foundry manifest — the `id` field (`combat-distances`) doubles as the settings namespace throughout the code and must match the directory name.
