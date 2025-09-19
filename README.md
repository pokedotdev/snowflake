# Snowflake ID Generator

A lightweight and fast TypeScript library for generating unique, sortable 64-bit IDs inspired by [Twitter's Snowflake algorithm](https://en.wikipedia.org/wiki/Snowflake_ID) and [Discord's ID system](https://discord.com/developers/docs/reference#snowflakes).

## Features

- ⚡ **Zero Dependencies**: Lightweight and fast
- 🔒 **Sequence Safe**: Handle rapid generation with sequence overflow protection
- ⚙️ **Configurable**: Customize bit allocations for your use case
- 🛡️ **Graceful Error Handling**: Handles clock drift and sequence overflow cases without throwing errors
- 🎯 **TypeScript First**: Full type safety with comprehensive interfaces

## Installation

```bash
npm install @pokedotdev/snowflake
```

## Quick Start

```typescript
import { SnowflakeGenerator } from '@pokedotdev/snowflake';

// Create a generator with a unique worker ID
const generator = new SnowflakeGenerator({ workerId: 1 });

// Generate unique IDs
const id1 = generator.generate(); // 1234567890123456789n
const id2 = generator.generate(); // 1234567890123456790n

// IDs are naturally sortable by generation time
console.log(id1 < id2); // true
```

## Configuration

The library uses a flexible bit allocation system. By default:
- **1 bit**: Unused (always 0)
- **41 bits**: Timestamp (milliseconds since epoch)
- **10 bits**: Worker ID (0-1023)
- **0 bits**: Process ID
- **12 bits**: Sequence (0-4095 per millisecond)

### Basic Configuration

```typescript
const generator = new SnowflakeGenerator({
  workerId: 42,           // Required: unique worker identifier
  processId: 0,           // Optional: process identifier (default: 0)
  epoch: 1640995200000,   // Optional: custom epoch (default: 2020-01-01)
});
```

### Advanced Configuration

Customize bit allocations for your specific needs using the `bits` configuration object:

```typescript
const generator = new SnowflakeGenerator({
  workerId: 1,
  bits: {
    workerId: 8,     // 256 possible workers (0-255)
    processId: 4,    // 16 possible processes (0-15)
    sequence: 10,    // 1024 IDs per millisecond (0-1023)
    // Total: 8 + 4 + 10 = 22 bits (within 64-bit limit)
  }
});
```

## API Reference

### SnowflakeGenerator

#### Constructor

```typescript
new SnowflakeGenerator(config: SnowflakeConfig)
```

#### Methods

##### `generate(): bigint`

Generate a new unique Snowflake ID.

```typescript
const id = generator.generate();
console.log(id); // 1234567890123456789n
```

##### `compose(timestamp: number, workerId: number, processId: number, sequence: number): bigint`

Create an ID from individual components.

```typescript
const id = generator.compose(
  Date.now(),  // timestamp
  1,           // workerId
  0,           // processId
  42           // sequence
);
```

##### `decompose(id: bigint): SnowflakeComponents`

Extract components from an existing ID.

```typescript
const components = generator.decompose(1234567890123456789n);
console.log(components);
// {
//   timestamp: 1640995200000,
//   workerId: 1,
//   processId: 0,
//   sequence: 42
// }
```

### Configuration Interface

```typescript
interface SnowflakeConfig {
  /** Custom epoch timestamp in milliseconds (default: 2020-01-01) */
  epoch?: number;
  /** Worker ID for this instance */
  workerId: number;
  /** Process ID for this instance (default: 0) */
  processId?: number;
  /** Bit allocation configuration (optional) */
  bits?: BitAllocation;
}

interface BitAllocation {
  /** Number of bits for worker ID (default: 10) */
  workerId: number;
  /** Number of bits for process ID (default: 0) */
  processId: number;
  /** Number of bits for sequence (default: 12) */
  sequence: number;
}
```

### Components Interface

```typescript
interface SnowflakeComponents {
  /** Timestamp in milliseconds since epoch */
  timestamp: number;
  /** Worker ID */
  workerId: number;
  /** Process ID */
  processId: number;
  /** Sequence number */
  sequence: number;
}
```

## Error Handling

The library provides specific error classes for different failure scenarios:

```typescript
import {
  SnowflakeGenerator,
  ConfigurationError,
  InvalidIdError
} from '@pokedotdev/snowflake';

try {
  const generator = new SnowflakeGenerator({
    workerId: 2000,
    bits: { workerId: 10, processId: 0, sequence: 12 }
  });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration error:', error.message);
    // "Worker ID (2000) exceeds maximum value (1023) for 10 bits"
  }
}
```

### Error Types

- **`ConfigurationError`**: Invalid configuration parameters
- **`InvalidIdError`**: Invalid ID format during decomposition

## Best Practices

### 1. Choose Appropriate Bit Allocations

```typescript
// For small deployments (fewer workers, more throughput)
const generator = new SnowflakeGenerator({
  workerId: 1,
  bits: {
    workerId: 8,     // 256 workers max
    processId: 0,    // No process distinction
    sequence: 14,    // 65,536 IDs/ms
  }
});

// For large deployments (more workers, adequate throughput)
const generator = new SnowflakeGenerator({
  workerId: 1,
  bits: {
    workerId: 10,    // 1,024 workers max
    processId: 0,    // No process distinction
    sequence: 12,    // 4,096 IDs/ms
  }
});
```

### 2. Use Consistent Epochs

```typescript
// Use the same epoch across all services
const COMPANY_EPOCH = new Date('2024-01-01').getTime();

const generator = new SnowflakeGenerator({
  workerId: 1,
  epoch: COMPANY_EPOCH,
});
```

## Validation

The library validates all configurations at construction time:

```typescript
// ✅ Valid - total bits: 8 + 4 + 10 = 22
new SnowflakeGenerator({
  workerId: 1,
  bits: {
    workerId: 8,
    processId: 4,
    sequence: 10,
  }
});

// ❌ Invalid - total bits: 10 + 10 + 10 = 30 > 22
new SnowflakeGenerator({
  workerId: 1,
  bits: {
    workerId: 10,
    processId: 10,
    sequence: 10,
  }
}); // Throws ConfigurationError
```

## Predefined Configurations

For common use cases, you can use these predefined bit allocations:

```typescript
// Default: Good balance for most applications
const defaultConfig = { workerId: 10, processId: 0, sequence: 12 };

// Distributed: For microservices with multiple processes
const distributedConfig = { workerId: 8, processId: 4, sequence: 10 };

// High-throughput: Maximum sequence capacity
const highThroughputConfig = { workerId: 6, processId: 0, sequence: 16 };

// Example usage
const generator = new SnowflakeGenerator({
  workerId: 1,
  bits: distributedConfig
});
```

## Development

Install dependencies:
```bash
pnpm install
```

Run tests:
```bash
pnpm run test
```

Build the library:
```bash
pnpm run build
```

Type checking:
```bash
pnpm run typecheck
```

Format code:
```bash
pnpm run format
```

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
