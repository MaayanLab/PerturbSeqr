import { Pool, PoolClient } from 'pg'

const globals = globalThis as unknown as { libraryPool?: Pool }
const pool = globals.libraryPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
globals.libraryPool = pool

// API reads must use the same role/RLS as public GraphQL, even with an owner DATABASE_URL.
export async function libraryRead<T>(read: (client: PoolClient) => Promise<T>, readOnly = true): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN')
    await client.query('SET LOCAL ROLE guest')
    const result = await read(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
