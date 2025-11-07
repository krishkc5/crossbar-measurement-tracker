// Firebase Realtime Database for real-time synchronization
let db = null;
let entriesRef = null;
let currentEntry = null;
let entries = [];
let isUpdating = false;

// Initialize Firebase when DOM loads
window.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('createEntry').addEventListener('click', createNewEntry);
    document.getElementById('loadEntry').addEventListener('click', loadSelectedEntry);
    document.getElementById('deleteEntry').addEventListener('click', deleteSelectedEntry);
    document.getElementById('exportData').addEventListener('click', exportCurrentEntry);
    document.getElementById('importData').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importFromJSON);
    document.getElementById('exportImage').addEventListener('click', exportAsImage);
    document.getElementById('clearAll').addEventListener('click', clearAllMeasurements);

    // Quick navigation
    document.getElementById('goToDevice').addEventListener('click', goToDevice);
    document.getElementById('cycleDevice').addEventListener('click', cycleDeviceByCoords);

    // Enhanced keyboard navigation
    document.getElementById('bottomElectrode').addEventListener('keydown', handleBottomElectrodeKey);
    document.getElementById('topElectrode').addEventListener('keydown', handleTopElectrodeKey);
}

function initializeFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        updateConnectionStatus(false, 'Firebase not loaded');
        return;
    }

    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        entriesRef = db.ref('entries');

        // Monitor connection status
        const connectedRef = db.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                updateConnectionStatus(true, 'Connected');
            } else {
                updateConnectionStatus(false, 'Disconnected');
            }
        });

        // Listen for real-time updates
        entriesRef.on('value', (snapshot) => {
            isUpdating = true;
            const data = snapshot.val();
            entries = data ? Object.values(data) : [];
            updateEntrySelector();

            // Update current entry if it was modified
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
        measurements: Array(size * size).fill(0)
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

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'device-cell';
        cell.dataset.index = i;

        const row = Math.floor(i / size);
        const col = i % size;
        cell.title = `Device [${row}, ${col}]`;

        updateCellAppearance(cell, currentEntry.measurements[i]);
        cell.addEventListener('click', () => handleCellClick(i));

        // Add hover tooltip for large arrays
        if (size > 32) {
            cell.addEventListener('mouseenter', (e) => showTooltip(e, row, col, currentEntry.measurements[i]));
            cell.addEventListener('mouseleave', hideTooltip);
        }

        grid.appendChild(cell);
    }
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

// Tooltip functions
function showTooltip(e, row, col, state) {
    const tooltip = document.getElementById('deviceTooltip');
    const coords = tooltip.querySelector('.tooltip-coords');
    const preview = tooltip.querySelector('.tooltip-preview');

    coords.textContent = `B: ${row} | T: ${col}`;

    preview.classList.remove('success', 'failed', 'warning');
    if (state === 1) preview.classList.add('success');
    else if (state === 2) preview.classList.add('failed');
    else if (state === 3) preview.classList.add('warning');

    tooltip.style.display = 'block';
    tooltip.style.left = (e.pageX + 15) + 'px';
    tooltip.style.top = (e.pageY + 15) + 'px';
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
