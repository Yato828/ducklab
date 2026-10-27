import 'dotenv/config';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{
  // Seed operational defaults only. Community identities, sales and reviews are never fabricated.
  await pool.query('INSERT INTO system_configuration(key,value) VALUES($1,$2) ON CONFLICT(key) DO NOTHING',['training_default_quota',JSON.stringify({maxSecondsPerDay:0})]);
  console.log('Seeded operational defaults. No community listings or financial records were created.');
}finally{await pool.end();}
