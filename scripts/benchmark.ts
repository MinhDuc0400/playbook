/** `pnpm benchmark [runs]` — prints the FR-TUN-03 table for the seeded sample plays (lead-owned). */
import { createDefaultSettings } from '../src/domain/defaults';
import { createSamplePlays } from '../src/db/seed/samplePlays';
import { runBenchmark } from '../src/engine/benchmark';

const runs = Number(process.argv[2] ?? 50);
const rows = runBenchmark(createSamplePlays(0), createDefaultSettings(), runs);
for (const r of rows) {
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`.padStart(4);
  console.log(
    `${r.target ? '*' : ' '} ${r.offenseName.padEnd(12)} vs ${r.defenseName.padEnd(8)} complete ${pct(r.pComplete)}  sack ${pct(r.pSack)}  int ${pct(r.pInt)}  yds ${r.avgYards.toFixed(1)}`,
  );
}
