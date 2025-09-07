/**
 * Bit allocation configuration for Snowflake ID components
 */
export interface BitAllocation {
	/** Number of bits for worker ID */
	workerId: number;
	/** Number of bits for process ID */
	processId: number;
	/** Number of bits for sequence */
	sequence: number;
}

/**
 * Configuration interface for Snowflake ID generation
 */
export interface SnowflakeConfig {
	/** Custom epoch timestamp in milliseconds (default: 20202020-01-01) */
	epoch?: number;
	/** Worker ID for this instance */
	workerId: number;
	/** Process ID for this instance (default: 0) */
	processId?: number;
	/** Bit allocation configuration (default: { workerId: 10, processId: 0, sequence: 12 }) */
	bits?: BitAllocation;
}

/**
 * Components of a decomposed Snowflake ID
 */
export interface SnowflakeComponents {
	/** Timestamp in milliseconds since epoch */
	timestamp: number;
	/** Worker ID */
	workerId: number;
	/** Process ID */
	processId: number;
	/** Sequence number */
	sequence: number;
}

/**
 * Internal configuration with all defaults applied
 */
export interface ResolvedSnowflakeConfig {
	epoch: number;
	workerId: number;
	processId: number;
	bits: BitAllocation;
}
