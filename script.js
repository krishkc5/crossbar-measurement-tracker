/**
 * Crossbar Array Measurement Tracker
 *
 * A real-time collaborative application for tracking ferroelectric diode measurements
 * on crossbar arrays. Supports arrays from 8x8 to 128x128 devices with instant
 * synchronization across multiple users via Firebase Realtime Database.
 *
 * @author Krishna Chemudupati
 * @version 2.0.0
 * @license MIT
 */

// ============================================================================
// Global State Management
// ============================================================================

/** @type {firebase.database.Database} Firebase database instance */
let db = null;

/** @type {firebase.database.Reference} Reference to entries collection */
let entriesRef = null;

/** @type {Object|null} Currently loaded measurement entry */
let currentEntry = null;

/** @type {Array<Object>} All available measurement entries */
let entries = [];

/** @type {boolean} Flag to prevent recursive updates during sync */
let isUpdating = false;

/** @type {number|null} Currently selected cell index for keyboard navigation */
let selectedCellIndex = null;

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize application when DOM is fully loaded
 * Sets up Firebase connection and event listeners
 */
window.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
});

/**
 * Attach all event listeners to DOM elements
 * Centralizes event binding for maintainability
 */
function setupEventListeners() {
    // Entry management
    document.getElementById('createEntry').addEventListener('click', createNewEntry);
    document.getElementById('loadEntry').addEventListener('click', loadSelectedEntry);
    document.getElementById('deleteEntry').addEventListener('click', deleteSelectedEntry);

    // Data export/import
    document.getElementById('exportData').addEventListener('click', exportCurrentEntry);
    document.getElementById('importData').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importFromJSON);
    document.getElementById('exportImage').addEventListener('click', exportAsImage);
    document.getElementById('clearAll').addEventListener('click', clearAllMeasurements);

    // Quick navigation for large arrays
    document.getElementById('goToDevice').addEventListener('click', goToDevice);
    document.getElementById('cycleDevice').addEventListener('click', cycleDeviceByCoords);

    // Enhanced keyboard navigation
    document.getElementById('bottomElectrode').addEventListener('keydown', handleBottomElectrodeKey);
    document.getElementById('topElectrode').addEventListener('keydown', handleTopElectrodeKey);

    // Arrow key navigation in grid
    document.addEventListener('keydown', handleArrowKeyNavigation);
}

// ============================================================================
// Firebase Integration
// ============================================================================

/**
 * Initialize Firebase Realtime Database connection
 * Sets up real-time listeners for data synchronization and connection monitoring
 *
 * @throws {Error} If Firebase SDK is not loaded or initialization fails
 */
function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        updateConnectionStatus(false, 'Firebase not loaded');
        return;
    }

    try {
        // Initialize Firebase with configuration from firebase-config.js
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        entriesRef = db.ref('entries');

        // Monitor connection status using Firebase's built-in .info/connected
        const connectedRef = db.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                updateConnectionStatus(true, 'Connected');
            } else {
                updateConnectionStatus(false, 'Disconnected');
            }
        });

        // Listen for real-time updates to entries collection
        entriesRef.on('value', (snapshot) => {
            isUpdating = true;
            const data = snapshot.val();
            entries = data ? Object.values(data) : [];
            updateEntrySelector();

            // Update currently loaded entry if it was modified by another user
            if (currentEntry) {
                const updatedEntry = entries.find(e => e.name === currentEntry.name);
                if (updatedEntry && JSON.stringify(updatedEntry.measurements) !== JSON.stringify(currentEntry.measurements)) {
                    currentEntry = updatedEntry;
                    updateGridCells();
                    updateStatistics();
                }
            }
            isUpdating = false;
        });

    } catch (error) {
        console.error('Firebase initialization error:', error);
        updateConnectionStatus(false, 'Connection Error');
    }
}

/**
 * Update the connection status indicator in the UI
 *
 * @param {boolean} isConnected - Whether Firebase is connected
 * @param {string} message - Status message to display
 */

function updateConnectionStatus(isConnected, message) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');

    statusElement.className = 'connection-status ' + (isConnected ? 'connected' : 'disconnected');
    statusText.textContent = message;
}

