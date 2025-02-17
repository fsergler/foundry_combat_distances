class CombatDistances {
    static ID = 'combat-distances';
    
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
        // Register settings first
        this.registerSettings();
        
        Hooks.on('renderTokenHUD', this.onRenderTokenHUD.bind(this));
        Hooks.on('updateToken', this.onUpdateToken.bind(this));
        Hooks.on('deleteToken', this.onDeleteToken.bind(this));
    }

    static registerSettings() {
        game.settings.register(this.ID, 'ranges', {
            name: 'Range Distances',
            hint: 'Set the distance for each combat distance (in feet/units)',
            scope: 'world',
            config: false,
            type: Object,
            default: this.DEFAULTS.ranges,
            onChange: () => {
                // Refresh all existing rings when settings change
                canvas.tokens.placeables.forEach(token => {
                    if (this.hasRings(token.id)) {
                        this.removeRings(token.id);
                        this.createRings(token);
                    }
                });
            }
        });

        game.settings.registerMenu(this.ID, 'rangeConfig', {
            name: 'Configure Combat Ranges',
            label: 'Configure Combat Ranges',
            hint: 'Configure the distances for each combat range',
            icon: 'fas fa-circle-dot',
            type: CombatDistancesConfig,
            restricted: true
        });

        // Add the reset button
        game.settings.registerMenu(this.ID, 'resetDefaults', {
            name: 'Reset to Defaults',
            label: 'Reset to Defaults',
            hint: 'Reset all combat ranges to their default values',
            icon: 'fas fa-undo',
            type: CombatDistancesReset,
            restricted: true
        });
    }

    // Update the ranges getter to only use current settings
    static get ranges() {
        // Get only the saved ranges, don't merge with defaults
        return game.settings.get(this.ID, 'ranges');
    }

    static onRenderTokenHUD(hud, html, tokenData) {
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

        html.find('div.left').append(button);
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

        const rings = Object.entries(this.ranges).map(([rangeKey, rangeData], index) => {
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
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                ring.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            } else {
                ring.style.borderColor = color.replace(')', ', 0.5)').replace('rgb', 'rgba');
            }

            // Add label
            const label = document.createElement('span');
            label.classList.add('range-label');
            // Always format the distance to 1 decimal place
            const formattedDistance = rangeData.distance.toFixed(1);
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
        token.document.setFlag(this.ID, 'hasRings', true);
    }

    static removeRings(tokenId) {
        const token = canvas.tokens.get(tokenId);
        if (!token) {
            // If token doesn't exist, just remove the rings
            const rings = document.querySelectorAll(`.range-ring[data-token-id="${tokenId}"]`);
            rings.forEach(ring => ring.remove());
            return;
        }

        // Remove only rings associated with this token
        const rings = document.querySelectorAll(`.range-ring[data-token-id="${tokenId}"]`);
        rings.forEach(ring => ring.remove());
        
        token.document.setFlag(this.ID, 'hasRings', false);
    }

    static hasRings(tokenId) {
        const token = canvas.tokens.get(tokenId);
        return token?.document?.getFlag(this.ID, 'hasRings') ?? false;
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

            // Update only this token's rings positions
            const rings = document.querySelectorAll(`.range-ring[data-token-id="${token.id}"]`);
            rings.forEach(ring => {
                ring.style.left = `${tokenCenter.x}px`;
                ring.style.top = `${tokenCenter.y}px`;
            });
        }
    }

    static onDeleteToken(tokenDocument) {
        // Remove rings when token is deleted
        // Use the tokenDocument's ID directly since the token might already be deleted
        const rings = document.querySelectorAll(`.range-ring[data-token-id="${tokenDocument.id}"]`);
        rings.forEach(ring => ring.remove());
    }
}

