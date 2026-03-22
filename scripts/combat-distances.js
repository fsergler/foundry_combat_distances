class CombatDistances {
    static ID = 'combat-distances';
    static _activeRings = new Set(); // token IDs with rings visible locally
    
    static DEFAULTS = {
        ranges: {
            ring1: {
                distance: 2,
                label: "Close",
                color: "#ff0000" // Red
            },
            ring2: {
                distance: 4,
                label: "Short",
                color: "#ffa500" // Orange
            },
            ring3: {
                distance: 6,
                label: "Medium",
                color: "#ffff00" // Yellow
            },
            ring4: {
                distance: 8,
                label: "Long",
                color: "#90ee90" // Light green
            },
            ring5: {
                distance: 10,
                label: "Extreme",
                color: "#00ff00" // Green
            }
        }
    };

    static initialize() {
        // Pre-load templates
        loadTemplates([`modules/${this.ID}/templates/config.html`]);

        // Register settings first
        this.registerSettings();
        this.registerKeybindings();

        Hooks.on('renderTokenHUD', this.onRenderTokenHUD.bind(this));
        Hooks.on('updateToken', this.onUpdateToken.bind(this));
        Hooks.on('deleteToken', this.onDeleteToken.bind(this));
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

    static registerKeybindings() {
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
    }

    static registerSettings() {
        game.settings.register(this.ID, 'ranges', {
            name: 'Range Distances',
            hint: 'Set the distance for each combat distance (in feet/units)',
            scope: 'client',
            config: false,
            type: Object,
            default: this.DEFAULTS.ranges,
            onChange: () => {
                // Refresh all existing rings when settings change
                // Only do this if canvas and tokens are available and we're not in the middle of a reset
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
            }
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
            onChange: () => {
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
                    console.warn('CombatDistances: Error in gridShading onChange handler:', error);
                }
            }
        });

    }

    // Update the ranges getter to only use current settings
    static get ranges() {
        // Get only the saved ranges, don't merge with defaults
        return game.settings.get(this.ID, 'ranges');
    }

    static onRenderTokenHUD(_hud, html, tokenData) {
        const button = $(`
            <div class="control-icon" title="Toggle Combat Distances">
                <i class="fas fa-circle-dot"></i>
            </div>
        `);

        // Get the actual token object
        const token = canvas.tokens.get(tokenData._id);
        
        // Add the active state if rings are currently shown
        if (this.hasRings(token.id)) {
            button.addClass('active');
        }

        // Add click handler
        button.click(async (event) => {
            event.preventDefault();
            // Get current ranges from settings
            const currentRanges = game.settings.get(this.ID, 'ranges');
            
            if (this.hasRings(token.id)) {
                this.removeRings(token.id);
                button.removeClass('active');
            } else if (Object.keys(currentRanges).length > 0) {
                // Only create rings if there are ranges defined
                this.createRings(token);
                button.addClass('active');
            } else {
                // Notify user if no ranges are defined
                ui.notifications.warn('No combat distances are configured. Please configure distances in the module settings.');
            }
        });

        $(html).find('div.left').append(button);
    }

    static createRings(token) {
        // Get current ranges from settings
        const currentRanges = game.settings.get(this.ID, 'ranges');
        
        // If no ranges are configured, don't create any rings
        if (Object.keys(currentRanges).length === 0) {
            ui.notifications.warn('No combat distances are configured. Please configure distances in the module settings.');
            return;
        }

        const tokenCenter = {
            x: token.x + (token.w / 2),
            y: token.y + (token.h / 2)
        };

        this.removeRings(token.id);

        const sortedEntries = Object.entries(this.ranges).sort(([, a], [, b]) => a.distance - b.distance);
        const shadingMode = game.settings.get(this.ID, 'gridShading');

        // Append fill cells first so they render beneath the ring circles
        if (shadingMode !== 'none') {
            sortedEntries.forEach(([rangeKey, rangeData], index) => {
                const prevDistance = index > 0 ? sortedEntries[index - 1][1].distance : 0;
                this.createGridHighlights(token, rangeKey, rangeData, prevDistance, tokenCenter);
            });
        }

        const rings = sortedEntries.map(([rangeKey, rangeData], index) => {
            // Convert distance from feet to grid units
            const gridDistance = rangeData.distance / canvas.scene.grid.distance;
            
            // Calculate diameter in pixels
            const diameter = gridDistance * 2 * canvas.grid.size;
            
            const ring = document.createElement('div');
            ring.dataset.tokenId = token.id;
            ring.classList.add('range-ring', rangeKey);
            ring.style.width = `${diameter}px`;
            ring.style.height = `${diameter}px`;
            ring.style.left = `${tokenCenter.x}px`;
            ring.style.top = `${tokenCenter.y}px`;
            
            // Apply custom color with opacity
            let color = rangeData.color;
            if (!color) {
                // Fallback to default color if none is set
                // Use black for rings beyond the first 5
                color = index < 5 
                    ? this.DEFAULTS.ranges[rangeKey]?.color || '#000000'
                    : '#000000';
            }
            
            // Convert hex color to rgba
            if (color && color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                ring.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            } else if (color) {
                ring.style.borderColor = color.replace(')', ', 0.5)').replace('rgb', 'rgba');
            } else {
                // Final fallback to black if color is still null/undefined
                ring.style.borderColor = 'rgba(0, 0, 0, 0.5)';
            }

            // Add label
            const label = document.createElement('span');
            label.classList.add('range-label');
            // Always format the distance to 1 decimal place, ensuring it's a number first
            const distance = parseFloat(rangeData.distance) || 0;
            const formattedDistance = distance.toFixed(1);
            label.textContent = `${rangeData.label} (${formattedDistance}')`;
            ring.appendChild(label);

            return ring;
        });

        const container = document.getElementById('combat-distances-container') || document.getElementById('hud');
        if (!container) {
            const hudElement = document.createElement('div');
            hudElement.id = 'combat-distances-container';
            document.body.appendChild(hudElement);
        }
        
        rings.forEach(ring => container.appendChild(ring));
        this._activeRings.add(token.id);
    }

    static createGridHighlights(token, rangeKey, rangeData, prevDistance, center = null) {
        const mode = game.settings.get(this.ID, 'gridShading');
        if (mode === 'none') return;

        const gridSize = canvas.grid.size;
        const gridDistance = canvas.scene.grid.distance;
        const maxRadiusPx = (rangeData.distance / gridDistance) * gridSize;
        const prevRadiusPx = (prevDistance / gridDistance) * gridSize;

        const tokenCenter = center ?? {
            x: token.x + token.w / 2,
            y: token.y + token.h / 2
        };

        // Parse ring color to rgba fill
        const color = rangeData.color || '#000000';
        let fillColor = 'rgba(0, 0, 0, 0.15)';
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            fillColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
        }

        const container = document.getElementById('hud');
        if (!container) return;

        // canvas.grid.type is the authoritative numeric type (0=gridless, 1=square, 2-5=hex)
        const isSquare = canvas.grid.type === 1;
        const maxCells = Math.ceil(maxRadiusPx / gridSize) + 1;
        const tokenGridPos = canvas.grid.getOffset({ x: tokenCenter.x, y: tokenCenter.y });

        for (let di = -maxCells; di <= maxCells; di++) {
            for (let dj = -maxCells; dj <= maxCells; dj++) {
                const cellOffset = { i: tokenGridPos.i + di, j: tokenGridPos.j + dj };
                const cellPos = canvas.grid.getTopLeftPoint(cellOffset);

                // Get the points to check for this cell
                let checkPoints;
                if (isSquare) {
                    checkPoints = [
                        { x: cellPos.x,           y: cellPos.y },
                        { x: cellPos.x + gridSize, y: cellPos.y },
                        { x: cellPos.x + gridSize, y: cellPos.y + gridSize },
                        { x: cellPos.x,           y: cellPos.y + gridSize }
                    ];
                } else {
                    // Hex: use center + shape vertices (vertices are relative to cell center)
                    const hexCenter = canvas.grid.getCenterPoint(cellOffset);
                    const shape = canvas.grid.getShape();
                    const pts = shape?.points;
                    if (pts?.length) {
                        checkPoints = [];
                        for (let k = 0; k + 1 < pts.length; k += 2) {
                            checkPoints.push({ x: hexCenter.x + pts[k], y: hexCenter.y + pts[k + 1] });
                        }
                    } else {
                        // Fallback: approximate hex with 6 points on a circle
                        const r = gridSize / 2;
                        checkPoints = Array.from({ length: 6 }, (_, i) => ({
                            x: hexCenter.x + r * Math.cos(i * Math.PI / 3),
                            y: hexCenter.y + r * Math.sin(i * Math.PI / 3)
                        }));
                    }
                }

                const dists = checkPoints.map(p => Math.hypot(p.x - tokenCenter.x, p.y - tokenCenter.y));

                const inMaxRing = mode === 'full'
                    ? dists.every(d => d <= maxRadiusPx)
                    : dists.some(d => d <= maxRadiusPx);
                const inPrevRing = prevRadiusPx > 0 && dists.every(d => d <= prevRadiusPx);

                if (inMaxRing && !inPrevRing) {
                    const cell = document.createElement('div');
                    cell.classList.add('range-fill-cell', rangeKey);
                    cell.dataset.tokenId = token.id;
                    cell.style.left = `${cellPos.x}px`;
                    cell.style.top = `${cellPos.y}px`;
                    cell.style.width = `${gridSize}px`;
                    cell.style.height = `${gridSize}px`;
                    cell.style.backgroundColor = fillColor;
                    container.appendChild(cell);
                }
            }
        }
    }

    static removeRings(tokenId) {
        const token = canvas.tokens.get(tokenId);
        if (!token) {
            document.querySelectorAll(`.range-ring[data-token-id="${tokenId}"], .range-fill-cell[data-token-id="${tokenId}"]`)
                .forEach(el => el.remove());
            return;
        }

        // Remove rings and fill cells associated with this token
        document.querySelectorAll(`.range-ring[data-token-id="${tokenId}"], .range-fill-cell[data-token-id="${tokenId}"]`)
            .forEach(el => el.remove());
        
        this._activeRings.delete(tokenId);
    }

    static hasRings(tokenId) {
        return this._activeRings.has(tokenId);
    }

    static onUpdateToken(tokenDocument, changes) {
        const token = canvas.tokens.get(tokenDocument.id);
        if (!token || !this.hasRings(token.id)) return;

        // Check if position changed
        if ('x' in changes || 'y' in changes) {
            const tokenCenter = {
                x: (changes.x ?? token.x) + (token.w / 2),
                y: (changes.y ?? token.y) + (token.h / 2)
            };

            // Reposition ring circles (fast path — just update CSS)
            const rings = document.querySelectorAll(`.range-ring[data-token-id="${token.id}"]`);
            rings.forEach(ring => {
                ring.style.left = `${tokenCenter.x}px`;
                ring.style.top = `${tokenCenter.y}px`;
            });

            // Recreate fill cells (they depend on absolute canvas-grid alignment)
            document.querySelectorAll(`.range-fill-cell[data-token-id="${token.id}"]`).forEach(el => el.remove());
            const shadingMode = game.settings.get(this.ID, 'gridShading');
            if (shadingMode !== 'none') {
                const sortedEntries = Object.entries(game.settings.get(this.ID, 'ranges'))
                    .sort(([, a], [, b]) => a.distance - b.distance);
                sortedEntries.forEach(([rangeKey, rangeData], index) => {
                    const prevDistance = index > 0 ? sortedEntries[index - 1][1].distance : 0;
                    this.createGridHighlights(token, rangeKey, rangeData, prevDistance, tokenCenter);
                });
            }
        }
    }

    static onDeleteToken(tokenDocument) {
        // Remove rings when token is deleted
        // Use the tokenDocument's ID directly since the token might already be deleted
        const rings = document.querySelectorAll(`.range-ring[data-token-id="${tokenDocument.id}"]`);
        rings.forEach(ring => ring.remove());
        this._activeRings.delete(tokenDocument.id);
    }

    // --- Settings panel injection ---

    static onRenderSettingsConfig(_app, html) {
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
    }

    static _ringRowHTML(id, range) {
        const dist = (parseFloat(range.distance) || 0).toFixed(1);
        return `
            <div class="ring-entry" data-ring-id="${id}" style="display:flex; gap:5px; align-items:center; padding:3px 0;">
                <input type="text"   name="${id}.label"    value="${range.label  ?? ''}"   placeholder="Label"    style="flex:4;" />
                <input type="number" name="${id}.distance" value="${dist}"                  step="0.1" min="0"    style="flex:1;" />
                <input type="color"  name="${id}.color"    value="${range.color  ?? '#000000'}"                  style="flex: 0 0 80px; height:28px;" />
                <button type="button" class="remove-ring" style="flex: 0 0 auto;"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }

    static _attachRemoveListeners(moduleSection) {
        moduleSection.querySelectorAll('.remove-ring').forEach(btn => {
            const fresh = btn.cloneNode(true);
            btn.replaceWith(fresh);
            fresh.addEventListener('click', (e) => {
                e.preventDefault();
                fresh.closest('.ring-entry').remove();
            });
        });
    }

    static _saveRangesFromSettingsPanel(moduleSection) {
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
}


Hooks.once('init', () => {
    CombatDistances.initialize();
});
