# Inventario por Sedes — RP Dental

App web que reemplaza el kardex en Excel y aísla el inventario aprobado (lo verificado físicamente) del inventario del ERP.

## Documentos (leer antes de programar)

- [Inventario_Sedes_Especificacion_v0.3.md](Inventario_Sedes_Especificacion_v0.3.md): qué hace el sistema, reglas R1–R12, pruebas P1–P19. **Manda sobre todo lo demás.**
- [Inventario_Sedes_Diseno_Tecnico_v0.3.md](Inventario_Sedes_Diseno_Tecnico_v0.3.md): esquema Prisma, SQL, API, pantallas y orden de construcción (sección 12). Seguir ese orden y hacer primero las verificaciones de la sección 11.
- Si el código necesita algo que contradice la especificación, parar y preguntar; no decidir en silencio.

## Stack

`backend/`: Node 20 + TypeScript + Express 5 + Prisma 6 + Zod, SQL Server. `frontend/`: React 19 + Vite 6 + TanStack Query + React Router 7 + Tailwind 4. Node local es 20.10: **no** subir a Prisma 7 ni Vite 7.

## Reglas que no se rompen

- Solo `core/saldo.ts → aplicarEfectos()` escribe en `saldo` y `kardex`. Nada más los toca.
- Toda escritura corre dentro de `conUsuario(usuarioId, motivo, tx => …)`: una transacción que además deja el usuario para los triggers de auditoría.
- Los cambios de estado son `updateMany` condicionados al estado anterior; si `count !== 1`, responder 409.
- Si un movimiento tiene una línea inválida, se rechaza completo y se devuelven los errores de todas las líneas.
- La Bodega ERP (`controla_saldo = 0`) nunca tiene filas en `saldo`.
- Fechas en UTC: enviar siempre `new Date()` explícito (sin `@default(now())`); `SYSUTCDATETIME()` en SQL; mostrar en `America/Bogota`; las columnas DATE se formatean en UTC.
- SQL Server con Prisma: sin `enum` (String + CHECK), relaciones con `onDelete: NoAction, onUpdate: NoAction`, sin `@unique` en columnas opcionales.
- Interfaz, mensajes de error y nombres de dominio en español.

## Comandos

```bash
docker compose up -d                 # SQL Server local
cd backend && npm run db:reset       # migra + seed
npm run erp:demo                     # base SaintDemo para probar la sincronización
npm run dev                          # API en :3001
npm test                             # P1–P19 contra InventarioSedes_test
cd frontend && npm run dev           # :5173, proxy /api → :3001
```