function saveEntry(entry) {
    if (isUpdating || !entriesRef) return;

    entry.lastModified = new Date().toISOString();

    // Save to Firebase using entry name as key
    const sanitizedName = entry.name.replace(/[.#$[\]]/g, '_');
    entriesRef.child(sanitizedName).set(entry)
        .then(() => {
            console.log('Entry saved successfully');
        })
        .catch((error) => {
            console.error('Error saving entry:', error);
            alert('Failed to save entry. Please check your connection.');
        });
}

function deleteEntry(entryName) {
    if (!entriesRef) return;

    const sanitizedName = entryName.replace(/[.#$[\]]/g, '_');
    entriesRef.child(sanitizedName).remove()
        .then(() => {
            console.log('Entry deleted successfully');
        })
        .catch((error) => {
            console.error('Error deleting entry:', error);
            alert('Failed to delete entry. Please check your connection.');
        });
}

function createNewEntry() {
    const name = document.getElementById('entryName').value.trim();
    const size = parseInt(document.getElementById('arraySize').value);

    if (!name) {
        alert('Please enter a name for the entry');
        return;
    }

    if (entries.find(e => e.name === name)) {
        alert('An entry with this name already exists');
        return;
    }

    const entry = {
        name: name,
        size: size,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        measurements: Array(size * size).fill(0),
        timestamps: Array(size * size).fill(null) // Track when each cell was last modified
    };

    saveEntry(entry);
    loadEntry(entry);

    document.getElementById('entryName').value = '';
}

function loadSelectedEntry() {
    const selector = document.getElementById('entrySelector');
    const selectedName = selector.value;

    if (!selectedName) {
        alert('Please select an entry to load');
        return;
    }

    const entry = entries.find(e => e.name === selectedName);
    if (entry) {
        loadEntry(entry);
    }
}

function deleteSelectedEntry() {
    const selector = document.getElementById('entrySelector');
    const selectedName = selector.value;

    if (!selectedName) {
        alert('Please select an entry to delete');
        return;
    }

    if (!confirm(`Delete "${selectedName}"? This will remove it for everyone.`)) {
        return;
    }

    deleteEntry(selectedName);

    if (currentEntry && currentEntry.name === selectedName) {
        currentEntry = null;
        document.getElementById('currentEntry').style.display = 'none';
    }
}

function loadEntry(entry) {
    currentEntry = entry;
    document.getElementById('currentEntry').style.display = 'block';
    document.getElementById('currentEntryName').textContent = entry.name;
    document.getElementById('currentArraySize').textContent =
        `${entry.size}x${entry.size} Array (Created: ${new Date(entry.createdAt).toLocaleString()})`;

    renderGrid();
    updateStatistics();
}

function renderGrid() {
    const grid = document.getElementById('crossbarGrid');
    grid.innerHTML = '';

    const size = currentEntry.size;
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    if (size > 32) {
        grid.classList.add('large');
    } else {
        grid.classList.remove('large');
    }

    // Ensure timestamps array exists (for backward compatibility)
    if (!currentEntry.timestamps) {
        currentEntry.timestamps = Array(size * size).fill(null);
    }

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'device-cell';
        cell.dataset.index = i;
        cell.tabIndex = 0; // Make cells focusable for keyboard navigation

        const row = Math.floor(i / size);
        const col = i % size;

        updateCellAppearance(cell, currentEntry.measurements[i]);

        // Click handler
        cell.addEventListener('click', () => {
            selectCell(i);
            handleCellClick(i);
        });

        // Focus handler for keyboard navigation
        cell.addEventListener('focus', () => selectCell(i));

        // Enhanced hover tooltip with timestamp
        cell.addEventListener('mouseenter', (e) => {
            const timestamp = currentEntry.timestamps[i];
            showEnhancedTooltip(e, row, col, currentEntry.measurements[i], timestamp);
        });
        cell.addEventListener('mouseleave', hideTooltip);

        grid.appendChild(cell);
    }

    // Clear selection when grid is re-rendered
    selectedCellIndex = null;
}

function updateGridCells() {
    if (!currentEntry) return;

    for (let i = 0; i < currentEntry.measurements.length; i++) {
        const cell = document.querySelector(`[data-index="${i}"]`);
        if (cell) {
            updateCellAppearance(cell, currentEntry.measurements[i]);
        }
    }
}

function handleCellClick(index) {
    if (isUpdating) return;

    currentEntry.measurements[index] = (currentEntry.measurements[index] + 1) % 4;
    currentEntry.lastModified = new Date().toISOString();

    // Record timestamp for this cell
    if (!currentEntry.timestamps) {
        currentEntry.timestamps = Array(currentEntry.size * currentEntry.size).fill(null);
    }
    currentEntry.timestamps[index] = new Date().toISOString();

    const cell = document.querySelector(`[data-index="${index}"]`);
    updateCellAppearance(cell, currentEntry.measurements[index]);

    updateStatistics();
    saveEntry(currentEntry);
}

function updateCellAppearance(cell, state) {
    cell.classList.remove('success', 'failed', 'warning');

    if (state === 1) cell.classList.add('success');
    else if (state === 2) cell.classList.add('failed');
    else if (state === 3) cell.classList.add('warning');
}

function updateStatistics() {
    if (!currentEntry) return;

    const measurements = currentEntry.measurements;
    const total = measurements.length;

    const successCount = measurements.filter(m => m === 1).length;
    const failedCount = measurements.filter(m => m === 2).length;
    const warningCount = measurements.filter(m => m === 3).length;
    const unmeasuredCount = measurements.filter(m => m === 0).length;

    document.getElementById('totalDevices').textContent = total;
    document.getElementById('successCount').textContent = successCount;
    document.getElementById('failedCount').textContent = failedCount;
    document.getElementById('warningCount').textContent = warningCount;
    document.getElementById('unmeasuredCount').textContent = unmeasuredCount;

    document.getElementById('successPercent').textContent = `(${((successCount / total) * 100).toFixed(1)}%)`;
    document.getElementById('failedPercent').textContent = `(${((failedCount / total) * 100).toFixed(1)}%)`;
    document.getElementById('warningPercent').textContent = `(${((warningCount / total) * 100).toFixed(1)}%)`;
    document.getElementById('unmeasuredPercent').textContent = `(${((unmeasuredCount / total) * 100).toFixed(1)}%)`;
}

function updateEntrySelector() {
    const selector = document.getElementById('entrySelector');
    const currentSelection = selector.value;
    selector.innerHTML = '';

    if (entries.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No entries yet';
        selector.appendChild(option);
    } else {
        entries.forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.name;
            option.textContent = `${entry.name} (${entry.size}x${entry.size})`;
            selector.appendChild(option);
        });

        if (currentSelection && entries.find(e => e.name === currentSelection)) {
            selector.value = currentSelection;
        }
    }
}

function exportCurrentEntry() {
    if (!currentEntry) return;

    const size = currentEntry.size;
    const exportData = {
        name: currentEntry.name,
        size: size,
        createdAt: currentEntry.createdAt,
        lastModified: currentEntry.lastModified,
        measurements: {
            raw: currentEntry.measurements,
            grid: []
        },
        statistics: {
            total: currentEntry.measurements.length,
            successful: currentEntry.measurements.filter(m => m === 1).length,
            failed: currentEntry.measurements.filter(m => m === 2).length,
            misaligned: currentEntry.measurements.filter(m => m === 3).length,
            unmeasured: currentEntry.measurements.filter(m => m === 0).length
        },
        successfulDevices: [],
        failedDevices: [],
        misalignedDevices: []
    };

    // Convert to 2D grid
    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            row.push(currentEntry.measurements[i * size + j]);
        }
        exportData.measurements.grid.push(row);
    }

    // List device coordinates by type
    for (let i = 0; i < currentEntry.measurements.length; i++) {
        const row = Math.floor(i / size);
        const col = i % size;
        const coord = [row, col];

        if (currentEntry.measurements[i] === 1) {
            exportData.successfulDevices.push(coord);
        } else if (currentEntry.measurements[i] === 2) {
            exportData.failedDevices.push(coord);
        } else if (currentEntry.measurements[i] === 3) {
            exportData.misalignedDevices.push(coord);
        }
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentEntry.name}_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function clearAllMeasurements() {
    if (!currentEntry) return;

    if (!confirm('Clear all measurements? This affects everyone viewing this entry.')) {
        return;
    }

    currentEntry.measurements = Array(currentEntry.size * currentEntry.size).fill(0);
    currentEntry.lastModified = new Date().toISOString();

    saveEntry(currentEntry);
    updateGridCells();
    updateStatistics();
}

