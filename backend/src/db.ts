import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

const SQL_DEADLOCK_VICTIM = 1205;

function esDeadlock(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2010' &&
    typeof err.meta?.code === 'number' &&
    err.meta.code === SQL_DEADLOCK_VICTIM
  ) || (err instanceof Error && err.message.includes('1205'));
}

/**
 * Toda escritura corre aquí: abre una transacción y fija usuario_id/motivo en
 * SESSION_CONTEXT para que los triggers de auditoría los lean. Reintenta una vez
 * si SQL Server elige la transacción como víctima de un interbloqueo.
 */
export async function conUsuario<T>(
  usuarioId: number | null,
  motivo: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const ejecutar = () =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`EXEC sp_set_session_context @key = N'usuario_id', @value = ${usuarioId}`;
        await tx.$executeRaw`EXEC sp_set_session_context @key = N'motivo', @value = ${motivo}`;
        return fn(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000, maxWait: 5_000 },
    );

  try {
    return await ejecutar();
  } catch (err) {
    if (esDeadlock(err)) {
      return await ejecutar();
    }
    throw err;
  }
}
