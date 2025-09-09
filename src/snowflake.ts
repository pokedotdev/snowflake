import type {
	SnowflakeConfig,
	SnowflakeComponents,
	ResolvedSnowflakeConfig,
	BitAllocation,
} from "./types";
import {
	ConfigurationError,
	ClockBackwardsError,
	TimestampExhaustedError,
	InvalidIdError,
} from "./errors";

/**
 * Snowflake ID generator
 *
 * Generates unique 64-bit IDs consisting of:
 * - 1 bit: unused (always 0)
 * - 41 bits: timestamp (milliseconds since custom epoch)
 * - configurable bits: worker ID + process ID + sequence
 *
 * @example
 * ```typescript
 * const generator = new SnowflakeGenerator({
 *   workerId: 1,
 *   bits: { workerId: 10, processId: 0, sequence: 12 }
 * });
 * const id = generator.generate();
 * console.log(id); // 1234567890123456789n
 * ```
 */
export class SnowflakeGenerator {
	private readonly config: ResolvedSnowflakeConfig;
	private readonly maxWorker: number;
	private readonly maxProcess: number;
	private readonly maxSequence: number;
	private readonly workerShift: number;
	private readonly processShift: number;
	private readonly timestampShift: number;
	private readonly maxTimestamp: number;

	private sequence = 0;
	private lastTimestamp = -1;

	/**
	 * Default epoch: January 1, 2020 00:00:00 UTC (more reasonable for current dates)
	 */
	private static readonly DEFAULT_EPOCH = 1577836800000; // 2020-01-01 00:00:00 UTC

	/**
	 * Default bit allocation: 10 bits worker, 0 bits process, 12 bits sequence
	 */
	private static readonly DEFAULT_BITS: BitAllocation = {
		workerId: 10,
		processId: 0,
		sequence: 12,
	};

	constructor(config: SnowflakeConfig) {
		this.config = this.resolveConfig(config);
		this.validateConfig();

		// Calculate bit shifts and maximum values
		this.maxSequence =
			this.config.bits.sequence > 0
				? (1 << this.config.bits.sequence) - 1
				: 0;
		this.maxProcess =
			this.config.bits.processId > 0
				? (1 << this.config.bits.processId) - 1
				: 0;
		this.maxWorker =
			this.config.bits.workerId > 0
				? (1 << this.config.bits.workerId) - 1
				: 0;

		this.workerShift = this.config.bits.sequence;
		this.processShift =
			this.config.bits.sequence + this.config.bits.workerId;
		this.timestampShift =
			this.config.bits.sequence +
			this.config.bits.workerId +
			this.config.bits.processId;

		// Maximum timestamp that can be represented (41 bits)
		this.maxTimestamp = Number((1n << 41n) - 1n);
	}

	/**
	 * Resolve configuration with defaults
	 */
	private resolveConfig(config: SnowflakeConfig): ResolvedSnowflakeConfig {
		return {
			epoch: config.epoch ?? SnowflakeGenerator.DEFAULT_EPOCH,
			workerId: config.workerId,
			processId: config.processId ?? 0,
			bits: config.bits ?? SnowflakeGenerator.DEFAULT_BITS,
		};
	}

	/**
	 * Validate configuration parameters
	 */
	private validateConfig(): void {
		const { workerId, processId, epoch, bits } = this.config;

		// Check if epoch is in the future
		if (epoch > Date.now()) {
			throw new ConfigurationError("Epoch cannot be in the future");
		}

		// Check bit allocations
		if (bits.workerId < 0 || bits.processId < 0 || bits.sequence < 0) {
			throw new ConfigurationError(
				"All bit allocations must be non-negative",
			);
		}

		if (
			bits.workerId === 0 &&
			bits.processId === 0 &&
			bits.sequence === 0
		) {
			throw new ConfigurationError(
				"At least one bit allocation must be greater than 0",
			);
		}

		// Check total bits don't exceed available space (22 bits = 64 - 1 sign - 41 timestamp)
		const totalBits = bits.workerId + bits.processId + bits.sequence;
		if (totalBits > 22) {
			throw new ConfigurationError(
				`Total bits (${totalBits}) exceed maximum available bits (22). ` +
					`Got: workerId=${bits.workerId}, processId=${bits.processId}, sequence=${bits.sequence}`,
			);
		}

		// Check worker and process IDs are within range
		if (workerId < 0) {
			throw new ConfigurationError("Worker ID cannot be negative");
		}
		if (processId < 0) {
			throw new ConfigurationError("Process ID cannot be negative");
		}

		const maxWorker = bits.workerId > 0 ? (1 << bits.workerId) - 1 : 0;
		const maxProcess = bits.processId > 0 ? (1 << bits.processId) - 1 : 0;

		if (workerId > maxWorker) {
			throw new ConfigurationError(
				`Worker ID (${workerId}) exceeds maximum value (${maxWorker}) for ${bits.workerId} bits`,
			);
		}

		if (processId > maxProcess) {
			throw new ConfigurationError(
				`Process ID (${processId}) exceeds maximum value (${maxProcess}) for ${bits.processId} bits`,
			);
		}
	}

