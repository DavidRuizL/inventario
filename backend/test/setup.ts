import { afterEach } from 'vitest';
import { verificarInvariante } from './factories';

afterEach(async () => {
  await verificarInvariante(); // P19: saldo = SUM(kardex) por sede y lote, siempre
});
