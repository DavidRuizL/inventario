import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';
import { actualizar } from '../src/modules/usuarios/usuarios.service';
import { crearUsuario } from './factories';

// P17: Cambio de rol de un usuario → Queda en auditoría con antes, después y quién lo hizo.
describe('P17 — auditoría de un cambio de rol', () => {
  it('registra antes, después, motivo y el actor', async () => {
    const actor = await crearUsuario('SUPERADMIN');
    const objetivo = await crearUsuario('BASE');

    await actualizar(actor.id, objetivo.id, { rol: 'ADMIN', motivo: 'Asciende a administrador de sede' });

    const fila = await prisma.auditoria.findFirst({
      where: { tabla: 'usuario', registroId: String(objetivo.id), accion: 'MODIFICAR' },
      orderBy: { id: 'desc' },
    });

    expect(fila).not.toBeNull();
    expect(fila?.usuarioId).toBe(actor.id);
    expect(fila?.motivo).toBe('Asciende a administrador de sede');

    const antes = JSON.parse(fila!.antes!);
    const despues = JSON.parse(fila!.despues!);
    expect(antes.rol).toBe('BASE');
    expect(despues.rol).toBe('ADMIN');
    expect(antes.clave_hash).toBeUndefined();
    expect(despues.clave_hash).toBeUndefined();
  });
});
