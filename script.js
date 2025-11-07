// Initialize Gun.js with public relay peers for zero-config setup
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun', 'https://gun-us.herokuapp.com/gun']);
const entriesDB = gun.get('crossbar-entries');

let currentEntry = null;
let entries = [];
let isUpdating = false;

window.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadEntries();
    monitorConnection();
});

function setupEventListeners() {
    document.getElementById('createEntry').addEventListener('click', createNewEntry);
    document.getElementById('loadEntry').addEventListener('click', loadSelectedEntry);
    document.getElementById('deleteEntry').addEventListener('click', deleteSelectedEntry);
    document.getElementById('exportData').addEventListener('click', exportCurrentEntry);
    document.getElementById('clearAll').addEventListener('click', clearAllMeasurements);

    // Quick navigation
    document.getElementById('goToDevice').addEventListener('click', goToDevice);
    document.getElementById('cycleDevice').addEventListener('click', cycleDeviceByCoords);

    // Enter key support
    document.getElementById('bottomElectrode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') goToDevice();
    });
    document.getElementById('topElectrode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') goToDevice();
    });
}

function monitorConnection() {
    updateConnectionStatus(true, 'Connected');

    // Simple connection check
    setInterval(() => {
        const status = navigator.onLine;
        updateConnectionStatus(status, status ? 'Connected' : 'Offline');
    }, 5000);
}

function updateConnectionStatus(isConnected, message) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');

    statusElement.className = 'connection-status ' + (isConnected ? 'connected' : 'disconnected');
    statusText.textContent = message;
}

function loadEntries() {
    // Load from localStorage first as fallback
    const stored = localStorage.getItem('crossbar-entries-backup');
    if (stored) {
        try {
            const localEntries = JSON.parse(stored);
            entries = localEntries;
            updateEntrySelector();
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }

    // Then sync with Gun.js for real-time updates
    entriesDB.map().on((data, key) => {
        if (!data || data === null) return;

        isUpdating = true;

        const existingIndex = entries.findIndex(e => e.name === data.name);
        if (existingIndex >= 0) {
            entries[existingIndex] = data;
        } else {
            entries.push(data);
        }

        // Backup to localStorage
        localStorage.setItem('crossbar-entries-backup', JSON.stringify(entries));

        updateEntrySelector();

        if (currentEntry && currentEntry.name === data.name) {
            currentEntry = data;
            updateStatistics();
            updateGridCells();
        }

        isUpdating = false;
    });
}

function saveEntry(entry) {
    if (isUpdating) return;

    const key = sanitizeKey(entry.name);
    entriesDB.get(key).put(entry);

    // Also update localStorage backup
    const existingIndex = entries.findIndex(e => e.name === entry.name);
    if (existingIndex >= 0) {
        entries[existingIndex] = entry;
    } else {
        entries.push(entry);
    }
    localStorage.setItem('crossbar-entries-backup', JSON.stringify(entries));
}

function deleteEntry(entryName) {
    const key = sanitizeKey(entryName);
    entriesDB.get(key).put(null);

    entries = entries.filter(e => e.name !== entryName);
    localStorage.setItem('crossbar-entries-backup', JSON.stringify(entries));
    updateEntrySelector();
}

function sanitizeKey(key) {
    return key.replace(/[^a-zA-Z0-9-_]/g, '_');
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
        // Remove previous highlights
        document.querySelectorAll('.device-cell.highlight').forEach(c => {
            c.classList.remove('highlight');
        });

        // Highlight and scroll to cell
        cell.classList.add('highlight');
        cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        // Remove highlight after animation
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

    // Also highlight the cell briefly
    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        cell.classList.add('highlight');
        setTimeout(() => {
            cell.classList.remove('highlight');
        }, 500);
    }

    // Auto-increment to next device for easier sequential entry
    const t = parseInt(top);
    const b = parseInt(bottom);
    const size = currentEntry.size;

    if (t < size - 1) {
        document.getElementById('topElectrode').value = t + 1;
    } else if (b < size - 1) {
        document.getElementById('bottomElectrode').value = b + 1;
        document.getElementById('topElectrode').value = 0;
    }
}
