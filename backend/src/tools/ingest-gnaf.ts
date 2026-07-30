import * as dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import * as fs from 'fs';
import * as readline from 'readline';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lsfa_central?schema=public';
const FILE_PATH = '../reference/GNAF_CORE.psv';

async function run() {
  console.log('Connecting to Postgres directly...');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('Emptying existing GNAFAddress table...');
  await client.query('TRUNCATE TABLE "GNAFAddress" RESTART IDENTITY');

  console.log('Initiating controlled stream (backpressure batching)...');
  
  const targetColumns = [
    '"addressDetailPid"',
    '"addressLabel"',
    '"streetName"',
    '"streetType"',
    '"localityName"',
    '"state"',
    '"postcode"',
    '"longitude"',
    '"latitude"'
  ];

  const pgStream = client.query(copyFrom(`COPY "GNAFAddress" (${targetColumns.join(', ')}) FROM STDIN WITH NULL '\\N'`));
  
  const fileStream = fs.createReadStream(FILE_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let rowCount = 0;
  const startTime = Date.now();
  
  console.log('Ingesting... (this will correctly pause when Postgres is busy)');

  // Using for await...of automatically controls the file reading loop, 
  // preventing Node from loading strings faster than Postgres saves them.
  for await (const line of rl) {
    if (!line.trim()) continue;
    
    const parts = line.split('|');
    if (parts[0] === 'ADDRESS_DETAIL_PID') continue; // skip header

    if (parts.length >= 27) {
      const row = [
        parts[0],
        parts[2],
        parts[12] || '\\N',
        parts[13] || '\\N',
        parts[15] || '\\N',
        parts[16] || '\\N',
        parts[17] || '\\N',
        parts[25] ? parseFloat(parts[25]) : '\\N',
        parts[26] ? parseFloat(parts[26]) : '\\N'
      ];
      
      const chunk = row.join('\t') + '\n';
      rowCount++;

      if (rowCount % 500000 === 0) {
        console.log(`Processed ${rowCount} lines...`);
      }

      // **THE FIX**: Try to write. If the Postgres stream buffer is full, 
      // pause this exact loop and wait for Postgres to drain (save to disk).
      const canWrite = pgStream.write(chunk);
      if (!canWrite) {
        await new Promise<void>((resolve) => pgStream.once('drain', resolve));
      }
    }
  }

  // File is fully read, tell Postgres we are done sending data
  pgStream.end();

  // Wait for Postgres to cleanly finalize the transaction
  await new Promise<void>((resolve, reject) => {
    pgStream.on('finish', resolve);
    pgStream.on('error', reject);
  });

  const durationObj = (Date.now() - startTime) / 1000;
  console.log(`\nImport complete! Processed ${rowCount} total rows in ${durationObj.toFixed(2)}s.`);
  await client.end();
}

run().catch(console.error);