// Add the configuration form
class CombatDistancesConfig extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: 'Combat Distances Configuration',
            id: 'combat-distances-config',
            template: `modules/${CombatDistances.ID}/templates/config.html`,
            width: 400,
            height: 'auto',
            resizable: true,  // Allow manual resizing
            minimizable: true,
            closeOnSubmit: true
        });
    }

    // Add this method to handle dynamic resizing
    setPosition(options = {}) {
        // Get the current position
        const position = super.setPosition(options);
        
        // Get the window and content elements
        const window = this.element[0];
        const content = window.querySelector('.window-content');
        
        // Calculate the content height
        const contentHeight = content.scrollHeight;
        
        // Set a minimum height of 200px and maximum of 80vh
        const maxHeight = Math.floor(window.ownerDocument.defaultView.innerHeight * 0.8);
        const newHeight = Math.min(Math.max(contentHeight + 50, 200), maxHeight);
        
        // Update the height if it's different
        if (newHeight !== position.height) {
            position.height = newHeight;
            this.element.css({height: newHeight});
        }
        
        return position;
    }

    // Add this method to handle resizing when rings are added/removed
    _onResize() {
        this.setPosition();
    }

    getData(options={}) {
        // For the config form, we still want to merge with defaults for new installations
        const savedRanges = game.settings.get(CombatDistances.ID, 'ranges');
        const ranges = Object.keys(savedRanges).length === 0 
            ? this.constructor.DEFAULTS.ranges 
            : savedRanges;
        
        // Format all distances to show one decimal place
        Object.values(ranges).forEach(range => {
            range.distance = parseFloat(range.distance).toFixed(1);
        });
        
        return {
            ranges: ranges
        };
    }

    static get DEFAULTS() {
        return {
            ranges: {
                ring1: {
                    distance: 2.0,  // Updated to show intention of decimal
                    label: "Close",
                    color: "#ff0000" // Red
                },
                ring2: {
                    distance: 4.0,
                    label: "Short",
                    color: "#ffa500" // Orange
                },
                ring3: {
                    distance: 6.0,
                    label: "Medium",
                    color: "#ffff00" // Yellow
                },
                ring4: {
                    distance: 8.0,
                    label: "Long",
                    color: "#90ee90" // Light green
                },
                ring5: {
                    distance: 10.0,
                    label: "Extreme",
                    color: "#00ff00" // Green
                }
            }
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('#add-ring').click(this._onAddRing.bind(this));
        html.find('.remove-ring').click(this._onRemoveRing.bind(this));
    }

    _onAddRing(event) {
        event.preventDefault();
        const ringsList = this.element.find('#combat-distances-list');
        const ringCount = ringsList.children().length + 1;
        
        // Set default color to black for rings after the first 5
        const defaultColor = ringCount <= 5 
            ? this.constructor.DEFAULTS.ranges[`ring${ringCount}`]?.color || '#000000'
            : '#000000';
        
        const newRing = $(`
            <div class="ring-entry" data-ring-id="ring${ringCount}">
                <div class="form-group">
                    <div class="form-fields">
                        <input type="text" name="ring${ringCount}.label" placeholder="Label"/>
                        <input type="number" name="ring${ringCount}.distance" placeholder="Distance" step="0.1" value="${(ringCount * 2).toFixed(1)}"/>
                        <input type="color" name="ring${ringCount}.color" value="${defaultColor}" title="Ring Color"/>
                        <button type="button" class="remove-ring">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `);

        ringsList.append(newRing);
        newRing.find('.remove-ring').click(this._onRemoveRing.bind(this));
        
        this._onResize();
    }

    _onRemoveRing(event) {
        event.preventDefault();
        const ringEntry = $(event.currentTarget).closest('.ring-entry');
        ringEntry.remove();
        this._reorderRings();
        
        // Immediately save the changes
        const formData = this._getSubmitData();
        this._updateObject(event, formData).then(() => {
            // After saving, refresh all tokens that have rings
            canvas.tokens.placeables.forEach(token => {
                if (CombatDistances.hasRings(token.id)) {
                    CombatDistances.removeRings(token.id);
                    CombatDistances.createRings(token);
                }
            });
        });
        
        this._onResize();
    }

    _reorderRings() {
        const rings = this.element.find('.ring-entry');
        rings.each((index, ring) => {
            const newId = `ring${index + 1}`;
            $(ring).attr('data-ring-id', newId);
            $(ring).find('input[type="text"]').attr('name', `${newId}.label`);
            $(ring).find('input[type="number"]').attr('name', `${newId}.distance`);
            $(ring).find('input[type="color"]').attr('name', `${newId}.color`);
        });
    }

    async _updateObject(event, formData) {
        const ranges = {};
        const entries = this.element.find('.ring-entry');
        
        entries.each((index, entry) => {
            const ringId = $(entry).attr('data-ring-id');
            const distance = Math.max(0, parseFloat(formData[`${ringId}.distance`]) || (index + 1) * 2);
            
            ranges[ringId] = {
                label: formData[`${ringId}.label`] || `Ring ${index + 1}`,
                // Store the distance as a number but ensure it has 1 decimal place for display
                distance: parseFloat(distance.toFixed(1)),
                color: formData[`${ringId}.color`] || (index < 5 
                    ? this.constructor.DEFAULTS.ranges[`ring${index + 1}`]?.color 
                    : '#000000')
            };
        });

        await game.settings.set(CombatDistances.ID, 'ranges', ranges);
        ui.notifications.info('Combat distance settings have been updated.');
    }
}

// Add this new class after the CombatDistancesConfig class
class CombatDistancesReset extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: 'Reset Combat Distances',
            id: 'combat-distances-reset',
            template: `modules/${CombatDistances.ID}/templates/reset.html`,
            width: 400,
            height: 'auto',
            classes: ['dialog'],
            closeOnSubmit: true
        });
    }

    async _updateObject(event, formData) {
        await game.settings.set(CombatDistances.ID, 'ranges', CombatDistances.DEFAULTS.ranges);
        ui.notifications.info('Combat distances have been reset to default values.');
        
        // Refresh all existing rings
        canvas.tokens.placeables.forEach(token => {
            if (CombatDistances.hasRings(token.id)) {
                CombatDistances.removeRings(token.id);
                CombatDistances.createRings(token);
            }
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('button[name="cancel"]').click(this.close.bind(this));
    }
}

Hooks.once('init', () => {
    CombatDistances.initialize();
});
