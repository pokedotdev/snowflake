/**
 * Snowflake ID Generator
 *
 * A lightweight library for generating unique, sortable 64-bit IDs
 * based on Twitter's Snowflake algorithm.
 *
 * @example
 * ```typescript
 * import { SnowflakeGenerator } from '@pokedotdev/snowflake';
 *
 * const generator = new SnowflakeGenerator({ workerId: 1 });
 * const id = generator.generate();
 * console.log(id); // 1234567890123456789n
 *
 * // Decompose ID back to components
 * const components = generator.decompose(id);
 * console.log(components);
 * // {
 * //   timestamp: 1640995200000,
 * //   workerId: 1,
 * //   processId: 0,
 * //   sequence: 42
 * // }
 * ```
 */

export {
	ClockBackwardsError,
	ConfigurationError,
	InvalidIdError,
	SnowflakeError,
	TimestampExhaustedError,
} from './errors';
export { SnowflakeGenerator } from './snowflake';
export type {
	BitAllocation,
	SnowflakeComponents,
	SnowflakeConfig,
} from './types';
