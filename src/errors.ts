/**
 * Base error class for all Snowflake-related errors
 */
export class SnowflakeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SnowflakeError';
	}
}

/**
 * Error thrown when the configuration is invalid
 */
export class ConfigurationError extends SnowflakeError {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

/**
 * Error thrown when trying to decompose an invalid ID
 */
export class InvalidIdError extends SnowflakeError {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidIdError';
	}
}