// Quick navigation functions
function getDeviceIndex(bottom, top) {
    if (!currentEntry) return -1;

    const b = parseInt(bottom);
    const t = parseInt(top);
    const size = currentEntry.size;

    if (isNaN(b) || isNaN(t) || b < 0 || b >= size || t < 0 || t >= size) {
        return -1;
    }

    return b * size + t;
}

function goToDevice() {
    const bottom = document.getElementById('bottomElectrode').value;
    const top = document.getElementById('topElectrode').value;
    const index = getDeviceIndex(bottom, top);

    if (index < 0) {
        alert('Please enter valid coordinates (B and T must be between 0 and ' + (currentEntry.size - 1) + ')');
        return;
    }

    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        document.querySelectorAll('.device-cell.highlight').forEach(c => {
            c.classList.remove('highlight');
        });

        cell.classList.add('highlight');
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        setTimeout(() => {
            cell.classList.remove('highlight');
        }, 1000);
    }
}

function cycleDeviceByCoords() {
    const bottom = document.getElementById('bottomElectrode').value;
    const top = document.getElementById('topElectrode').value;
    const index = getDeviceIndex(bottom, top);

    if (index < 0) {
        alert('Please enter valid coordinates (B and T must be between 0 and ' + (currentEntry.size - 1) + ')');
        return;
    }

    handleCellClick(index);

    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        cell.classList.add('highlight');
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        setTimeout(() => {
            cell.classList.remove('highlight');
        }, 500);
    }
}

