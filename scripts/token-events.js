export default {
    onRenderTokenHUD(_hud, html, tokenData) {
        const token = canvas.tokens.get(tokenData._id);
        const button = $(`
            <div class="control-icon" title="Toggle Combat Distances">
                <i class="fas fa-circle-dot"></i>
            </div>
        `);

        if (this.hasRings(token.id)) {
            button.addClass('active');
        }

        button.click(async (event) => {
            event.preventDefault();
            const currentRanges = game.settings.get(this.ID, 'ranges');

            if (this.hasRings(token.id)) {
                this.removeRings(token.id);
                button.removeClass('active');
            } else if (Object.keys(currentRanges).length > 0) {
                this.createRings(token);
                button.addClass('active');
            } else {
                ui.notifications.warn('No combat distances are configured. Please configure distances in the module settings.');
            }
        });

        $(html).find('div.left').append(button);
    },

    onUpdateToken(tokenDocument, changes) {
        const token = canvas.tokens.get(tokenDocument.id);
        if (!token || !this.hasRings(token.id)) return;

        if ('x' in changes || 'y' in changes) {
            const tokenCenter = {
                x: (changes.x ?? token.x) + (token.w / 2),
                y: (changes.y ?? token.y) + (token.h / 2)
            };

            // Reposition ring circles (fast path — just update CSS)
            document.querySelectorAll(`.range-ring[data-token-id="${token.id}"]`).forEach(ring => {
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
    },

    onDeleteToken(tokenDocument) {
        document.querySelectorAll(`.range-ring[data-token-id="${tokenDocument.id}"], .range-fill-cell[data-token-id="${tokenDocument.id}"]`)
            .forEach(el => el.remove());
        this._activeRings.delete(tokenDocument.id);
    }
};
