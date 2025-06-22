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

        game.settings.registerMenu(this.ID, 'rangeConfig', {
            name: 'Configure Combat Ranges',
            label: 'Configure Combat Ranges',
            hint: 'Configure the distances for each combat range',
            icon: 'fas fa-circle-dot',
            type: CombatDistancesConfig,
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
class CombatDistancesConfig extends foundry.applications.api.ApplicationV2 {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: 'Combat Distances Configuration',
            id: 'combat-distances-config',
            template: `modules/${CombatDistances.ID}/templates/config.html`,
            width: 400,
            height: 500,
            resizable: true,  // Allow manual resizing
            minimizable: true,
            closeOnSubmit: true
        });
    }

    constructor(options) {
        super(options);
        this._debouncedRender = foundry.utils.debounce(this.render.bind(this), 100);
    }

    // Required V2 Application methods
    async _renderHTML(data) {
        const templatePath = `modules/${CombatDistances.ID}/templates/config.html`;
        const html = await foundry.applications.handlebars.renderTemplate(templatePath, data);
        return html;
    }

    _replaceHTML(element, html) {
        // In V2 Application framework, the parameters are swapped:
        // element = the HTML content (string)
        // html = the DOM element to replace
        if (typeof element === 'string' && html && html.innerHTML !== undefined) {
            // element is the HTML content, html is the DOM element
            html.innerHTML = element;
        } else if (typeof html === 'string' && element && element.innerHTML !== undefined) {
            // html is the HTML content, element is the DOM element
            element.innerHTML = html;
        } else {
            // Fallback: try to set innerHTML on the application's main element
            if (this.element && this.element[0]) {
                this.element[0].innerHTML = typeof element === 'string' ? element : html;
            }
        }
    }

    async _prepareContext(options) {
        // For the config form, we still want to merge with defaults for new installations
        const savedRanges = game.settings.get(CombatDistances.ID, 'ranges');
        const ranges = Object.keys(savedRanges).length === 0
            ? this.constructor.DEFAULTS.ranges
            : savedRanges;

        // Ensure all distances are numbers and add display formatting
        Object.values(ranges).forEach(range => {
            const distance = parseFloat(range.distance) || 0;
            range.distance = distance; // Keep as number
            range.distanceDisplay = distance.toFixed(1); // Add display property
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

    async render(force, options) {
        console.log("CombatDistancesConfig: render() called.");
        try {
            await super.render(force, options);
            console.log("CombatDistancesConfig: super.render() completed successfully.");
            
            // Set up event listeners after render is complete with a small delay
            setTimeout(() => {
                this._setupEventListeners();
            }, 100);
        } catch(e) {
            console.error("CombatDistancesConfig: An error occurred during the render process.", e);
        }
        return this;
    }

    _setupEventListeners() {
        console.log('CombatDistancesConfig: Setting up event listeners');
        
        if (!this.element) {
            console.error('CombatDistancesConfig: No element found');
            return;
        }

        // Ensure we have a jQuery object
        const $element = $(this.element);
        console.log('CombatDistancesConfig: Element type:', typeof this.element, this.element);
        
        const addButton = $element.find('#add-ring');
        const removeButtons = $element.find('.remove-ring');
        const form = $element.find('form');
        const resetButton = $element.find('#reset-defaults');
        
        console.log('CombatDistancesConfig: Found elements:', {
            addButton: addButton.length,
            removeButtons: removeButtons.length,
            form: form.length,
            resetButton: resetButton.length
        });

        // Remove any existing listeners first
        addButton.off('click');
        removeButtons.off('click');
        form.off('submit');
        resetButton.off('click');

        // Add new listeners
        addButton.on('click', this._onAddRing.bind(this));
        removeButtons.on('click', this._onRemoveRing.bind(this));
        form.on('submit', this._onSubmit.bind(this));
        resetButton.on('click', this._onResetDefaults.bind(this));
        
        console.log('CombatDistancesConfig: Event listeners attached');
    }

    _onSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);
        this._updateObject(event, data);
    }

    _onAddRing(event) {
        console.log('CombatDistancesConfig: _onAddRing called');
        event.preventDefault();
        const $element = $(this.element);
        const ringsList = $element.find('#combat-distances-list');
        const ringCount = ringsList.children().length + 1;
        
        console.log('CombatDistancesConfig: Adding ring', ringCount);
        
        const newRing = $(`
            <div class="ring-entry" data-ring-id="ring${ringCount}">
                <div class="form-group">
                    <div class="form-fields">
                        <div class="form-fields-row">
                            <input type="text" name="ring${ringCount}.label" placeholder="Label"/>
                            <input type="number" name="ring${ringCount}.distance" placeholder="Distance" step="0.1" value="0.0"/>
                        </div>
                        <div class="form-fields-inline">
                            <input type="color" name="ring${ringCount}.color" value="#000000" title="Ring Color"/>
                            <button type="button" class="remove-ring">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        ringsList.append(newRing);
        
        // Re-setup all event listeners to include the new remove button
        this._setupEventListeners();
        
        console.log('CombatDistancesConfig: Ring added successfully');
    }

    _onRemoveRing(event) {
        console.log('CombatDistancesConfig: _onRemoveRing called');
        event.preventDefault();
        const ringEntry = $(event.currentTarget).closest('.ring-entry');
        ringEntry.remove();
        this._reorderRings();
        
        // Re-setup event listeners after removing and reordering
        this._setupEventListeners();
        
        console.log('CombatDistancesConfig: Ring removed successfully');
    }

    _reorderRings() {
        const $element = $(this.element);
        const rings = $element.find('.ring-entry');
        rings.each((index, ring) => {
            const newId = `ring${index + 1}`;
            $(ring).attr('data-ring-id', newId);
            $(ring).find('input[type="text"]').attr('name', `${newId}.label`);
            $(ring).find('input[type="number"]').attr('name', `${newId}.distance`);
            $(ring).find('input[type="color"]').attr('name', `${newId}.color`);
        });
    }

    _getSubmitData() {
        const $element = $(this.element);
        const formData = {};
        $element.find('input').each((index, input) => {
            const name = input.name;
            const value = input.value;
            if (name) {
                formData[name] = value;
            }
        });
        return formData;
    }

    async _updateObject(event, formData) {
        const $element = $(this.element);
        const ranges = {};
        const entries = $element.find('.ring-entry');
        
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

    async _onResetDefaults(event) {
        event.preventDefault();
        const configApp = this;

        // Use the modern V2 Dialog.confirm API for a clean, Yes/No confirmation.
        const confirmed = await foundry.applications.api.Dialog.confirm({
            title: "Reset Combat Distances",
            content: `<p>Are you sure you want to reset all combat distances to their default values? This cannot be undone.</p>`,
            yes: {
                label: "Yes",
                callback: () => true
            },
            no: {
                label: "No",
                callback: () => false
            },
            default: "no"
        });

        if (confirmed) {
            console.log('CombatDistancesConfig: Resetting to default values');
            try {
                const defaultRanges = foundry.utils.deepClone(CombatDistances.DEFAULTS.ranges);
                await game.settings.set(CombatDistances.ID, 'ranges', defaultRanges);
                ui.notifications.info('Combat distances have been reset to default values.');
                
                // Re-render the main config window to reflect the changes.
                configApp.render();
            } catch (error) {
                console.error('Error resetting combat distances:', error);
                ui.notifications.error('Failed to reset combat distances. Please try again.');
            }
        }
    }
}

Hooks.once('init', () => {
    CombatDistances.initialize();
});
