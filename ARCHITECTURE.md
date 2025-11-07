# Technical Architecture Documentation

## System Overview

The Crossbar Array Measurement Tracker is a real-time collaborative web application built using modern web technologies with Firebase as the backend infrastructure.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Browser (Chrome/Firefox/Safari/Edge)                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐        │
│  │  index.html │  │   style.css  │  │   script.js     │        │
│  │  (UI Layer) │  │  (Styling)   │  │ (Business Logic)│        │
│  └─────────────┘  └──────────────┘  └─────────────────┘        │
│         │                │                     │                 │
│         └────────────────┴─────────────────────┘                 │
│                          │                                       │
│                   ┌──────▼───────┐                               │
│                   │ Firebase SDK │                               │
│                   │  (v9.22.0)   │                               │
│                   └──────┬───────┘                               │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                  WebSocket Connection
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                    Backend Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Realtime Database (us-central1)                       │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  entries/                                             │      │
│  │    ├─ entry_name_1/                                   │      │
│  │    │    ├─ name: "Wafer-A-2024"                       │      │
│  │    │    ├─ size: 128                                  │      │
│  │    │    ├─ measurements: [0,1,2,...]                  │      │
│  │    │    ├─ createdAt: "ISO timestamp"                 │      │
│  │    │    └─ lastModified: "ISO timestamp"              │      │
│  │    └─ entry_name_2/                                   │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Components

#### HTML Structure (`index.html`)
- **Purpose:** Semantic markup for UI structure
- **Key Sections:**
  - Header with connection status
  - Entry management controls
  - Statistics dashboard
  - Interactive grid container
  - Navigation and export tools

#### CSS Styling (`style.css`)
- **Purpose:** Responsive visual design
- **Features:**
  - CSS Grid for device array layout
  - Flexbox for control panels
  - CSS animations for interactions
  - Media queries for mobile responsiveness
  - Custom color scheme for measurement states

#### JavaScript Logic (`script.js`)
- **Purpose:** Application business logic
- **Architecture:**
  ```
  ┌─────────────────────────────────────┐
  │      State Management               │
  │  (entries, currentEntry, db refs)   │
  └──────────────┬──────────────────────┘
                 │
      ┌──────────┼──────────┐
      │          │           │
  ┌───▼────┐ ┌──▼────┐ ┌───▼─────┐
  │Firebase│ │  UI   │ │  Data   │
  │ Sync   │ │Update │ │ Export  │
  └────────┘ └───────┘ └─────────┘
  ```

### 2. Data Flow Architecture

#### Write Operation Flow
```
1. User clicks device cell
   ↓
2. handleCellClick(index) triggered
   ↓
3. Update local state (currentEntry.measurements[index])
   ↓
4. Update UI immediately (optimistic update)
   ↓
5. Call saveEntry(entry)
   ↓
6. Firebase.set() writes to cloud
   ↓
7. Firebase triggers 'value' event
   ↓
8. All connected clients receive update
   ↓
9. UI updates across all browsers
```

#### Read Operation Flow
```
1. Page loads / Firebase connects
   ↓
2. entriesRef.on('value', ...) listener attached
   ↓
3. Initial snapshot received
   ↓
4. entries[] array populated
   ↓
5. updateEntrySelector() called
   ↓
6. Dropdown populated with available entries
   ↓
7. Continuous listening for changes
```

## Data Model

### Entry Object Structure
```javascript
{
  name: String,           // Unique identifier (sanitized)
  size: Number,           // 8 or 128
  createdAt: String,      // ISO 8601 timestamp
  lastModified: String,   // ISO 8601 timestamp
  measurements: Array     // size² length array
}
```

### Measurement State Encoding
- `0` = Unmeasured (default)
- `1` = Successful (green)
- `2` = Failed (red)
- `3` = Misaligned (yellow)

### Database Schema
```
/entries
  /{sanitized_entry_name}
    /name: "Original Entry Name"
    /size: 128
    /createdAt: "2024-11-07T12:00:00.000Z"
    /lastModified: "2024-11-07T14:30:00.000Z"
    /measurements: [0, 1, 2, 3, 0, 1, ...]
```

## Key Algorithms

### 1. Grid Rendering Algorithm
```javascript
Time Complexity: O(n²) where n = array size
Space Complexity: O(n²)

for i from 0 to (size × size - 1):
  create cell element
  calculate row = i ÷ size
  calculate col = i mod size
  apply state styling
  attach click handler
  append to grid
```

### 2. Coordinate Conversion
```javascript
// Convert (row, col) to linear index
index = row × size + col

// Convert linear index to (row, col)
row = floor(index ÷ size)
col = index mod size
```

