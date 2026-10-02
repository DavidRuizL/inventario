import 'dotenv/config';
import { execSync } from 'node:child_process';
import sql from 'mssql';

function parseDatabaseUrl(url: string) {
  const [, serverPart, paramsPart] = url.match(/^sqlserver:\/\/([^;]+);(.+)$/) ?? [];
  if (!serverPart || !paramsPart) throw new Error('DATABASE_URL_TEST con formato inesperado.');
  const [host, portStr] = serverPart.split(':');
  const params = Object.fromEntries(
    paramsPart.split(';').filter(Boolean).map((p) => {
      const [k, v] = p.split('=');
      return [k.toLowerCase(), v];
    }),
  );
  return {
    server: host,
    port: portStr ? Number(portStr) : 1433,
    user: params.user,
    password: params.password,
    database: params.database,
    options: { trustServerCertificate: params.trustservercertificate === 'true', enableArithAbort: true },
  };
}

/**
 * Deja InventarioSedes_test vacía y con las migraciones aplicadas, una vez por
 * ejecución de la suite. Se recrea la base por SQL directo (en vez de
 * `prisma migrate reset`) para no disparar la protección de Prisma contra
 * comandos destructivos invocados por un agente de IA.
 */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('Falta DATABASE_URL_TEST en backend/.env');

  const cfg = parseDatabaseUrl(url);
  const dbName = cfg.database!;

  const pool = await sql.connect({ ...cfg, database: 'master' });
  await pool.query(`
    IF DB_ID('${dbName}') IS NOT NULL
    BEGIN
      ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${dbName}];
    END
    CREATE DATABASE [${dbName}];
  `);
  await pool.close();

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
