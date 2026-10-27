import pg from 'pg';
export class ApiError extends Error { constructor(readonly statusCode:number,message:string,readonly code='REQUEST_FAILED'){ super(message); } }
export function requireDatabase(pool?: pg.Pool): pg.Pool {
  if(!pool) throw new ApiError(503,'PostgreSQL is not configured. Set DATABASE_URL and run database migrations.','DATABASE_UNAVAILABLE');
  return pool;
}
export async function transaction<T>(pool: pg.Pool, operation:(client:pg.PoolClient)=>Promise<T>):Promise<T> {
  const client=await pool.connect();
  try { await client.query('BEGIN'); const value=await operation(client);await client.query('COMMIT');return value; }
  catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}
