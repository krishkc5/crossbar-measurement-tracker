# Crossbar Array Measurement Tracker

Interactive web tool for tracking ferroelectric diode measurements on crossbar arrays. Built for lab use with real-time collaboration between team members.

## Features

- Real-time data sync across all users (no setup required)
- Support for 8x8 and 128x128 (2kB) crossbar arrays
- Simple click-based tracking:
  - Click once = Green (successful measurement)
  - Click twice = Red (failed)
  - Click three times = Yellow (misaligned curve)
  - Click again = Reset to unmeasured
- Live statistics with percentages
- Export measurement data as JSON for analysis
- Multiple array entries with persistent storage

## Usage

Visit: https://krishkc5.github.io/crossbar-measurement-tracker/

1. Create a new entry with a descriptive name (e.g., "Wafer-A-2024-11-07")
2. Select array size (8x8 or 128x128)
3. Click on device cells to mark their measurement status
4. Share the URL with your team - everyone sees the same data in real-time
5. Export to JSON when ready to analyze data for your paper

## Data Export Format

The JSON export includes:
- Raw measurement array
- 2D grid representation
- Statistics (counts and percentages)
- Coordinate lists for successful/failed/misaligned devices

Perfect for importing into Python/MATLAB for analysis.

## Technical Details

Built with vanilla JavaScript and Gun.js for peer-to-peer data sync. No server setup or configuration needed - just open the link and start tracking measurements.
