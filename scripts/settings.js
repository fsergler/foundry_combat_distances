export default {
    registerKeybindings() {
        game.keybindings.register(this.ID, 'toggleRings', {
            name: 'Toggle Combat Distances',
            hint: 'Toggle combat distance rings on the selected token(s)',
            editable: [{ key: 'KeyG', modifiers: [] }],
            onDown: () => {
                const controlled = canvas.tokens?.controlled ?? [];
                if (controlled.length === 0) return;
                const currentRanges = game.settings.get(this.ID, 'ranges');
                if (Object.keys(currentRanges).length === 0) {
                    ui.notifications.warn('No combat distances are configured. Please configure distances in the module settings.');
                    return;
                }
                for (const token of controlled) {
                    if (this.hasRings(token.id)) {
                        this.removeRings(token.id);
                    } else {
                        this.createRings(token);
                    }
                }
            },
            precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
        });
    },

    registerSettings() {
        const refreshActiveRings = () => {
            try {
                if (canvas && canvas.tokens && canvas.tokens.placeables && canvas.ready) {
                    canvas.tokens.placeables.forEach(token => {
                        if (this.hasRings(token.id)) {
                            this.removeRings(token.id);
                            this.createRings(token);
                        }
                    });
                }
            } catch (error) {
                console.warn('CombatDistances: Error in onChange handler:', error);
            }
        };

        game.settings.register(this.ID, 'ranges', {
            name: 'Range Distances',
            hint: 'Set the distance for each combat distance (in feet/units)',
            scope: 'client',
            config: false,
            type: Object,
            default: this.DEFAULTS.ranges,
            onChange: refreshActiveRings
        });

        game.settings.register(this.ID, 'gridShading', {
            name: 'Grid Cell Shading',
            hint: 'Highlight grid cells within each combat distance band. "Full cells only" shades cells entirely inside a ring\'s radius. "Include partial" also shades cells the ring edge passes through.',
            scope: 'client',
            config: true,
            type: String,
            choices: {
                'none': 'None',
                'full': 'Full cells only',
                'partial': 'Include partial cells'
            },
            default: 'none',
            onChange: refreshActiveRings
        });
    }
};
