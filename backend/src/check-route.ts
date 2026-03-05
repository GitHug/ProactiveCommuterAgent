import 'dotenv/config';
import { Severity } from '@commuter/shared';
import { DarwinAdapter } from './transport/darwin.adapter';
import { TflAdapter } from './transport/tfl.adapter';

const SEVERITY_COLORS: Record<string, string> = {
  [Severity.Info]: '\x1b[32m', // green
  [Severity.Warning]: '\x1b[33m', // yellow
  [Severity.Critical]: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

function printUsage() {
  console.log(`
Usage:
  npx ts-node src/check-route.ts --from <CRS> --to <CRS>    Check National Rail route
  npx ts-node src/check-route.ts --line <lineId>             Check TfL line status

Examples:
  npx ts-node src/check-route.ts --from SUR --to WAT
  npx ts-node src/check-route.ts --from KGX --to CBG
  npx ts-node src/check-route.ts --line piccadilly
  npx ts-node src/check-route.ts --line victoria
  npx ts-node src/check-route.ts --line central
`);
}

async function main() {
  const args = process.argv.slice(2);

  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const lineIdx = args.indexOf('--line');

  if (lineIdx !== -1 && args[lineIdx + 1]) {
    // TfL line check
    const lineId = args[lineIdx + 1];
    const tflApiKey = process.env.TFL_API_KEY;
    const adapter = new TflAdapter(tflApiKey);

    console.log(`\nChecking TfL line: ${lineId}...\n`);
    const status = await adapter.checkLineStatus(lineId);

    const color = SEVERITY_COLORS[status.severity] ?? '';
    console.log(`Route:    ${status.routeKey}`);
    console.log(`Status:   ${color}${status.overallStatus}${RESET}`);
    console.log(`Severity: ${color}${status.severity}${RESET}`);
    console.log(`Summary:  ${status.summary}`);
    if (status.affectedServices.length > 0) {
      console.log(`\nAffected services:`);
      for (const s of status.affectedServices) {
        console.log(`  - ${s.operator}: ${s.status}`);
        console.log(`    ${s.detail}`);
      }
    }
  } else if (
    fromIdx !== -1 &&
    toIdx !== -1 &&
    args[fromIdx + 1] &&
    args[toIdx + 1]
  ) {
    // Darwin route check
    const origin = args[fromIdx + 1].toUpperCase();
    const destination = args[toIdx + 1].toUpperCase();
    const darwinToken = process.env.DARWIN_API_KEY;
    const adapter = new DarwinAdapter(darwinToken);

    console.log(`\nChecking National Rail: ${origin} → ${destination}...\n`);
    const status = await adapter.checkRouteStatus(origin, destination);

    const color = SEVERITY_COLORS[status.severity] ?? '';
    console.log(`Route:    ${status.routeKey}`);
    console.log(`Status:   ${color}${status.overallStatus}${RESET}`);
    console.log(`Severity: ${color}${status.severity}${RESET}`);
    console.log(`Summary:  ${status.summary}`);
    if (status.affectedServices.length > 0) {
      console.log(`\nAffected services:`);
      for (const s of status.affectedServices) {
        console.log(`  - [${s.operator}] ${s.status}`);
        console.log(`    ${s.detail}`);
      }
    }
  } else {
    printUsage();
    process.exit(1);
  }

  console.log('');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Error:', message);
  process.exit(1);
});
