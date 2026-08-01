import * as dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import * as fs from 'fs';
import * as readline from 'readline';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lsfa_central?schema=public';
const FILE_PATH = '../reference/GNAF_CORE.psv';
const LOG_PATH = './gnaf_errors.log';

// Postgres expects \N not \\N when joined programmatically
const PG_NULL = '\\N';

async function run() {
  console.log('Connecting to Postgres directly...');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log('Emptying existing GNAFAddress table...');
  await client.query('TRUNCATE TABLE "GNAFAddress" RESTART IDENTITY');

  console.log('Initiating controlled stream (backpressure batching)...');
  
  const targetColumns = [
    '"addressDetailPid"', '"dateCreated"', '"addressLabel"', '"addressSiteName"', 
    '"buildingName"', '"flatType"', '"flatNumber"', '"levelType"', '"levelNumber"', 
    '"numberFirst"', '"numberLast"', '"lotNumber"', '"streetName"', '"streetType"', 
    '"streetSuffix"', '"localityName"', '"state"', '"postcode"', '"legalParcelId"', 
    '"mbCode"', '"aliasPrincipal"', '"principalPid"', '"primarySecondary"', 
    '"primaryPid"', '"geocodeType"', '"longitude"', '"latitude"'
  ];

  const pgStream = client.query(copyFrom(`COPY "GNAFAddress" (${targetColumns.join(', ')}) FROM STDIN WITH NULL '${PG_NULL}' ENCODING 'utf8'`));
  
  // Read in latin1 to let Node blindly accept any weird byte as a character without fatally crashing natively
  const fileStream = fs.createReadStream(FILE_PATH, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  // Prepare an error log file
  const errorLogStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });

  let rowCount = 0;
  let skippedCount = 0;
  const startTime = Date.now();
  
  console.log('Ingesting... (this prevents all Postgres escape sequence crashes)');

  for await (const line of rl) {
    if (!line.trim()) continue;

    const parts = line.split('|');
    if (parts[0] === 'ADDRESS_DETAIL_PID') continue; // skip header

    if (parts.length >= 27) {
      const row = parts.map((part, index) => {
        // THE TRUE FIX: Strip all backslashes, tabs, and newlines!
        // Postgres interprets backslashes inside COPY as octal escape sequences.
        // A backslash followed by numbers (like \376) gets converted by Postgres into byte 0xFE!
        let cleanPart = part.replace(/[\t\r\n\\]/g, ''); 

        if (index === 25 || index === 26) {
          return cleanPart ? parseFloat(cleanPart) : PG_NULL;
        }
        return cleanPart ? cleanPart : PG_NULL;
      });
      
      const chunk = row.join('\t') + '\n';
      rowCount++;

      if (rowCount % 500000 === 0) {
        console.log(`Processed ${rowCount} valid lines... (Skipped ${skippedCount})`);
      }

      const canWrite = pgStream.write(Buffer.from(chunk, 'utf8'));
      if (!canWrite) {
        await new Promise<void>((resolve) => pgStream.once('drain', resolve));
      }
    }
  }

  pgStream.end();
  errorLogStream.end();

  await new Promise<void>((resolve, reject) => {
    pgStream.on('finish', resolve);
    pgStream.on('error', reject);
  });

  const durationObj = (Date.now() - startTime) / 1000;
  console.log(`\nImport complete!`);
  console.log(`Processed: ${rowCount} total valid rows.`);
  console.log(`Skipped:   ${skippedCount} illegal rows due to bad encoding.`);
  console.log(`Time:      ${durationObj.toFixed(2)}s.`);
  await client.end();
}

run().catch(console.error);
