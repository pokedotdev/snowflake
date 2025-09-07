import { expect, test, describe } from "vitest";
import { SnowflakeGenerator } from "../src/index";

describe("Performance Tests", () => {
	test("should generate 10,000 unique IDs quickly", () => {
		const generator = new SnowflakeGenerator({ workerId: 1 });
		const ids = new Set<string>();

		const startTime = performance.now();

		for (let i = 0; i < 10000; i++) {
			ids.add(generator.generate());
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(ids.size).toBe(10000);
		expect(duration).toBeLessThan(1000); // Should complete in less than 1 second

		console.log(`Generated 10,000 unique IDs in ${duration.toFixed(2)}ms`);
		console.log(
			`Rate: ${((10000 / duration) * 1000).toFixed(0)} IDs/second`,
		);
	});

	test("should handle concurrent generation", async () => {
		const generator = new SnowflakeGenerator({ workerId: 1 });
		const allIds = new Set<string>();

		const generateBatch = (count: number) => {
			const ids: string[] = [];
			for (let i = 0; i < count; i++) {
				ids.push(generator.generate());
			}
			return ids;
		};

		const startTime = performance.now();

		// Simulate concurrent generation with Promise.all
		const batches = await Promise.all([
			Promise.resolve(generateBatch(1000)),
			Promise.resolve(generateBatch(1000)),
			Promise.resolve(generateBatch(1000)),
			Promise.resolve(generateBatch(1000)),
			Promise.resolve(generateBatch(1000)),
		]);

		const endTime = performance.now();
		const duration = endTime - startTime;

		// Collect all IDs
		for (const batch of batches) {
			for (const id of batch) {
				allIds.add(id);
			}
		}

		expect(allIds.size).toBe(5000);
		console.log(
			`Generated 5,000 IDs concurrently in ${duration.toFixed(2)}ms`,
		);
	});

	test("should maintain performance under sequence pressure", () => {
		// Use small sequence bits to force frequent sequence resets
		const generator = new SnowflakeGenerator({
			workerId: 1,
			bits: {
				workerId: 10,
				processId: 0,
				sequence: 4, // Only 16 possible sequence values
			},
		});

		const ids = new Set<string>();
		const startTime = performance.now();

		// Generate more IDs than sequence allows, forcing waits
		for (let i = 0; i < 1000; i++) {
			ids.add(generator.generate());
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(ids.size).toBe(1000);
		console.log(
			`Generated 1,000 IDs with sequence pressure in ${duration.toFixed(2)}ms`,
		);
	});

	test("should efficiently decompose IDs", () => {
		const generator = new SnowflakeGenerator({ workerId: 1 });

		// Generate test IDs
		const testIds: string[] = [];
		for (let i = 0; i < 1000; i++) {
			testIds.push(generator.generate());
		}

		const startTime = performance.now();

		// Decompose all IDs
		const components = testIds.map((id) => generator.decompose(id));

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(components.length).toBe(1000);
		expect(duration).toBeLessThan(100); // Should be very fast

		console.log(`Decomposed 1,000 IDs in ${duration.toFixed(2)}ms`);
		console.log(
			`Rate: ${((1000 / duration) * 1000).toFixed(0)} decompositions/second`,
		);
	});

	test("should efficiently compose IDs", () => {
		const generator = new SnowflakeGenerator({ workerId: 1 });

		const baseTimestamp = 1577836800000 + 100000; // Use a timestamp relative to default epoch
		const startTime = performance.now();

		// Compose many IDs
		const ids: string[] = [];
		for (let i = 0; i < 1000; i++) {
			ids.push(generator.compose(baseTimestamp + i, 1, 0, i % 4096));
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(ids.length).toBe(1000);
		expect(duration).toBeLessThan(100); // Should be very fast

		console.log(`Composed 1,000 IDs in ${duration.toFixed(2)}ms`);
		console.log(
			`Rate: ${((1000 / duration) * 1000).toFixed(0)} compositions/second`,
		);
	});

	test("should maintain uniqueness under extreme load", () => {
		const generator = new SnowflakeGenerator({ workerId: 1 });
		const ids = new Set<string>();

		const startTime = performance.now();

		// Generate a very large number of IDs
		for (let i = 0; i < 50000; i++) {
			ids.add(generator.generate());
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(ids.size).toBe(50000);
		console.log(`Generated 50,000 unique IDs in ${duration.toFixed(2)}ms`);
		console.log(
			`Rate: ${((50000 / duration) * 1000).toFixed(0)} IDs/second`,
		);
	});

	test("should handle multiple generators efficiently", () => {
		const generators = Array.from(
			{ length: 10 },
			(_, i) => new SnowflakeGenerator({ workerId: i }),
		);

		const allIds = new Set<string>();
		const startTime = performance.now();

		// Generate IDs from all generators
		for (let round = 0; round < 100; round++) {
			for (const generator of generators) {
				allIds.add(generator.generate());
			}
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(allIds.size).toBe(1000); // 10 generators * 100 rounds
		console.log(
			`Generated 1,000 IDs from 10 generators in ${duration.toFixed(2)}ms`,
		);
	});
});
