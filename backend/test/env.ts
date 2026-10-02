import 'dotenv/config';

// Debe ser el primer setupFile (ver vitest.config.ts): fija DATABASE_URL al
// de pruebas ANTES de que cualquier otro módulo (factories, db.ts) se
// importe y cree el PrismaClient, ya que los `import` se izan por encima
// del resto del código del archivo.
if (!process.env.DATABASE_URL_TEST) {
  throw new Error('Falta DATABASE_URL_TEST en backend/.env');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
