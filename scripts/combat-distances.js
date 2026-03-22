import settingsMethods    from './settings.js';
import ringsMethods       from './rings.js';
import tokenEventsMethods from './token-events.js';
import panelMethods       from './settings-panel.js';

class CombatDistances {
    static ID = 'combat-distances';
    static _activeRings = new Set(); // token IDs with rings visible locally

    static DEFAULTS = {
        ranges: {
            ring1: { distance: 2,  label: 'Close',   color: '#ff0000' },
            ring2: { distance: 4,  label: 'Short',   color: '#ffa500' },
            ring3: { distance: 6,  label: 'Medium',  color: '#ffff00' },
            ring4: { distance: 8,  label: 'Long',    color: '#90ee90' },
            ring5: { distance: 10, label: 'Extreme', color: '#00ff00' }
        }
    };

    static get ranges() {
        return game.settings.get(this.ID, 'ranges');
    }

    static initialize() {
        loadTemplates([`modules/${this.ID}/templates/config.html`]);

        this.registerSettings();
        this.registerKeybindings();

        Hooks.on('renderTokenHUD',     this.onRenderTokenHUD.bind(this));
        Hooks.on('updateToken',        this.onUpdateToken.bind(this));
        Hooks.on('deleteToken',        this.onDeleteToken.bind(this));
        Hooks.on('renderSettingsConfig', this.onRenderSettingsConfig.bind(this));

        Hooks.once('ready', () => {
            game.socket.on(`module.${this.ID}`, (data) => {
                if (data.type !== 'pushSettings') return;
                if (data.userId !== 'all' && data.userId !== game.user.id) return;
                game.settings.set(this.ID, 'ranges', data.ranges);
                game.settings.set(this.ID, 'gridShading', data.gridShading);
                ui.notifications.info('Your combat distance settings have been updated by the GM.');
            });
        });
    }
}

Object.assign(CombatDistances, settingsMethods, ringsMethods, tokenEventsMethods, panelMethods);

Hooks.once('init', () => {
    CombatDistances.initialize();
});
