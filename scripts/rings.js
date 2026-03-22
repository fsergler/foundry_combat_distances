export default {
    createRings(token) {
        const currentRanges = game.settings.get(this.ID, 'ranges');
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
            const gridDistance = rangeData.distance / canvas.scene.grid.distance;
            const diameter = gridDistance * 2 * canvas.grid.size;

            const ring = document.createElement('div');
            ring.dataset.tokenId = token.id;
            ring.classList.add('range-ring', rangeKey);
            ring.style.width = `${diameter}px`;
            ring.style.height = `${diameter}px`;
            ring.style.left = `${tokenCenter.x}px`;
            ring.style.top = `${tokenCenter.y}px`;

            // Apply color with opacity, falling back to defaults then black
            let color = rangeData.color
                || (index < 5 ? this.DEFAULTS.ranges[rangeKey]?.color : null)
                || '#000000';

            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                ring.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
            } else {
                ring.style.borderColor = color.replace(')', ', 0.5)').replace('rgb', 'rgba');
            }

            const label = document.createElement('span');
            label.classList.add('range-label');
            const distance = parseFloat(rangeData.distance) || 0;
            label.textContent = `${rangeData.label} (${distance.toFixed(1)}')`;
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
    },

    createGridHighlights(token, rangeKey, rangeData, prevDistance, center = null) {
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

        // canvas.grid.type: 0=gridless, 1=square, 2-5=hex
        const isSquare = canvas.grid.type === 1;
        const maxCells = Math.ceil(maxRadiusPx / gridSize) + 1;
        const tokenGridPos = canvas.grid.getOffset({ x: tokenCenter.x, y: tokenCenter.y });

        for (let di = -maxCells; di <= maxCells; di++) {
            for (let dj = -maxCells; dj <= maxCells; dj++) {
                const cellOffset = { i: tokenGridPos.i + di, j: tokenGridPos.j + dj };
                const cellPos = canvas.grid.getTopLeftPoint(cellOffset);

                let checkPoints;
                if (isSquare) {
                    checkPoints = [
                        { x: cellPos.x,           y: cellPos.y },
                        { x: cellPos.x + gridSize, y: cellPos.y },
                        { x: cellPos.x + gridSize, y: cellPos.y + gridSize },
                        { x: cellPos.x,           y: cellPos.y + gridSize }
                    ];
                } else {
                    const hexCenter = canvas.grid.getCenterPoint(cellOffset);
                    const pts = canvas.grid.getShape()?.points;
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
    },

    removeRings(tokenId) {
        document.querySelectorAll(`.range-ring[data-token-id="${tokenId}"], .range-fill-cell[data-token-id="${tokenId}"]`)
            .forEach(el => el.remove());

        const token = canvas.tokens.get(tokenId);
        if (token) this._activeRings.delete(tokenId);
    },

    hasRings(tokenId) {
        return this._activeRings.has(tokenId);
    }
};
