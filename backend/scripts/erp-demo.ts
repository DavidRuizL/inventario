import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import sql from 'mssql';

function parseDatabaseUrl(url: string) {
  // sqlserver://host:port;database=X;user=Y;password=Z;trustServerCertificate=true
  const [, serverPart, paramsPart] = url.match(/^sqlserver:\/\/([^;]+);(.+)$/) ?? [];
  if (!serverPart || !paramsPart) throw new Error('DATABASE_URL con formato inesperado.');
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
    options: { trustServerCertificate: params.trustservercertificate === 'true', enableArithAbort: true },
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en .env');

  const config = parseDatabaseUrl(url);
  const pool = await sql.connect({ ...config, database: 'master' });

  const archivo = path.join(__dirname, '../sql/erp_demo.sql');
  const contenido = fs.readFileSync(archivo, 'utf-8');
  const lotes = contenido.split(/^\s*GO\s*$/im).map((l) => l.trim()).filter(Boolean);

  for (const lote of lotes) {
    await pool.query(lote);
  }

  console.log('Base SaintDemo creada/actualizada con datos de ejemplo.');
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
