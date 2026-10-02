import { UsuarioAuth } from '../shared/types';

export function esAdmin(u: UsuarioAuth): boolean {
  return u.rol === 'ADMIN' || u.rol === 'SUPERADMIN';
}

export function esSuperAdmin(u: UsuarioAuth): boolean {
  return u.rol === 'SUPERADMIN';
}

export function puedeVerSede(u: UsuarioAuth, sedeId: number): boolean {
  return esAdmin(u) || u.sedeIds.includes(sedeId);
}

export function puedeOperarSede(u: UsuarioAuth, sedeId: number): boolean {
  return u.sedeIds.includes(sedeId);
}

export function puedeVerMovimiento(
  u: UsuarioAuth,
  m: { sedeOrigenId: number | null; sedeDestinoId: number | null },
): boolean {
  if (esAdmin(u)) return true;
  if (m.sedeOrigenId && u.sedeIds.includes(m.sedeOrigenId)) return true;
  if (m.sedeDestinoId && u.sedeIds.includes(m.sedeDestinoId)) return true;
  return false;
}
