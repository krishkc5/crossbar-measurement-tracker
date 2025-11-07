// State management
let currentEntry = null;
let entries = [];

// Load entries from localStorage on page load
window.addEventListener('DOMContentLoaded', () => {
    loadEntriesFromStorage();
    updateEntrySelector();
    setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
    document.getElementById('createEntry').addEventListener('click', createNewEntry);
    document.getElementById('loadEntry').addEventListener('click', loadSelectedEntry);
    document.getElementById('deleteEntry').addEventListener('click', deleteSelectedEntry);
    document.getElementById('exportData').addEventListener('click', exportCurrentEntry);
    document.getElementById('clearAll').addEventListener('click', clearAllMeasurements);
}

// Create a new entry
function createNewEntry() {
    const name = document.getElementById('entryName').value.trim();
    const size = parseInt(document.getElementById('arraySize').value);

    if (!name) {
        alert('Please enter a name for the entry');
        return;
    }

    // Check if entry with same name exists
    if (entries.find(e => e.name === name)) {
        alert('An entry with this name already exists');
        return;
    }

    const entry = {
        name: name,
        size: size,
        createdAt: new Date().toISOString(),
        measurements: Array(size * size).fill(0) // 0: unmeasured, 1: success, 2: failed, 3: warning
    };

    entries.push(entry);
    saveEntriesToStorage();
    updateEntrySelector();
    loadEntry(entry);

    // Clear the input
    document.getElementById('entryName').value = '';
}

// Load a selected entry
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

// Delete a selected entry
function deleteSelectedEntry() {
    const selector = document.getElementById('entrySelector');
    const selectedName = selector.value;

    if (!selectedName) {
        alert('Please select an entry to delete');
        return;
    }

    if (!confirm(`Are you sure you want to delete entry "${selectedName}"?`)) {
        return;
    }

    entries = entries.filter(e => e.name !== selectedName);
    saveEntriesToStorage();
    updateEntrySelector();

    // If the deleted entry was currently loaded, hide the view
    if (currentEntry && currentEntry.name === selectedName) {
        currentEntry = null;
        document.getElementById('currentEntry').style.display = 'none';
    }
}

// Load an entry and display it
function loadEntry(entry) {
    currentEntry = entry;
    document.getElementById('currentEntry').style.display = 'block';
    document.getElementById('currentEntryName').textContent = entry.name;
    document.getElementById('currentArraySize').textContent = `${entry.size}x${entry.size} Array (Created: ${new Date(entry.createdAt).toLocaleString()})`;

    renderGrid();
    updateStatistics();
}

// Render the crossbar grid
function renderGrid() {
    const grid = document.getElementById('crossbarGrid');
    grid.innerHTML = '';

    const size = currentEntry.size;
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    // Add class for large arrays to make cells smaller
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

        // Set initial state
        updateCellAppearance(cell, currentEntry.measurements[i]);

        // Add click handler
        cell.addEventListener('click', () => handleCellClick(i));

        grid.appendChild(cell);
    }
}

// Handle cell click - cycle through states
function handleCellClick(index) {
    // Cycle: 0 (unmeasured) -> 1 (success) -> 2 (failed) -> 3 (warning) -> 0
    currentEntry.measurements[index] = (currentEntry.measurements[index] + 1) % 4;

    // Update the cell appearance
    const cell = document.querySelector(`[data-index="${index}"]`);
    updateCellAppearance(cell, currentEntry.measurements[index]);

    // Update statistics
    updateStatistics();

    // Save to storage
    saveEntriesToStorage();
}

// Update cell appearance based on state
function updateCellAppearance(cell, state) {
    cell.classList.remove('success', 'failed', 'warning');

    switch(state) {
        case 1: // Success
            cell.classList.add('success');
            break;
        case 2: // Failed
            cell.classList.add('failed');
            break;
        case 3: // Warning
            cell.classList.add('warning');
            break;
        default: // Unmeasured
            break;
    }
}

// Update statistics display
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

// Update the entry selector dropdown
function updateEntrySelector() {
    const selector = document.getElementById('entrySelector');
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
    }
}

// Export current entry data as JSON
function exportCurrentEntry() {
    if (!currentEntry) return;

    const size = currentEntry.size;
    const exportData = {
        name: currentEntry.name,
        size: size,
        createdAt: currentEntry.createdAt,
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

    // Convert to 2D grid format
    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            row.push(currentEntry.measurements[i * size + j]);
        }
        exportData.measurements.grid.push(row);
    }

    // List coordinates of each device type
    for (let i = 0; i < currentEntry.measurements.length; i++) {
        const row = Math.floor(i / size);
        const col = i % size;
        const coord = [row, col];

        switch(currentEntry.measurements[i]) {
            case 1:
                exportData.successfulDevices.push(coord);
                break;
            case 2:
                exportData.failedDevices.push(coord);
                break;
            case 3:
                exportData.misalignedDevices.push(coord);
                break;
        }
    }

    // Create and download JSON file
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

// Clear all measurements in current entry
function clearAllMeasurements() {
    if (!currentEntry) return;

    if (!confirm('Are you sure you want to clear all measurements? This cannot be undone.')) {
        return;
    }

    currentEntry.measurements = Array(currentEntry.size * currentEntry.size).fill(0);
    saveEntriesToStorage();
    renderGrid();
    updateStatistics();
}

// Save entries to localStorage
function saveEntriesToStorage() {
    localStorage.setItem('crossbarEntries', JSON.stringify(entries));
}

// Load entries from localStorage
function loadEntriesFromStorage() {
    const stored = localStorage.getItem('crossbarEntries');
    if (stored) {
        entries = JSON.parse(stored);
    }
}
