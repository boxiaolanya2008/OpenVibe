import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';

const outFile = join(tmpdir(), 'pi-browser-smoke.js');
const errorFile = join(tmpdir(), 'pi-browser-smoke-errors.log');

try {
	const command = `esbuild scripts/browser-smoke-entry.ts --bundle --platform=browser --format=esm --log-limit=0 --outfile="${outFile}"`;
	execSync(command, {
		stdio: 'pipe',
		shell: true
	});

	if (existsSync(errorFile)) {
		unlinkSync(errorFile);
	}
} catch (error) {
	console.error('Browser smoke check failed.');
	if (existsSync(errorFile)) {
		console.error(readFileSync(errorFile, 'utf-8'));
	}
	process.exit(1);
}
