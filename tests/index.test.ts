import { expect, test, describe, beforeEach, vi } from "vitest";
import {
	SnowflakeGenerator,
	ConfigurationError,
	ClockBackwardsError,
	TimestampExhaustedError,
	InvalidIdError,
	type SnowflakeConfig,
} from "../src/index";

describe("SnowflakeGenerator", () => {
	describe("Configuration", () => {
		test("should create generator with minimal config", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			expect(generator).toBeInstanceOf(SnowflakeGenerator);
		});

		test("should use default epoch (2020-01-01)", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const id = generator.generate();
			const components = generator.decompose(id);
			// Timestamp should be reasonable (after 2020-01-01)
			expect(components.timestamp).toBeGreaterThan(1577836800000);
		});

		test("should use custom epoch", () => {
			const customEpoch = 1640995200000; // 2022-01-01
			const generator = new SnowflakeGenerator({
				workerId: 1,
				epoch: customEpoch,
			});
			const id = generator.generate();
			const components = generator.decompose(id);
			expect(components.timestamp).toBeGreaterThan(customEpoch);
		});

		test("should use default bit allocations", () => {
			const generator = new SnowflakeGenerator({ workerId: 1023 }); // Max for 10 bits
			expect(generator).toBeInstanceOf(SnowflakeGenerator);
		});

		test("should use custom bit allocations", () => {
			const generator = new SnowflakeGenerator({
				workerId: 1,
				bits: {
					workerId: 5,
					processId: 5,
					sequence: 12,
				},
			});
			expect(generator).toBeInstanceOf(SnowflakeGenerator);
		});

		test("should validate total bits don't exceed 22", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 1,
						bits: {
							workerId: 10,
							processId: 10,
							sequence: 10, // Total: 30 > 22
						},
					}),
			).toThrow(ConfigurationError);
		});

		test("should validate worker ID within range", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 1024, // Max for 10 bits is 1023
					}),
			).toThrow(ConfigurationError);
		});

		test("should validate process ID within range", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 1,
						processId: 1024,
						bits: {
							workerId: 10,
							processId: 10,
							sequence: 2,
						},
					}),
			).toThrow(ConfigurationError);
		});

		test("should reject negative worker ID", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: -1,
					}),
			).toThrow(ConfigurationError);
		});

		test("should reject negative process ID", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 1,
						processId: -1,
					}),
			).toThrow(ConfigurationError);
		});

		test("should reject epoch in the future", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 1,
						epoch: Date.now() + 10000,
					}),
			).toThrow(ConfigurationError);
		});

		test("should reject negative bit allocations", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 1,
						bits: {
							workerId: -1,
							processId: 0,
							sequence: 12,
						},
					}),
			).toThrow(ConfigurationError);
		});

		test("should reject all zero bit allocations", () => {
			expect(
				() =>
					new SnowflakeGenerator({
						workerId: 0,
						bits: {
							workerId: 0,
							processId: 0,
							sequence: 0,
						},
					}),
			).toThrow(ConfigurationError);
		});
	});

	describe("ID Generation", () => {
		test("should generate unique IDs", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const ids = new Set();

			for (let i = 0; i < 1000; i++) {
				const id = generator.generate();
				expect(ids.has(id)).toBe(false);
				ids.add(id);
			}
		});

		test("should generate IDs as strings", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const id = generator.generate();
			expect(typeof id).toBe("string");
		});

		test("should generate sortable IDs", async () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const ids: string[] = [];

			for (let i = 0; i < 100; i++) {
				ids.push(generator.generate());
				// Small delay to ensure different timestamps
				if (i % 10 === 0) {
					await new Promise((resolve) => setTimeout(resolve, 1));
				}
			}

			const sorted = [...ids].sort();
			expect(ids).toEqual(sorted);
		});

		test("should handle high-frequency generation", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const ids = new Set();

			// Generate many IDs in same millisecond
			for (let i = 0; i < 5000; i++) {
				ids.add(generator.generate());
			}

			expect(ids.size).toBe(5000);
		});

		test("should handle sequence overflow by waiting", async () => {
			const generator = new SnowflakeGenerator({
				workerId: 1,
				bits: {
					workerId: 10,
					processId: 0,
					sequence: 2, // Max sequence = 3
				},
			});

			const startTime = Date.now();
			const ids: string[] = [];

			// Generate more IDs than sequence allows in same millisecond
			for (let i = 0; i < 10; i++) {
				ids.push(generator.generate());
			}

			expect(new Set(ids).size).toBe(10);
			expect(Date.now() - startTime).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Compose Method", () => {
		test("should compose ID from components", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const timestamp = Date.now();
			const id = generator.compose(timestamp, 1, 0, 42);

			expect(typeof id).toBe("string");
			expect(id.length).toBeGreaterThan(0);
		});

		test("should validate component ranges", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			const timestamp = Date.now();

			expect(() => generator.compose(timestamp, -1, 0, 0)).toThrow(
				ConfigurationError,
			);
			expect(() => generator.compose(timestamp, 1024, 0, 0)).toThrow(
				ConfigurationError,
			);
			expect(() => generator.compose(timestamp, 0, -1, 0)).toThrow(
				ConfigurationError,
			);
			expect(() => generator.compose(timestamp, 0, 0, -1)).toThrow(
				ConfigurationError,
			);
			expect(() => generator.compose(timestamp, 0, 0, 4096)).toThrow(
				ConfigurationError,
			);
		});

		test("should reject negative timestamp", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });
			expect(() => generator.compose(-1, 1, 0, 0)).toThrow(
				ConfigurationError,
			);
		});
	});

	describe("Decompose Method", () => {
		test("should decompose generated ID correctly", () => {
			const generator = new SnowflakeGenerator({
				workerId: 123,
				processId: 45,
				bits: {
					workerId: 8, // Max 255
					processId: 8, // Max 255
					sequence: 6, // Max 63 (8+8+6=22)
				},
			});

			const id = generator.generate();
			const components = generator.decompose(id);

			expect(components.workerId).toBe(123);
			expect(components.processId).toBe(45);
			expect(components.timestamp).toBeGreaterThan(1577836800000); // After 2020-01-01
			expect(components.sequence).toBeGreaterThanOrEqual(0);
		});

		test("should round-trip compose/decompose", () => {
			const generator = new SnowflakeGenerator({
				workerId: 1,
				bits: {
					workerId: 8, // Max 255
					processId: 8, // Max 255
					sequence: 6, // Max 63 (8+8+6=22)
				},
			});
			const originalTimestamp = Date.now();
			const originalWorkerId = 1;
			const originalProcessId = 45;
			const originalSequence = 42; // Valid within 6-bit range (0-63)

			const id = generator.compose(
				originalTimestamp,
				originalWorkerId,
				originalProcessId,
				originalSequence,
			);
			const components = generator.decompose(id);

			expect(components.timestamp).toBe(originalTimestamp);
			expect(components.workerId).toBe(originalWorkerId);
			expect(components.processId).toBe(originalProcessId);
			expect(components.sequence).toBe(originalSequence);
		});

		test("should reject invalid ID formats", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });

			expect(() => generator.decompose("")).toThrow(InvalidIdError);
			expect(() => generator.decompose("abc")).toThrow(InvalidIdError);
			expect(() => generator.decompose("-123")).toThrow(InvalidIdError);
		});

		test("should reject non-string input", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });

			expect(() => generator.decompose(123 as any)).toThrow(
				InvalidIdError,
			);
			expect(() => generator.decompose(null as any)).toThrow(
				InvalidIdError,
			);
			expect(() => generator.decompose(undefined as any)).toThrow(
				InvalidIdError,
			);
		});
	});

	describe("Error Handling", () => {
		test("should throw ClockBackwardsError when clock goes backwards", () => {
			const generator = new SnowflakeGenerator({ workerId: 1 });

			// Generate an ID to set lastTimestamp
			generator.generate();

			// Mock Date.now to return earlier time
			const originalDateNow = Date.now;
			Date.now = vi.fn(() => originalDateNow() - 10000);

			expect(() => generator.generate()).toThrow(ClockBackwardsError);

			// Restore original Date.now
			Date.now = originalDateNow;
		});
	});

	describe("Multiple Instances", () => {
		test("should generate unique IDs across multiple instances", () => {
			const generator1 = new SnowflakeGenerator({ workerId: 1 });
			const generator2 = new SnowflakeGenerator({ workerId: 2 });

			const ids = new Set();

			for (let i = 0; i < 1000; i++) {
				ids.add(generator1.generate());
				ids.add(generator2.generate());
			}

			expect(ids.size).toBe(2000);
		});

		test("should work with different process IDs", () => {
			const generator1 = new SnowflakeGenerator({
				workerId: 1,
				processId: 1,
				bits: {
					workerId: 10,
					processId: 5, // Max 31
					sequence: 7, // Max 127 (10+5+7=22)
				},
			});
			const generator2 = new SnowflakeGenerator({
				workerId: 1,
				processId: 2,
				bits: {
					workerId: 10,
					processId: 5, // Max 31
					sequence: 7, // Max 127 (10+5+7=22)
				},
			});

			const ids = new Set();

			for (let i = 0; i < 1000; i++) {
				ids.add(generator1.generate());
				ids.add(generator2.generate());
			}

			expect(ids.size).toBe(2000);
		});
	});

	describe("Edge Cases", () => {
		test("should handle exactly at bit limits", () => {
			const generator = new SnowflakeGenerator({
				workerId: 1023, // 2^10 - 1
				processId: 0,
				bits: {
					workerId: 10, // Max 1023
					processId: 0,
					sequence: 12, // Max 4095
				},
			});

			expect(generator).toBeInstanceOf(SnowflakeGenerator);
			const id = generator.generate();
			const components = generator.decompose(id);
			expect(components.workerId).toBe(1023);
		});

		test("should handle minimum valid configuration", () => {
			const generator = new SnowflakeGenerator({
				workerId: 0,
				bits: {
					workerId: 1, // Max 1
					processId: 0,
					sequence: 21, // Max 2097151
				},
			});

			expect(generator).toBeInstanceOf(SnowflakeGenerator);
			const id = generator.generate();
			expect(typeof id).toBe("string");
		});
	});
});