	/**
	 * Generate a new unique Snowflake ID
	 *
	 * @returns A unique ID as a bigint
	 * @throws {ClockBackwardsError} When system clock goes backwards
	 * @throws {TimestampExhaustedError} When maximum timestamp is reached
	 *
	 * @example
	 * ```typescript
	 * const id = generator.generate();
	 * console.log(id); // 1234567890123456789n
	 * ```
	 */
	generate(): bigint {
		let timestamp = this.getCurrentTimestamp();

		// Handle clock going backwards
		if (timestamp < this.lastTimestamp) {
			throw new ClockBackwardsError(
				`Clock moved backwards. Refusing to generate id for ${this.lastTimestamp - timestamp}ms`,
			);
		}

		// Handle same millisecond
		if (timestamp === this.lastTimestamp) {
			this.sequence = (this.sequence + 1) & this.maxSequence;

			// Sequence overflow - wait for next millisecond
			if (this.sequence === 0) {
				timestamp = this.waitForNextMillisecond(timestamp);
			}
		} else {
			this.sequence = 0;
		}

		this.lastTimestamp = timestamp;

		// Check if timestamp exceeds maximum
		if (timestamp > this.maxTimestamp) {
			throw new TimestampExhaustedError("Maximum timestamp exceeded");
		}

		return this.composeId(
			timestamp,
			this.config.workerId,
			this.config.processId,
			this.sequence,
		);
	}

	/**
	 * Compose an ID from its components
	 *
	 * @param timestamp Timestamp in milliseconds since epoch
	 * @param workerId Worker ID
	 * @param processId Process ID
	 * @param sequence Sequence number
	 * @returns Composed ID as a bigint
	 * @throws {ConfigurationError} When components exceed their bit limits
	 *
	 * @example
	 * ```typescript
	 * const id = generator.compose(1640995200000, 1, 0, 42);
	 * console.log(id); // 1234567890123456789n
	 * ```
	 */
	compose(
		timestamp: number,
		workerId: number,
		processId: number,
		sequence: number,
	): bigint {
		// Validate inputs
		if (timestamp < 0) {
			throw new ConfigurationError("Timestamp cannot be negative");
		}
		if (workerId < 0 || workerId > this.maxWorker) {
			throw new ConfigurationError(
				`Worker ID must be between 0 and ${this.maxWorker}`,
			);
		}
		if (processId < 0 || processId > this.maxProcess) {
			throw new ConfigurationError(
				`Process ID must be between 0 and ${this.maxProcess}`,
			);
		}
		if (sequence < 0 || sequence > this.maxSequence) {
			throw new ConfigurationError(
				`Sequence must be between 0 and ${this.maxSequence}`,
			);
		}

		const adjustedTimestamp = timestamp - this.config.epoch;
		if (adjustedTimestamp > this.maxTimestamp) {
			throw new ConfigurationError("Timestamp exceeds maximum value");
		}

		return this.composeId(adjustedTimestamp, workerId, processId, sequence);
	}

	/**
	 * Decompose an ID back to its components
	 *
	 * @param id The ID to decompose
	 * @returns The components of the ID
	 * @throws {InvalidIdError} When the ID format is invalid
	 *
	 * @example
	 * ```typescript
	 * const components = generator.decompose(1234567890123456789n);
	 * console.log(components);
	 * // {
	 * //   timestamp: 1640995200000,
	 * //   workerId: 1,
	 * //   processId: 0,
	 * //   sequence: 42
	 * // }
	 * ```
	 */
	decompose(id: bigint): SnowflakeComponents {
		// Validate input
		if (typeof id !== "bigint") {
			throw new InvalidIdError("ID must be a bigint");
		}

		if (id < 0n) {
			throw new InvalidIdError("ID cannot be negative");
		}

		// Extract components using bit operations
		const sequence = Number(id & BigInt(this.maxSequence));
		const workerId = Number(
			(id >> BigInt(this.workerShift)) & BigInt(this.maxWorker),
		);
		const processId = Number(
			(id >> BigInt(this.processShift)) & BigInt(this.maxProcess),
		);
		const adjustedTimestamp = Number(id >> BigInt(this.timestampShift));

		return {
			timestamp: adjustedTimestamp + this.config.epoch,
			workerId,
			processId,
			sequence,
		};
	}

	/**
	 * Get current timestamp relative to epoch
	 */
	private getCurrentTimestamp(): number {
		return Date.now() - this.config.epoch;
	}

	/**
	 * Wait for the next millisecond
	 */
	private waitForNextMillisecond(currentTimestamp: number): number {
		let timestamp = this.getCurrentTimestamp();
		while (timestamp <= currentTimestamp) {
			timestamp = this.getCurrentTimestamp();
		}
		return timestamp;
	}

	/**
	 * Compose ID from components using bit operations
	 */
	private composeId(
		timestamp: number,
		workerId: number,
		processId: number,
		sequence: number,
	): bigint {
		// Use BigInt for 64-bit operations
		const timestampBits = BigInt(timestamp) << BigInt(this.timestampShift);
		const processIdBits = BigInt(processId) << BigInt(this.processShift);
		const workerIdBits = BigInt(workerId) << BigInt(this.workerShift);
		const sequenceBits = BigInt(sequence);

		const id = timestampBits | processIdBits | workerIdBits | sequenceBits;
		return id;
	}
}