// Enhanced keyboard navigation
function handleBottomElectrodeKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            // Shift+Enter - stay on bottom electrode (do nothing)
        } else {
            // Enter - move to top electrode
            document.getElementById('topElectrode').focus();
            document.getElementById('topElectrode').select();
        }
    }
}

function handleTopElectrodeKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const bottom = document.getElementById('bottomElectrode').value;
        const top = document.getElementById('topElectrode').value;
        const index = getDeviceIndex(bottom, top);

        if (index < 0) {
            alert('Please enter valid coordinates');
            return;
        }

        if (e.shiftKey) {
            // Shift+Enter - go back to bottom electrode, keep values
            document.getElementById('bottomElectrode').focus();
            document.getElementById('bottomElectrode').select();
        } else {
            // Enter - cycle device state
            handleCellClick(index);

            const cell = document.querySelector(`[data-index="${index}"]`);
            if (cell) {
                cell.classList.add('highlight');
                cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                setTimeout(() => {
                    cell.classList.remove('highlight');
                }, 500);
            }
        }
    }
}

// ============================================================================
// Cell Selection and Keyboard Navigation
// ============================================================================

/**
 * Select a cell and update visual indication
 * @param {number} index - Linear index of the cell to select
 */
function selectCell(index) {
    // Remove previous selection
    if (selectedCellIndex !== null) {
        const prevCell = document.querySelector(`[data-index="${selectedCellIndex}"]`);
        if (prevCell) {
            prevCell.classList.remove('selected');
        }
    }

    // Set new selection
    selectedCellIndex = index;
    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        cell.classList.add('selected');
        cell.focus();
    }
}

/**
 * Handle arrow key navigation between cells
 * @param {KeyboardEvent} e - Keyboard event
 */
function handleArrowKeyNavigation(e) {
    if (!currentEntry || selectedCellIndex === null) return;

    // Only handle arrow keys and space
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) return;

    // Prevent default scrolling behavior
    e.preventDefault();

    const size = currentEntry.size;
    const row = Math.floor(selectedCellIndex / size);
    const col = selectedCellIndex % size;
    let newIndex = selectedCellIndex;

    switch (e.key) {
        case 'ArrowUp':
            if (row > 0) newIndex = selectedCellIndex - size;
            break;
        case 'ArrowDown':
            if (row < size - 1) newIndex = selectedCellIndex + size;
            break;
        case 'ArrowLeft':
            if (col > 0) newIndex = selectedCellIndex - 1;
            break;
        case 'ArrowRight':
            if (col < size - 1) newIndex = selectedCellIndex + 1;
            break;
        case ' ':
            // Space bar cycles the cell state
            handleCellClick(selectedCellIndex);
            return;
    }

    if (newIndex !== selectedCellIndex) {
        selectCell(newIndex);

        // Scroll into view if needed
        const cell = document.querySelector(`[data-index="${newIndex}"]`);
        if (cell) {
            cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }
}