### 3. State Cycling
```javascript
newState = (currentState + 1) mod 4
// 0 → 1 → 2 → 3 → 0 (cycle through states)
```

## Performance Optimizations

### 1. Rendering Optimizations
- **Adaptive Cell Sizing:** 30px for 8×8, 8px for 128×128
- **CSS Transforms:** Hardware-accelerated hover effects
- **Viewport Clipping:** Only visible cells rendered initially

### 2. Database Optimizations
- **Debouncing:** Prevent excessive writes during rapid clicks
- **Optimistic Updates:** UI updates before database confirmation
- **Connection Pooling:** Persistent WebSocket connection

### 3. Memory Management
- **Efficient Storage:** 4 states fit in 2 bits (future optimization)
- **Garbage Collection:** Event listeners properly cleaned up
- **Array Reuse:** In-place updates to measurements array

## Security Model

### Current Implementation (Development)
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
**Use Case:** Small trusted team (2-5 users)

### Production-Ready Rules (Recommended)
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "entries": {
      "$entryId": {
        ".validate": "newData.hasChildren(['name', 'size', 'measurements'])",
        "size": {
          ".validate": "newData.val() == 8 || newData.val() == 128"
        },
        "measurements": {
          ".validate": "newData.isString() && newData.val().length <= 50000"
        }
      }
    }
  }
}
```

## Scalability Considerations

### Current Limits
- **Array Size:** Up to 128×128 (16,384 devices)
- **Entry Size:** ~200 KB per 128×128 array
- **Concurrent Users:** 100 (Firebase free tier)
- **Storage:** 1 GB (Firebase free tier)
- **Bandwidth:** 10 GB/month (Firebase free tier)

### Scaling Strategy
```
Current: 1-10 users → Firebase Realtime Database (Free)
         ↓
Growth: 10-100 users → Firebase (Spark plan, still free)
         ↓
Enterprise: 100+ users → Firebase Blaze (pay-as-you-go)
         ↓
Large Scale: 1000+ users → Consider sharding by lab/project
```

## Error Handling

### Connection Failures
```javascript
try {
  await firebase.operation()
} catch (error) {
  console.error('Firebase error:', error)
  alert('Operation failed. Check connection.')
  // Graceful degradation: continue with local state
}
```

### Data Validation
- Entry name sanitization (remove Firebase-prohibited characters)
- Size validation (only 8 or 128)
- Measurements array length validation
- Duplicate name prevention

## Browser Compatibility

### Supported Browsers
| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 90+     | ✅ Full Support |
| Firefox | 88+     | ✅ Full Support |
| Safari  | 14+     | ✅ Full Support |
| Edge    | 90+     | ✅ Full Support |

### Required Features
- ES6+ JavaScript
- CSS Grid
- Flexbox
- WebSocket (Firebase)
- LocalStorage (optional fallback)

## Testing Strategy

### Manual Testing Checklist
- [ ] Create 8×8 entry
- [ ] Create 128×128 entry
- [ ] Click cells to cycle states
- [ ] Test keyboard navigation
- [ ] Export JSON and verify format
- [ ] Export PNG and verify visualization
- [ ] Import JSON and verify data restoration
- [ ] Test multi-user sync (two browsers)
- [ ] Test offline behavior
- [ ] Test mobile responsiveness

### Performance Benchmarks
- Initial load: < 2 seconds
- Grid render (128×128): < 500ms
- Cell click response: < 50ms
- Firebase sync latency: < 200ms
- Export operation: < 1 second

## Deployment Architecture

```
Developer Push
     ↓
GitHub Repository
     ↓
GitHub Actions (Automatic)
     ↓
GitHub Pages CDN
     ↓
Global Edge Locations
     ↓
End Users
```

### Deployment Steps
1. Push to `main` branch
2. GitHub Actions builds static site
3. Deployed to GitHub Pages
4. Available at: https://krishkc5.github.io/crossbar-measurement-tracker/
5. CDN caching (< 5 min propagation)

## Future Enhancements

### Planned Features
1. **Authentication:** Firebase Auth with email/password
2. **User Roles:** Admin, Researcher, Viewer permissions
3. **Data Analytics:** Charts and trend analysis
4. **Batch Import:** CSV/Excel import support
5. **API Access:** RESTful API for external integrations
6. **Offline Mode:** Service Worker for full offline capability
7. **Version History:** Track changes over time
8. **Comments:** Add notes to specific devices

### Technical Debt
- Add comprehensive unit tests (Jest)
- Implement E2E testing (Cypress)
- Add TypeScript for type safety
- Optimize bundle size (tree-shaking)
- Implement code splitting for faster loads

---

*Last Updated: November 7, 2024*
