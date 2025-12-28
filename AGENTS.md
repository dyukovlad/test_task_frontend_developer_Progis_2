# AGENTS.md - Development Guidelines

This document provides comprehensive guidelines for coding agents working on the ZuluGIS Map App, a React TypeScript application using Leaflet for geospatial visualization.

## 🚀 Build, Lint & Test Commands

### Development Server
```bash
npm run dev
```
Starts the Vite development server on http://localhost:5173 with hot module replacement.

### Production Build
```bash
npm run build
```
Compiles TypeScript and builds the application for production using Vite.

### Linting
```bash
npm run lint
```
Runs ESLint with TypeScript support across `.ts` and `.tsx` files. Uses `--max-warnings 0` for strict enforcement.

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing.

### Testing
Currently no test framework is configured. To add testing:
1. Install Vitest: `npm install -D vitest @testing-library/react @testing-library/jest-dom`
2. Add test script: `"test": "vitest"` to package.json
3. Run single test: `npm run test -- path/to/test.spec.tsx`
4. Run with coverage: `npm run test -- --coverage`

### Type Checking
```bash
npx tsc --noEmit
```
Runs TypeScript compiler in check mode without emitting files.

## 📋 Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2020
- **JSX**: react-jsx (no React imports needed)
- **Strict mode**: Enabled
- **Unused variables**: Prohibited (`noUnusedLocals: true`, `noUnusedParameters: true`)

### Import Organization
```typescript
// 1. React imports first
import React, { useEffect, useRef } from 'react';

// 2. External libraries (alphabetical)
import L from 'leaflet';
import { ThemeProvider } from '@mui/material/styles';

// 3. Local imports (relative paths)
import { ZWSService } from '../services/ZWSService';
import { escapeHtml } from '../utils/escapeHtml';

// 4. Type imports (use `import type` when possible)
import type { MapProps } from './Map';
```

### Component Structure
```typescript
interface ComponentProps {
  // Required props first
  requiredProp: string;
  // Optional props with defaults
  optionalProp?: number;
  // Event handlers
  onAction?: () => void;
}

const ComponentName: React.FC<ComponentProps> = ({
  requiredProp,
  optionalProp = DEFAULT_VALUE,
  onAction,
}) => {
  // 1. useRef hooks
  const ref = useRef<ElementType | null>(null);

  // 2. useState hooks
  const [state, setState] = useState<SType>(initialValue);

  // 3. useCallback/useMemo hooks
  const handleAction = useCallback(() => {
    // implementation
  }, [dependencies]);

  // 4. useEffect hooks
  useEffect(() => {
    // side effects
    return () => {
      // cleanup
    };
  }, [dependencies]);

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

### Naming Conventions

#### Files and Directories
- **Components**: `PascalCase.tsx` (e.g., `Map.tsx`, `LayerControl.tsx`)
- **Utilities**: `camelCase.ts` (e.g., `geometryUtils.ts`, `wfsParser.ts`)
- **Services**: `PascalCase.ts` (e.g., `ZWSService.ts`)
- **Hooks**: `useCamelCase.ts` (e.g., `useWfsLayer.ts`)
- **Types/Interfaces**: `PascalCase.ts` (e.g., `types.ts`)

#### Variables and Functions
- **Variables**: `camelCase` (e.g., `mapRef`, `zwsLayerName`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_ZOOM`, `WINDOW_POPUP`)
- **Functions**: `camelCase` (e.g., `parseCoordinates`, `buildPropsPopupHtml`)
- **Components**: `PascalCase` (e.g., `Map`, `ZWSLayer`)
- **Types/Interfaces**: `PascalCase` (e.g., `MapProps`, `ZWSAuth`)

### TypeScript Types

#### Interface vs Type
- Use `interface` for object shapes that may be extended
- Use `type` for unions, primitives, and complex types

```typescript
// Interface for component props (extensible)
interface MapProps {
  center?: [number, number];
  zoom?: number;
}

// Type for specific data structures
type GeometryData = PolygonCoordinates | PointCoordinates;

// Generic types
type ApiResponse<T> = {
  data: T;
  error?: string;
};
```

#### Optional Properties
```typescript
interface ServiceOptions {
  // Required
  endpoint: string;
  // Optional with undefined union
  timeout?: number;
  // Optional with default in implementation
  retries?: number;
}
```