// ============================================================================
// Enhanced Tooltip Functions
// ============================================================================

/**
 * Show enhanced tooltip with timestamp information
 * @param {MouseEvent} e - Mouse event
 * @param {number} row - Row coordinate
 * @param {number} col - Column coordinate
 * @param {number} state - Measurement state (0-3)
 * @param {string|null} timestamp - ISO timestamp of last modification
 */
function showEnhancedTooltip(e, row, col, state, timestamp) {
    console.log('showEnhancedTooltip called:', {row, col, state, timestamp});

    const tooltip = document.getElementById('deviceTooltip');
    console.log('Tooltip element:', tooltip);

    if (!tooltip) {
        console.error('Tooltip element not found!');
        return;
    }

    const coords = tooltip.querySelector('.tooltip-coords');
    const preview = tooltip.querySelector('.tooltip-preview');

    console.log('Coords element:', coords, 'Preview element:', preview);

    if (!coords || !preview) {
        console.error('Tooltip child elements not found!');
        return;
    }

    // Clear previous content
    coords.innerHTML = '';

    // Build tooltip content with proper line breaks
    const coordsLine = document.createElement('div');
    coordsLine.textContent = `B: ${row} | T: ${col}`;
    coordsLine.style.fontWeight = 'bold';
    coordsLine.style.marginBottom = '4px';
    coords.appendChild(coordsLine);

    // Add state label
    const stateLabels = ['Unmeasured', 'Successful', 'Failed', 'Misaligned'];
    const stateLine = document.createElement('div');
    stateLine.textContent = `State: ${stateLabels[state]}`;
    stateLine.style.fontSize = '13px';
    coords.appendChild(stateLine);

    // Add timestamp if available
    if (timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo;
        if (diffMins < 1) {
            timeAgo = 'just now';
        } else if (diffMins < 60) {
            timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            timeAgo = date.toLocaleDateString();
        }

        const timeLine = document.createElement('div');
        timeLine.textContent = `Last changed: ${timeAgo}`;
        timeLine.style.fontSize = '12px';
        timeLine.style.color = '#666';
        timeLine.style.marginTop = '4px';
        coords.appendChild(timeLine);
    }

    preview.classList.remove('success', 'failed', 'warning');
    if (state === 1) preview.classList.add('success');
    else if (state === 2) preview.classList.add('failed');
    else if (state === 3) preview.classList.add('warning');

    tooltip.style.display = 'block';
    // Use clientX/clientY for viewport coordinates (fixed positioning)
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';

    console.log('Tooltip displayed at:', {
        left: tooltip.style.left,
        top: tooltip.style.top,
        display: tooltip.style.display,
        clientX: e.clientX,
        clientY: e.clientY
    });
}

function hideTooltip() {
    document.getElementById('deviceTooltip').style.display = 'none';
}

// Import from JSON
function importFromJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (!data.name || !data.size || !data.measurements || !data.measurements.raw) {
                alert('Invalid JSON format. Please use a file exported from this app.');
                return;
            }

            const entry = {
                name: data.name,
                size: data.size,
                createdAt: data.createdAt || new Date().toISOString(),
                lastModified: new Date().toISOString(),
                measurements: data.measurements.raw
            };

            // Check if entry already exists
            if (entries.find(e => e.name === entry.name)) {
                if (!confirm(`Entry "${entry.name}" already exists. Overwrite?`)) {
                    return;
                }
            }

            saveEntry(entry);
            loadEntry(entry);
            alert('Successfully imported: ' + entry.name);

        } catch (err) {
            alert('Error reading JSON file: ' + err.message);
        }
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset file input
}

