export default {
    onRenderSettingsConfig(_app, html) {
        const root = html instanceof HTMLElement ? html : html[0];
        // Target the right-panel content section, not the left-panel nav item
        const moduleSection = root?.querySelector(`section[data-tab="${this.ID}"]`)
                           ?? root?.querySelector(`.tab[data-tab="${this.ID}"]`);
        if (!moduleSection) return;

        const ranges = game.settings.get(this.ID, 'ranges');
        const sortedEntries = Object.entries(ranges).sort(([, a], [, b]) => a.distance - b.distance);
        const rowsHTML = sortedEntries.map(([id, range]) => this._ringRowHTML(id, range)).join('');

        moduleSection.insertAdjacentHTML('beforeend', `
            <div class="form-group stacked" id="cd-ranges-group">
                <label>Combat Distance Rings</label>
                <div id="combat-distances-list">${rowsHTML}</div>
                <div style="display:flex; gap:5px; margin-top:6px;">
                    <button type="button" id="cd-add-ring">
                        <i class="fas fa-plus"></i> Add Distance
                    </button>
                    <button type="button" id="cd-reset-defaults">
                        <i class="fas fa-undo"></i> Reset Defaults
                    </button>
                </div>
            </div>
        `);

        moduleSection.querySelector('#cd-add-ring').addEventListener('click', (e) => {
            e.preventDefault();
            const list = moduleSection.querySelector('#combat-distances-list');
            const count = list.children.length + 1;
            list.insertAdjacentHTML('beforeend', this._ringRowHTML(`ring${count}`, { label: '', distance: 0, color: '#000000' }));
            this._attachRemoveListeners(moduleSection);
        });

        moduleSection.querySelector('#cd-reset-defaults').addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmed = await foundry.applications.api.Dialog.confirm({
                title: 'Reset Combat Distances',
                content: '<p>Reset all rings to default values? This cannot be undone.</p>',
                yes: { label: 'Yes', callback: () => true },
                no: { label: 'No', callback: () => false },
                default: 'no'
            });
            if (!confirmed) return;
            const list = moduleSection.querySelector('#combat-distances-list');
            list.innerHTML = Object.entries(this.DEFAULTS.ranges)
                .map(([id, range]) => this._ringRowHTML(id, range))
                .join('');
            this._attachRemoveListeners(moduleSection);
        });

        this._attachRemoveListeners(moduleSection);

        // Save rings when the settings form is submitted
        const form = root.closest('form') ?? root.querySelector('form');
        form?.addEventListener('submit', () => this._saveRangesFromSettingsPanel(moduleSection));

        // GM-only: push settings to player(s)
        if (game.user.isGM) {
            const players = game.users.filter(u => !u.isGM);
            const playerOptions = players.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
            moduleSection.insertAdjacentHTML('beforeend', `
                <div class="form-group" id="cd-gm-push-group">
                    <label>Push Settings to Player</label>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <select id="cd-push-target" style="flex:1;">
                            <option value="all">All players</option>
                            ${playerOptions}
                        </select>
                        <button type="button" id="cd-push-btn">
                            <i class="fas fa-share"></i> Push
                        </button>
                    </div>
                    <p class="hint">Overwrite the selected player's ring configuration with your current settings.</p>
                </div>
            `);

            moduleSection.querySelector('#cd-push-btn').addEventListener('click', (e) => {
                e.preventDefault();
                const userId = moduleSection.querySelector('#cd-push-target').value;
                game.socket.emit(`module.${this.ID}`, {
                    type: 'pushSettings',
                    userId,
                    ranges: game.settings.get(this.ID, 'ranges'),
                    gridShading: game.settings.get(this.ID, 'gridShading')
                });
                ui.notifications.info(`Combat distance settings pushed to ${userId === 'all' ? 'all players' : game.users.get(userId)?.name}.`);
            });
        }
    },

    _ringRowHTML(id, range) {
        const dist = (parseFloat(range.distance) || 0).toFixed(1);
        return `
            <div class="ring-entry" data-ring-id="${id}" style="display:flex; gap:5px; align-items:center; padding:3px 0;">
                <input type="text"   name="${id}.label"    value="${range.label  ?? ''}"   placeholder="Label"    style="flex:4;" />
                <input type="number" name="${id}.distance" value="${dist}"                  step="0.1" min="0"    style="flex:1;" />
                <input type="color"  name="${id}.color"    value="${range.color  ?? '#000000'}"                  style="flex: 0 0 80px; height:28px;" />
                <button type="button" class="remove-ring" style="flex: 0 0 auto;"><i class="fas fa-trash"></i></button>
            </div>
        `;
    },

    _attachRemoveListeners(moduleSection) {
        moduleSection.querySelectorAll('.remove-ring').forEach(btn => {
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', (e) => {
                e.preventDefault();
                fresh.closest('.ring-entry').remove();
            });
        });
    },

    _saveRangesFromSettingsPanel(moduleSection) {
        const ranges = {};
        moduleSection.querySelectorAll('.ring-entry').forEach((entry, index) => {
            const id = `ring${index + 1}`;
            ranges[id] = {
                label:    entry.querySelector('input[type="text"]')?.value?.trim()  || `Ring ${index + 1}`,
                distance: parseFloat((parseFloat(entry.querySelector('input[type="number"]')?.value) || 0).toFixed(1)),
                color:    entry.querySelector('input[type="color"]')?.value || '#000000'
            };
        });
        game.settings.set(this.ID, 'ranges', ranges);
    }
};