### Error Handling

#### Async Operations
```typescript
const fetchData = async (): Promise<DataType | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.info('Request was cancelled');
      return null;
    }
    console.error('Failed to fetch data:', error);
    return null;
  }
};
```

#### Null/Undefined Checks
```typescript
// Use optional chaining
const value = object?.property?.nested;

// Nullish coalescing for defaults
const result = apiResponse ?? defaultValue;

// Guard clauses
if (!requiredParam) {
  throw new Error('Required parameter missing');
}
```

### React Patterns

#### Hooks Usage
- **useRef**: For DOM elements and mutable values that don't trigger re-renders
- **useCallback**: For event handlers passed to child components
- **useMemo**: For expensive computations
- **useEffect**: For side effects with proper cleanup

#### Event Handling
```typescript
const handleMapClick = useCallback(
  (event: L.LeafletMouseEvent) => {
    event.originalEvent?.preventDefault();
    // Handle click logic
  },
  [dependencies]
);

// Attach to map
useEffect(() => {
  map.on('click', handleMapClick);
  return () => map.off('click', handleMapClick);
}, [map, handleMapClick]);
```

### Async Patterns

#### AbortController for Cancellation
```typescript
const abortRef = useRef<AbortController | null>(null);

const fetchData = useCallback(async () => {
  // Cancel previous request
  abortRef.current?.abort();

  // Create new controller
  const controller = new AbortController();
  abortRef.current = controller;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    // Process response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.info('Request cancelled');
      return;
    }
    throw error;
  }
}, [url]);
```

### Logging

#### Appropriate Log Levels
```typescript
// Development debugging
console.info('WFS fetch aborted', url);

// Warnings for recoverable issues
console.warn('Failed to load WFS initial data', error);

// Errors for failures
console.error('ZWS error', error);
```

### File Structure

```
src/
├── components/          # Reusable UI components
│   ├── Map.tsx         # Main map component
│   └── defaults.ts     # Default values/constants
├── hooks/              # Custom React hooks
│   └── useWfsLayer.ts
├── services/           # API service classes
│   └── ZWSService.ts
├── Layer/              # Map layer implementations
│   └── ZWSLayer.ts
├── utils/              # Utility functions
│   ├── geometryUtils.ts
│   ├── wfsParser.ts
│   └── escapeHtml.ts
├── App.tsx             # Root component
└── main.tsx            # Application entry point
```

### Code Comments

#### JSDoc for Functions
```typescript
/**
 * Parses coordinates from various string formats
 * @param value - String containing coordinates
 * @returns Array of coordinate objects or null if parsing fails
 */
export function parseCoordinates(value: string): Coordinate[] | null {
  // Implementation
}
```

#### Inline Comments for Complex Logic
```typescript
// Extract coordinates from ZWS fields for polygon highlighting
const coordinates = extractCoordinatesFromFields(fields);
if (coordinates && coordinates.length > 0) {
  drawHighlightArea(coordinates);
}
```

### Performance Considerations

#### Avoid Unnecessary Re-renders
- Use `useCallback` for event handlers
- Use `useMemo` for expensive computations
- Memoize components when appropriate: `React.memo(Component)`

#### Memory Management
- Always clean up event listeners in useEffect return functions
- Cancel async operations with AbortController
- Clear map layers and controls on component unmount

### Security Best Practices

#### Input Sanitization
```typescript
import { escapeHtml } from '../utils/escapeHtml';

// Sanitize user input before inserting into DOM
const safeHtml = `<strong>${escapeHtml(userInput)}</strong>`;
```

#### API Security
- Use HTTPS for production APIs
- Implement proper authentication headers
- Validate API responses before processing
- Handle sensitive data appropriately (no logging of credentials)

### Commit Message Conventions

Follow conventional commit format:
```
feat: add polygon highlighting feature
fix: resolve WFS layer loading issue
refactor: simplify coordinate parsing logic
docs: update API documentation
```

### Pull Request Guidelines

- Ensure all lint checks pass: `npm run lint`
- Run type checking: `npx tsc --noEmit`
- Test build process: `npm run build`
- Include screenshots for UI changes
- Update documentation for new features
- Ensure proper error handling for new functionality

---

This document should be updated as the codebase evolves. Last updated: December 2025</content>
<filePath>AGENTS.md