// Export as PNG image with statistics
function exportAsImage() {
    if (!currentEntry) return;

    const size = currentEntry.size;
    const cellSize = size > 64 ? 8 : (size > 32 ? 12 : 20);
    const padding = 80;
    const statsHeight = 200;
    const titleHeight = 80;

    const gridWidth = size * cellSize;
    const gridHeight = size * cellSize;
    const canvasWidth = gridWidth + (padding * 2);
    const canvasHeight = gridHeight + (padding * 2) + statsHeight + titleHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(currentEntry.name, canvasWidth / 2, 40);
    ctx.font = '16px Arial';
    ctx.fillText(`${size}x${size} Crossbar Array`, canvasWidth / 2, 65);

    // Draw grid
    const gridStartY = titleHeight + padding;
    for (let i = 0; i < size * size; i++) {
        const row = Math.floor(i / size);
        const col = i % size;
        const x = padding + (col * cellSize);
        const y = gridStartY + (row * cellSize);

        const state = currentEntry.measurements[i];

        // Cell color
        switch(state) {
            case 1: // Success
                ctx.fillStyle = '#4CAF50';
                break;
            case 2: // Failed
                ctx.fillStyle = '#f44336';
                break;
            case 3: // Warning
                ctx.fillStyle = '#ffc107';
                break;
            default: // Unmeasured
                ctx.fillStyle = '#ffffff';
                break;
        }

        ctx.fillRect(x, y, cellSize, cellSize);

        // Cell border
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellSize, cellSize);
    }

    // Grid border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, gridStartY, gridWidth, gridHeight);

    // Axis labels
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';

    // Bottom label (Top Electrode)
    ctx.fillText('Top Electrode (T)', canvasWidth / 2, gridStartY + gridHeight + 35);

    // Left label (Bottom Electrode) - rotated
    ctx.save();
    ctx.translate(25, gridStartY + gridHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Bottom Electrode (B)', 0, 0);
    ctx.restore();

    // Statistics section
    const statsY = gridStartY + gridHeight + 60;
    const measurements = currentEntry.measurements;
    const total = measurements.length;
    const successCount = measurements.filter(m => m === 1).length;
    const failedCount = measurements.filter(m => m === 2).length;
    const warningCount = measurements.filter(m => m === 3).length;
    const unmeasuredCount = measurements.filter(m => m === 0).length;

    // Stats title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Statistics:', padding, statsY);

    // Stats data
    ctx.font = '14px Arial';
    const statLineHeight = 25;
    let currentStatY = statsY + 30;

    const stats = [
        { label: 'Total Devices:', value: total, color: '#333' },
        { label: 'Successful:', value: `${successCount} (${((successCount / total) * 100).toFixed(1)}%)`, color: '#4CAF50' },
        { label: 'Failed:', value: `${failedCount} (${((failedCount / total) * 100).toFixed(1)}%)`, color: '#f44336' },
        { label: 'Misaligned:', value: `${warningCount} (${((warningCount / total) * 100).toFixed(1)}%)`, color: '#ffc107' },
        { label: 'Unmeasured:', value: `${unmeasuredCount} (${((unmeasuredCount / total) * 100).toFixed(1)}%)`, color: '#999' }
    ];

    const col1X = padding;
    const col2X = canvasWidth / 2;

    stats.forEach((stat, index) => {
        const x = index < 3 ? col1X : col2X;
        const y = index < 3 ? currentStatY + (index * statLineHeight) : currentStatY + ((index - 3) * statLineHeight);

        ctx.fillStyle = '#666';
        ctx.fillText(stat.label, x, y);

        ctx.fillStyle = stat.color;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(stat.value, x + 130, y);
        ctx.font = '14px Arial';
    });

    // Legend
    const legendY = statsY + 100;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Legend:', padding, legendY);

    const legendItems = [
        { color: '#ffffff', label: 'Unmeasured', border: '#ccc' },
        { color: '#4CAF50', label: 'Successful', border: '#4CAF50' },
        { color: '#f44336', label: 'Failed', border: '#f44336' },
        { color: '#ffc107', label: 'Misaligned', border: '#ffc107' }
    ];

    let legendX = padding + 80;
    legendItems.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY - 12, 20, 20);
        ctx.strokeStyle = item.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(legendX, legendY - 12, 20, 20);

        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, legendX + 25, legendY + 3);

        legendX += 120;
    });

    // Export timestamp
    ctx.fillStyle = '#999';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, canvasWidth / 2, canvasHeight - 15);

    // Convert to PNG and download
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${currentEntry.name}_visualization.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 'image/png');
}
