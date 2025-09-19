import { Bench } from 'tinybench';
import { SnowflakeGenerator } from '../src/index';

console.log('Snowflake ID Generation Benchmark\n');

const bench = new Bench({ time: 1000 });
const generator = new SnowflakeGenerator({ workerId: 1 });

bench
	.add('single ID', () => {
		generator.generate();
	})
	.add('batch of 100 IDs', () => {
		for (let i = 0; i < 100; i++) {
			generator.generate();
		}
	})
	.add('batch of 1000 IDs', () => {
		for (let i = 0; i < 1000; i++) {
			generator.generate();
		}
	})
	.add('batch of 10000 IDs', () => {
		for (let i = 0; i < 10000; i++) {
			generator.generate();
		}
	});

await bench.run();

console.table(bench.table());

// Calculate effective IDs per second for batches
console.log('\nEffective IDs per second:');
bench.tasks.forEach((task) => {
	const name = task.name;
	const opsPerSec = task.result?.throughput.mean || 0;

	let idsPerBatch = 1;
	if (name.includes('100')) idsPerBatch = 100;
	else if (name.includes('1000')) idsPerBatch = 1000;
	else if (name.includes('10000')) idsPerBatch = 10000;

	const effectiveIdsPerSec = Math.round(opsPerSec * idsPerBatch);
	console.log(`${name}: ${effectiveIdsPerSec.toLocaleString()} IDs/sec`);
});
