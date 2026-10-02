# Inventario por Sedes — Diseño técnico v0.3

Guía de implementación de la [Especificación v0.3](Inventario_Sedes_Especificacion_v0.3.md). La especificación dice **qué** hace el sistema y sus reglas (R1–R12); este documento dice **cómo** construirlo. Si algo aquí contradice la especificación, manda la especificación y hay que avisar.

---

## 1. Stack y versiones

La máquina de desarrollo tiene **Node 20.10**. Eso fija algunas versiones:

| Pieza | Paquete | Versión | Nota |
|-------|---------|---------|------|
| Runtime | Node | 20.x | |
| Backend | `express` | 5.x | Captura errores de handlers `async` sin wrappers |
| ORM | `prisma`, `@prisma/client` | **6.x** | No usar 7.x: pide Node ≥ 20.19 y cambia la configuración |
| Validación | `zod` | 3.x | Igual que Novamedica |
| Sesión | `jsonwebtoken`, `cookie-parser` | | JWT en cookie `httpOnly` |
| Claves | `bcryptjs` | | Puro JS; `bcrypt` nativo da problemas de compilación en Windows |
| Seguridad | `helmet` | | |
| Excel | `exceljs` | | Exportar inventario y kardex |
| Pruebas | `vitest`, `supertest` | vitest 3.x | |
| Frontend | `vite` | **6.x** | No usar 7.x: pide Node ≥ 20.19 |
| UI | `react`, `react-dom` | 19.x | |
| Rutas | `react-router` | 7.x | Modo librería (`createBrowserRouter`) |
| Datos | `@tanstack/react-query` | 5.x | |
| HTTP | `axios` | | `withCredentials: true` |
| Estilos | `tailwindcss`, `@tailwindcss/vite` | 4.x | |
| Iconos y avisos | `lucide-react`, `sonner` | | |
| BD desarrollo | SQL Server 2022 en Docker | | Docker Desktop ya está instalado |

Mismo estilo que el proyecto hermano `RP_Dental/Novamedica` (Express + Prisma + Zod, Vite + React + TanStack Query). Copiar de ahí convenciones cuando sirva.

## 2. Estructura del repositorio

```
Inventario/
├── CLAUDE.md
├── Inventario_Sedes_Especificacion_v0.3.md
├── Inventario_Sedes_Diseno_Tecnico_v0.3.md
├── docker-compose.yml
├── backend/
│   ├── package.json · tsconfig.json · vitest.config.ts · .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   │   ├── <fecha>_init/            ← generada por Prisma
│   │   │   └── <fecha>_reglas_sql/      ← escrita a mano (sección 4)
│   │   └── seed.ts
│   ├── sql/
│   │   └── erp_demo.sql                 ← base falsa "SaintDemo" para probar la sincronización
│   ├── src/
│   │   ├── server.ts                    ← arranca HTTP + tarea de sincronización
│   │   ├── app.ts                       ← express, middlewares, rutas, estáticos del frontend
│   │   ├── config.ts                    ← lee y valida .env con zod
│   │   ├── db.ts                        ← PrismaClient + conUsuario()
│   │   ├── core/
│   │   │   ├── saldo.ts                 ← aplicarEfectos(): ÚNICO lugar que toca saldo y kardex
│   │   │   ├── consecutivo.ts
│   │   │   └── permisos.ts
│   │   ├── shared/                      ← errores, middleware auth, validación
│   │   └── modules/
│   │       ├── auth/  sedes/  usuarios/  catalogo/  movimientos/
│   │       ├── inventario/  kardex/  inicio/  auditoria/  sync/
│   │       └── (cada uno: <x>.routes.ts, <x>.service.ts, <x>.schemas.ts)
│   └── test/
│       ├── setup.ts · factories.ts
│       └── p01_*.test.ts … p19_*.test.ts
└── frontend/
    ├── package.json · vite.config.ts · index.html
    └── src/
        ├── main.tsx · router.tsx
        ├── lib/        api.ts · auth.tsx · formato.ts · query.ts
        ├── components/ ui/ (Button, Input, Dialog, Combobox, DataTable, Badge…) · layout/
        └── pages/      una carpeta por pantalla de la sección 8 de la especificación
```

## 3. Modelo de datos (Prisma, SQL Server)

Particularidades de Prisma con SQL Server que este esquema ya resuelve:

- **No hay `enum`** en SQL Server: los campos de lista son `String` + `CHECK` en la migración manual + tipos unión en TypeScript.
- **Todas las relaciones con `onDelete: NoAction, onUpdate: NoAction`.** `movimiento` tiene dos FK a `sede` y dos a `usuario`; con cascada, SQL Server rechaza la migración por "multiple cascade paths".
- **`@unique` en columna opcional no sirve:** SQL Server solo admite un `NULL`. Por eso `anula_a_id` no es `@unique` y su unicidad va en un índice filtrado en la migración manual.
- **Ids `Int`, no `BigInt`:** `BigInt` no se serializa a JSON y no hace falta por volumen.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model Usuario {
  id        Int      @id @default(autoincrement())
  email     String   @unique @db.VarChar(120)
  nombre    String   @db.NVarChar(120)
  claveHash String   @map("clave_hash") @db.VarChar(100)
  rol       String   @db.VarChar(12) // SUPERADMIN | ADMIN | BASE
  activo    Boolean  @default(true)
  creadoEn  DateTime @map("creado_en")

  sedes                UsuarioSede[]
  movimientosCreados   Movimiento[] @relation("MovCreadoPor")
  movimientosResueltos Movimiento[] @relation("MovResueltoPor")
  productosCreados     Producto[]
  lotesCreados         Lote[]
  auditorias           Auditoria[]
  syncs                SyncLog[]

  @@map("usuario")
}

model UsuarioSede {
  usuarioId Int @map("usuario_id")
  sedeId    Int @map("sede_id")

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  sede    Sede    @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([usuarioId, sedeId])
  @@map("usuario_sede")
}

model Sede {
  id            Int     @id @default(autoincrement())
  codigo        String  @unique @db.VarChar(10)
  nombre        String  @db.NVarChar(80)
  controlaSaldo Boolean @default(true) @map("controla_saldo")
  activo        Boolean @default(true)

  usuarios   UsuarioSede[]
  saldos     Saldo[]
  kardex     Kardex[]
  movOrigen  Movimiento[] @relation("MovOrigen")
  movDestino Movimiento[] @relation("MovDestino")

  @@map("sede")
}

model Producto {
  id             Int       @id @default(autoincrement())
  codigo         String    @unique @db.NVarChar(40)
  descripcion    String    @db.NVarChar(250)
  referencia     String?   @db.NVarChar(100)
  marca          String?   @db.NVarChar(100)
  origen         String    @db.VarChar(6) // ERP | MANUAL
  creadoPorId    Int?      @map("creado_por")
  creadoEn       DateTime  @map("creado_en")
  sincronizadoEn DateTime? @map("sincronizado_en")

  creadoPor Usuario? @relation(fields: [creadoPorId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  lotes     Lote[]

  @@index([referencia])
  @@index([descripcion])
  @@map("producto")
}

model Lote {
  id               Int       @id @default(autoincrement())
  productoId       Int       @map("producto_id")
  nroLote          String    @map("nro_lote") @db.NVarChar(60)
  fechaVencimiento DateTime? @map("fecha_vencimiento") @db.Date
  origen           String    @db.VarChar(6) // ERP | MANUAL
  creadoPorId      Int?      @map("creado_por")
  creadoEn         DateTime  @map("creado_en")
  sincronizadoEn   DateTime? @map("sincronizado_en")

  producto  Producto @relation(fields: [productoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  creadoPor Usuario? @relation(fields: [creadoPorId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  saldos    Saldo[]
  lineas    MovimientoLinea[]
  kardex    Kardex[]

  @@unique([productoId, nroLote])
  @@index([fechaVencimiento])
  @@map("lote")
}

model Movimiento {
  id               Int       @id @default(autoincrement())
  consecutivo      String    @unique @db.VarChar(12)
  tipo             String    @db.VarChar(10) // TRASLADO | SALIDA | AJUSTE | ANULACION
  motivo           String?   @db.VarChar(15)
  sedeOrigenId     Int?      @map("sede_origen_id")
  sedeDestinoId    Int?      @map("sede_destino_id")
  estado           String    @db.VarChar(13)
  documentoSoporte String?   @map("documento_soporte") @db.NVarChar(60)
  observacion      String?   @db.NVarChar(500)
  anulaAId         Int?      @map("anula_a_id")
  creadoPorId      Int       @map("creado_por")
  creadoEn         DateTime  @map("creado_en")
  resueltoPorId    Int?      @map("resuelto_por")
  resueltoEn       DateTime? @map("resuelto_en")
  motivoResolucion String?   @map("motivo_resolucion") @db.NVarChar(500)

  sedeOrigen  Sede?    @relation("MovOrigen", fields: [sedeOrigenId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  sedeDestino Sede?    @relation("MovDestino", fields: [sedeDestinoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  creadoPor   Usuario  @relation("MovCreadoPor", fields: [creadoPorId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  resueltoPor Usuario? @relation("MovResueltoPor", fields: [resueltoPorId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  anulaA      Movimiento?  @relation("Anulacion", fields: [anulaAId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  anulaciones Movimiento[] @relation("Anulacion") // como máximo una (índice filtrado)
  lineas      MovimientoLinea[]
  kardex      Kardex[]

  @@index([tipo, estado])
  @@index([sedeOrigenId])
  @@index([sedeDestinoId])
  @@index([creadoEn])
  @@map("movimiento")
}

model MovimientoLinea {
  id           Int  @id @default(autoincrement())
  movimientoId Int  @map("movimiento_id")
  loteId       Int  @map("lote_id")
  cantidad     Int
  saldoSistema Int? @map("saldo_sistema") // solo AJUSTE
  conteo       Int? // solo AJUSTE

  movimiento Movimiento @relation(fields: [movimientoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  lote       Lote       @relation(fields: [loteId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([movimientoId, loteId])
  @@index([loteId])
  @@map("movimiento_linea")
}

model Saldo {
  sedeId        Int      @map("sede_id")
  loteId        Int      @map("lote_id")
  cantidad      Int
  actualizadoEn DateTime @map("actualizado_en")

  sede Sede @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  lote Lote @relation(fields: [loteId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([sedeId, loteId])
  @@index([loteId])
  @@map("saldo")
}

model Kardex {
  id              Int      @id @default(autoincrement())
  fecha           DateTime
  sedeId          Int      @map("sede_id")
  loteId          Int      @map("lote_id")
  movimientoId    Int      @map("movimiento_id")
  cantidad        Int
  saldoResultante Int      @map("saldo_resultante")

  sede       Sede       @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  lote       Lote       @relation(fields: [loteId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  movimiento Movimiento @relation(fields: [movimientoId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([sedeId, loteId, id])
  @@index([loteId])
  @@index([movimientoId])
  @@map("kardex")
}

model Auditoria {
  id         Int      @id @default(autoincrement())
  fechaHora  DateTime @map("fecha_hora")
  usuarioId  Int?     @map("usuario_id")
  tabla      String   @db.VarChar(30)
  registroId String   @map("registro_id") @db.VarChar(40)
  accion     String   @db.VarChar(13) // CREAR | MODIFICAR | BORRAR | LOGIN | LOGIN_FALLIDO
  antes      String?  @db.NVarChar(Max)
  despues    String?  @db.NVarChar(Max)
  motivo     String?  @db.NVarChar(500)

  usuario Usuario? @relation(fields: [usuarioId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([fechaHora])
  @@index([tabla, registroId])
  @@map("auditoria")
}

model SyncLog {
  id                    Int       @id @default(autoincrement())
  inicio                DateTime
  fin                   DateTime?
  productosNuevos       Int       @default(0) @map("productos_nuevos")
  productosActualizados Int       @default(0) @map("productos_actualizados")
  lotesNuevos           Int       @default(0) @map("lotes_nuevos")
  lotesActualizados     Int       @default(0) @map("lotes_actualizados")
  error                 String?   @db.NVarChar(Max)
  usuarioId             Int?      @map("usuario_id") // null = tarea automática

  usuario Usuario? @relation(fields: [usuarioId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@map("sync_log")
}

model Consecutivo {
  prefijo String @id @db.VarChar(2) // TR | SA | AJ | AN
  ultimo  Int    @default(0)

  @@map("consecutivo")
}
```

### 3.1 Fechas: todo en UTC

Prisma lee los `datetime2` de SQL Server como UTC, pero `CURRENT_TIMESTAMP` devuelve la hora local del servidor (Colombia, UTC−5). Para no tener fechas corridas 5 horas:

- El esquema **no** usa `@default(now())`. El backend siempre envía la fecha explícita (`new Date()`).
- En SQL (triggers, sincronización) se usa `SYSUTCDATETIME()`.
- El frontend muestra fecha-hora en `America/Bogota`.
- Las columnas `@db.Date` (vencimiento) llegan como medianoche UTC: se formatean **en UTC** (`timeZone: 'UTC'`), si no se ve el día anterior.

### 3.2 Texto y mayúsculas

La intercalación por defecto de SQL Server no distingue mayúsculas (`..._CI_AS`), así que `A12572` y `a12572` son el mismo lote para el `UNIQUE`. Es lo deseado. Al guardar: recortar espacios, conservar las mayúsculas tal como se digitaron.

## 4. Migración manual `reglas_sql`

Crear con `prisma migrate dev --create-only --name reglas_sql` y escribir a mano. Contiene todo lo que Prisma no expresa:

### 4.1 CHECK

```sql
ALTER TABLE usuario ADD CONSTRAINT CK_usuario_rol CHECK (rol IN ('SUPERADMIN','ADMIN','BASE'));
ALTER TABLE producto ADD CONSTRAINT CK_producto_origen CHECK (origen IN ('ERP','MANUAL'));
ALTER TABLE lote ADD CONSTRAINT CK_lote_origen CHECK (origen IN ('ERP','MANUAL'));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_tipo_estado CHECK (
     (tipo = 'TRASLADO'  AND estado IN ('NO_CONFIRMADO','RECIBIDO','RECHAZADO','ANULADO'))
  OR (tipo = 'SALIDA'    AND estado IN ('APLICADO','ANULADO'))
  OR (tipo = 'AJUSTE'    AND estado IN ('PENDIENTE','APROBADO','RECHAZADO','ANULADO'))
  OR (tipo = 'ANULACION' AND estado = 'APLICADO'));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_sedes CHECK (
     (tipo = 'TRASLADO'  AND sede_origen_id IS NOT NULL AND sede_destino_id IS NOT NULL AND sede_origen_id <> sede_destino_id)
  OR (tipo = 'SALIDA'    AND sede_origen_id IS NOT NULL AND sede_destino_id IS NULL)
  OR (tipo = 'AJUSTE'    AND sede_origen_id IS NULL     AND sede_destino_id IS NOT NULL)
  OR (tipo = 'ANULACION' AND (sede_origen_id IS NOT NULL OR sede_destino_id IS NOT NULL)));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_anula CHECK (
     (tipo = 'ANULACION' AND anula_a_id IS NOT NULL)
  OR (tipo <> 'ANULACION' AND anula_a_id IS NULL));

ALTER TABLE movimiento ADD CONSTRAINT CK_mov_motivo CHECK (
     motivo IS NULL
  OR (tipo = 'SALIDA'   AND motivo IN ('CIRUGIA','VENTA','VENCIDO','AVERIA'))
  OR (tipo = 'AJUSTE'   AND motivo = 'CONTEO_FISICO')
  OR (tipo = 'TRASLADO' AND motivo = 'CARGA_INICIAL'));

ALTER TABLE movimiento_linea ADD CONSTRAINT CK_linea_cantidad CHECK (cantidad <> 0);
ALTER TABLE saldo  ADD CONSTRAINT CK_saldo_no_negativo CHECK (cantidad >= 0);             -- R1
ALTER TABLE kardex ADD CONSTRAINT CK_kardex CHECK (cantidad <> 0 AND saldo_resultante >= 0);

CREATE UNIQUE INDEX UX_movimiento_anula_a ON movimiento(anula_a_id) WHERE anula_a_id IS NOT NULL;

INSERT INTO consecutivo (prefijo, ultimo) VALUES ('TR',0),('SA',0),('AJ',0),('AN',0);
```

Las reglas que dependen de otra tabla (salida o ajuste solo en sede que controla saldo; cantidad > 0 fuera de ajustes) se validan en el servicio.

### 4.2 Triggers de auditoría

Uno por tabla: `usuario`, `usuario_sede`, `sede`, `movimiento`, `movimiento_linea`. El backend deja el usuario y el motivo en `SESSION_CONTEXT` (ver 5.1). Plantilla:

```sql
CREATE TRIGGER trg_aud_movimiento ON movimiento AFTER INSERT, UPDATE, DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @u INT = TRY_CAST(SESSION_CONTEXT(N'usuario_id') AS INT);
  DECLARE @m NVARCHAR(500) = TRY_CAST(SESSION_CONTEXT(N'motivo') AS NVARCHAR(500));

  INSERT INTO auditoria (fecha_hora, usuario_id, tabla, registro_id, accion, antes, despues, motivo)
  SELECT SYSUTCDATETIME(), @u, 'movimiento', CAST(COALESCE(i.id, d.id) AS VARCHAR(40)),
         CASE WHEN d.id IS NULL THEN 'CREAR' WHEN i.id IS NULL THEN 'BORRAR' ELSE 'MODIFICAR' END,
         (SELECT d2.* FROM deleted  d2 WHERE d2.id = d.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         (SELECT i2.* FROM inserted i2 WHERE i2.id = i.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
         @m
  FROM inserted i
  FULL OUTER JOIN deleted d ON d.id = i.id;
END;
```

- `usuario`: listar columnas explícitas **sin `clave_hash`**.
- `usuario_sede`: llave compuesta; `registro_id = CONCAT(usuario_id, '-', sede_id)` y el `JOIN` por ambas columnas.
- Bloqueo de `auditoria` y `kardex`:

```sql
CREATE TRIGGER trg_bloqueo_auditoria ON auditoria INSTEAD OF UPDATE, DELETE AS
  THROW 50001, 'La auditoría no se modifica ni se borra.', 1;
CREATE TRIGGER trg_bloqueo_kardex ON kardex INSTEAD OF UPDATE, DELETE AS
  THROW 50002, 'El kardex no se modifica ni se borra.', 1;
```

En producción, además: `DENY UPDATE, DELETE ON auditoria TO <usuario_app>` y lo mismo para `kardex`.

### 4.3 Vistas para Power BI

```sql
CREATE VIEW v_inventario_sede AS
SELECT s.codigo AS sede_codigo, s.nombre AS sede, p.codigo AS cod_prod, p.descripcion, p.referencia, p.marca,
       l.nro_lote, l.fecha_vencimiento, sa.cantidad, sa.actualizado_en
FROM saldo sa
JOIN sede s     ON s.id = sa.sede_id
JOIN lote l     ON l.id = sa.lote_id
JOIN producto p ON p.id = l.producto_id
WHERE sa.cantidad > 0;

CREATE VIEW v_kardex AS
SELECT k.id, k.fecha, s.nombre AS sede, p.codigo AS cod_prod, p.descripcion, l.nro_lote,
       m.consecutivo, m.tipo, m.motivo, k.cantidad, k.saldo_resultante
FROM kardex k
JOIN sede s       ON s.id = k.sede_id
JOIN lote l       ON l.id = k.lote_id
JOIN producto p   ON p.id = l.producto_id
JOIN movimiento m ON m.id = k.movimiento_id;

CREATE VIEW v_por_recibir AS
SELECT m.id, m.consecutivo, m.creado_en, so.nombre AS origen, sd.nombre AS destino,
       COUNT(*) AS lineas, SUM(ml.cantidad) AS unidades
FROM movimiento m
JOIN sede so ON so.id = m.sede_origen_id
JOIN sede sd ON sd.id = m.sede_destino_id
JOIN movimiento_linea ml ON ml.movimiento_id = m.id
WHERE m.tipo = 'TRASLADO' AND m.estado = 'NO_CONFIRMADO'
GROUP BY m.id, m.consecutivo, m.creado_en, so.nombre, sd.nombre;
```

## 5. Backend: el núcleo

### 5.1 `conUsuario()`: toda escritura pasa por aquí

```ts
// db.ts
export async function conUsuario<T>(
  usuarioId: number | null,
  motivo: string | null,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Siempre se fijan los dos: la conexión viene de un pool y puede traer valores de otra petición.
    await tx.$executeRaw`EXEC sp_set_session_context @key = N'usuario_id', @value = ${usuarioId}`;
    await tx.$executeRaw`EXEC sp_set_session_context @key = N'motivo', @value = ${motivo}`;
    return fn(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000, maxWait: 5_000 });
}
```

Si SQL Server elige la transacción como víctima de un interbloqueo (error 1205), reintentar una vez.

### 5.2 `aplicarEfectos()`: el único código que toca `saldo` y `kardex`

```ts
// core/saldo.ts
export type Efecto = { sedeId: number; loteId: number; cantidad: number }; // + entra, − sale

export async function aplicarEfectos(
  tx: Prisma.TransactionClient,
  movimientoId: number,
  efectos: Efecto[],
  contexto: 'MOVER' | 'ANULAR',
): Promise<void>
```

Pasos:

1. Descartar efectos en sedes con `controla_saldo = 0` (R12).
2. Ordenar por `(sedeId, loteId)`. Bloquear siempre en el mismo orden evita interbloqueos.
3. Por cada efecto, leer y bloquear la fila:
   ```sql
   SELECT cantidad FROM saldo WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
   WHERE sede_id = @sede AND lote_id = @lote
   ```
   `HOLDLOCK` bloquea también el hueco si la fila no existe, así dos recepciones simultáneas no intentan crear la misma fila.
4. Si el efecto resta:
   - sin fila o en 0 → error R3: *"Bogotá no tiene el lote 01599-9 de 136022"*
   - `actual < solicitado` → error R2: *"Disponible en Bogotá: 5, solicitado: 6"*
   - con `contexto = 'ANULAR'`, el mensaje es: *"No se puede anular: Medellín ya usó 2 de las 3 unidades"* (usadas = solicitado − actual)
5. **No lanzar en el primer error:** juntar los errores de todas las líneas y lanzar uno solo (`ReglaError`, HTTP 422) con `detalles: [{ loteId, mensaje }]`, para que la pantalla marque cada línea (R9).
6. Si no hubo errores: `INSERT` o `UPDATE` en `saldo` con `actualizado_en = ahora` e `INSERT` en `kardex` con `saldo_resultante`.

El `CHECK (cantidad >= 0)` es la segunda barrera: si algo se escapa, SQL Server aborta la transacción.

### 5.3 Consecutivos sin huecos

```sql
UPDATE consecutivo SET ultimo = ultimo + 1 OUTPUT inserted.ultimo WHERE prefijo = @p
```

Dentro de la misma transacción del movimiento: si algo falla, el número se devuelve con el `ROLLBACK`. Formato `TR-000123` (6 dígitos).

### 5.4 Cambios de estado atómicos

Toda transición usa un `UPDATE` condicionado y verifica que afectó una fila:

```ts
const { count } = await tx.movimiento.updateMany({
  where: { id, tipo: 'TRASLADO', estado: 'NO_CONFIRMADO' },
  data: { estado: 'RECIBIDO', resueltoPorId: yo, resueltoEn: ahora },
});
if (count !== 1) throw new ConflictoError('Este traslado ya fue confirmado o rechazado.'); // 409
```

El `UPDATE` deja la fila bloqueada hasta el `COMMIT`; un segundo clic o una segunda persona espera y luego encuentra el estado cambiado (P15).

### 5.5 Operaciones

Cada operación es una función del servicio `movimientos` que corre dentro de `conUsuario()`.

| Operación | Permiso | Validaciones | Efectos | Estado final |
|-----------|---------|--------------|---------|--------------|
| `crearTraslado` | opera origen | origen ≠ destino, ambas activas; ≥ 1 línea; cantidades > 0; sin lotes repetidos; si el origen controla saldo, solo `loteId` existentes; si no, admite productos y lotes nuevos (5.6); `motivo = CARGA_INICIAL` solo si el origen no controla saldo | origen −q | NO_CONFIRMADO |
| `confirmar` | opera destino | estado NO_CONFIRMADO | destino +q | RECIBIDO |
| `rechazar` (traslado) | opera destino, o ADMIN+ | estado NO_CONFIRMADO; motivo obligatorio | origen +q | RECHAZADO |
| `crearSalida` | opera origen | origen controla saldo; motivo de la lista; cantidades > 0 | origen −q | APLICADO |
| `crearAjuste` | opera la sede | sede controla saldo; por línea `conteo ≥ 0`; `saldo_sistema` = saldo actual (lectura sin bloqueo); se descartan líneas con diferencia 0 y si no queda ninguna: *"No hay diferencias"*; no puede haber otro ajuste PENDIENTE con el mismo lote en la misma sede; admite lotes nuevos (5.6) | ninguno | PENDIENTE |
| `aprobar` (ajuste) | ADMIN+ y no es el creador (R11) | estado PENDIENTE | sede +diferencia | APROBADO |
| `rechazar` (ajuste) | ADMIN+ | estado PENDIENTE; motivo obligatorio | ninguno | RECHAZADO |
| `anular` | ADMIN+ | motivo obligatorio; original en RECIBIDO, APLICADO (solo SALIDA) o APROBADO | ver abajo, con `contexto = 'ANULAR'` | original ANULADO + nuevo ANULACION APLICADO |

**ADMIN+** = rol `ADMIN` o `SUPERADMIN`. **Opera X** = la sede X está en `usuario_sede` del usuario (R7, aplica a todos los roles).

Al aprobar se aplica la **diferencia**, no se fija el saldo en lo contado: si entre el conteo y la aprobación hubo movimientos, esos movimientos también son reales.

**Anulación.** Se crea un movimiento `ANULACION` con `anula_a_id` y se aplica con la misma regla para todos: por línea, `origen −q` y `destino +q`.

| Original | `ANULACION.sede_origen_id` | `ANULACION.sede_destino_id` | Líneas |
|----------|----------------------------|-----------------------------|--------|
| TRASLADO RECIBIDO | destino original | origen original | mismas cantidades |
| SALIDA | vacía | origen original | mismas cantidades |
| AJUSTE APROBADO | vacía | sede del ajuste | diferencias con el signo invertido |

Un AJUSTE en sí mismo cumple la misma regla (`destino +diferencia`). La regla general vale para todos los tipos; el TRASLADO solo la parte en dos momentos (resta al enviar, suma al confirmar).

### 5.6 Productos y lotes nuevos dentro del movimiento

Solo se aceptan en `crearTraslado` desde una sede sin saldo y en `crearAjuste`. Cada línea es una de dos formas:

```ts
type LineaEntrada =
  | { loteId: number; cantidad: number }                       // lote existente
  | {
      producto: { id: number } | { codigo: string; descripcion: string; referencia?: string; marca?: string };
      nroLote: string;
      fechaVencimiento?: string; // AAAA-MM-DD
      cantidad: number;
    };
// En ajustes, `conteo` reemplaza a `cantidad`.
```

Dentro de la misma transacción: buscar el producto por `codigo` y el lote por `(producto_id, nro_lote)`; crear lo que falte con `origen = 'MANUAL'` y `creado_por`. Si el lote ya existe, se usa tal cual (su vencimiento no se sobrescribe). Así no quedan productos huérfanos si el movimiento falla.

### 5.7 Permisos

```ts
// core/permisos.ts
esAdmin(u)            // rol ADMIN o SUPERADMIN
puedeVerSede(u, id)   // esAdmin(u) || u.sedeIds.includes(id)
puedeOperarSede(u, id)// u.sedeIds.includes(id)
puedeVerMovimiento(u, m) // esAdmin(u) || origen o destino en u.sedeIds
```

El middleware `requireAuth` lee el JWT de la cookie, carga el usuario y sus sedes **desde la base en cada petición** (si lo desactivan o le quitan una sede, aplica de inmediato) y responde 401 si no está activo. `requireRol('SUPERADMIN')`, `requireRol('ADMIN','SUPERADMIN')` para las rutas de administración.

El detalle de un movimiento devuelve banderas calculadas en el backend (`puedeConfirmar`, `puedeRechazar`, `puedeAprobar`, `puedeAnular`, `puedeCrearDeNuevo`), así el frontend no repite reglas.

### 5.8 Errores

```json
{ "error": { "codigo": "SALDO_INSUFICIENTE", "mensaje": "…", "detalles": [{ "loteId": 12, "mensaje": "…" }] } }
```

| HTTP | Cuándo |
|------|--------|
| 400 | Falla la validación zod |
| 401 | Sin sesión o usuario inactivo |
| 403 | Sin permiso (rol o sede) |
| 404 | No existe o no lo puede ver |
| 409 | El estado cambió (ya confirmado, ya anulado…) |
| 422 | Regla de negocio (R1–R12) |

Todos los mensajes en español, pensados para el usuario final.

## 6. API

Prefijo `/api`. Todas exigen sesión salvo el login.

| Método y ruta | Rol | Qué hace |
|---------------|-----|----------|
| `POST /auth/login` | — | `{email, clave}` → cookie + usuario. Audita LOGIN o LOGIN_FALLIDO (`registro_id` = email). Tras 5 LOGIN_FALLIDO del mismo email en 15 min, rechazar 15 min |
| `POST /auth/logout` | todos | Borra la cookie |
| `GET /auth/me` | todos | Usuario, rol y sedes asignadas |
| `POST /auth/cambiar-clave` | todos | `{actual, nueva}` |
| `GET /sedes` | todos | Sedes activas (para listas) |
| `POST /sedes` · `PATCH /sedes/:id` | SUPERADMIN | Crear y editar. No desactivar si tiene saldo > 0 o traslados NO_CONFIRMADO |
| `GET /usuarios` · `POST /usuarios` · `PATCH /usuarios/:id` | SUPERADMIN | `PATCH` exige `motivo` si cambia el rol |
| `PUT /usuarios/:id/sedes` | SUPERADMIN | `{sedeIds}` reemplaza la asignación |
| `POST /usuarios/:id/restablecer-clave` | SUPERADMIN | Clave temporal |
| `GET /catalogo/productos?q=` | todos | Hasta 20 por código, descripción o referencia (`LIKE`) |
| `GET /catalogo/lotes?productoId=&q=` | todos | Lotes del producto |
| `POST /catalogo/resolver` | todos | `{filas:[{codigo, nroLote}]}` → por fila: producto y lote encontrados o no. Lo usa *Pegar desde Excel* |
| `GET /catalogo/marcas` | todos | Para el filtro de inventario |
| `GET /inventario/disponible?sedeId=&q=` | opera sede | Lotes con saldo > 0 en la sede, con producto y vencimiento. Alimenta traslado, salida y ajuste |
| `GET /inventario?sedeId=&q=&marca=&lote=&page=` | ver sede | Saldos > 0. Sin `sedeId`: todas las que puede ver |
| `GET /inventario/export.xlsx?…` | ver sede | Mismo filtro, en Excel |
| `GET /inventario/por-vencer?dias=90` | ver sede | Lotes con saldo y vencimiento cercano |
| `GET /kardex?loteId=&sedeId=` | ver sede | Filas del kardex con documento; `export.xlsx` igual |
| `GET /movimientos?tipo=&estado=&sedeId=&desde=&hasta=&q=&page=` | ver | `q` busca por consecutivo o documento soporte |
| `GET /movimientos/por-recibir` | todos | NO_CONFIRMADO hacia mis sedes |
| `GET /movimientos/por-aprobar` | ADMIN+ | Ajustes PENDIENTE, con saldo actual por línea |
| `GET /movimientos/:id` | ver | Cabecera, líneas, anulación enlazada y banderas de permiso |
| `POST /movimientos/traslados` | opera origen | `{sedeOrigenId, sedeDestinoId, motivo?, documentoSoporte?, observacion?, lineas}` |
| `POST /movimientos/salidas` | opera origen | `{sedeOrigenId, motivo, documentoSoporte?, observacion?, lineas}` |
| `POST /movimientos/ajustes` | opera sede | `{sedeId, observacion?, lineas}` (con `conteo`) |
| `POST /movimientos/:id/confirmar` | opera destino | |
| `POST /movimientos/:id/rechazar` | ver 5.5 | `{motivo}`; sirve para traslado y ajuste |
| `POST /movimientos/:id/aprobar` | ADMIN+ | |
| `POST /movimientos/:id/anular` | ADMIN+ | `{motivo}` |
| `GET /inicio` | todos | Contadores y listas cortas de la pantalla Inicio |
| `GET /auditoria?desde=&hasta=&usuarioId=&tabla=&accion=&page=` | ADMIN+ | |
| `GET /sync` · `POST /sync/ahora` | ADMIN+ | Últimas corridas; ejecutar ya |

Listados paginados: `?page=1&pageSize=50` → `{ items, total, page, pageSize }`.

## 7. Sincronización con el ERP

- Variables: `ERP_DB` (nombre de la base del ERP en el mismo servidor) y `SYNC_INTERVAL_MIN` (15; 0 la apaga). Sin `ERP_DB`, la sincronización queda deshabilitada y la pantalla lo dice.
- `ERP_DB` se interpola en SQL: validarla al arrancar con `/^[A-Za-z0-9_]+$/` y usar `$executeRawUnsafe` solo con ese valor validado.
- Una corrida a la vez: bandera en memoria (hay un solo proceso).
- Corre como sistema: `conUsuario(null, null, …)` o con el usuario que pulsó el botón, y deja una fila en `sync_log`.

```sql
DECLARE @acc TABLE (accion NVARCHAR(10));

MERGE producto WITH (HOLDLOCK) AS t
USING (
  SELECT LTRIM(RTRIM(p.CodProd)) COLLATE DATABASE_DEFAULT AS codigo,
         COALESCE(NULLIF(LTRIM(RTRIM(p.Descrip)), ''), LTRIM(RTRIM(p.CodProd))) COLLATE DATABASE_DEFAULT AS descripcion,
         NULLIF(LTRIM(RTRIM(p.Refere)), '') COLLATE DATABASE_DEFAULT AS referencia,
         NULLIF(LTRIM(RTRIM(m.DescripcionMarca)), '') COLLATE DATABASE_DEFAULT AS marca
  FROM [<ERP_DB>].dbo.SAPROD p
  OUTER APPLY (SELECT TOP 1 mc.DescripcionMarca FROM [<ERP_DB>].dbo.MarcasCopia mc WHERE mc.CodInst = p.CodInst) m
) AS s ON t.codigo = s.codigo
WHEN MATCHED AND (t.descripcion <> s.descripcion
               OR ISNULL(t.referencia, '') <> ISNULL(s.referencia, '')
               OR ISNULL(t.marca, '') <> ISNULL(s.marca, '')
               OR t.origen <> 'ERP')
  THEN UPDATE SET descripcion = s.descripcion, referencia = s.referencia, marca = s.marca,
                  origen = 'ERP', sincronizado_en = SYSUTCDATETIME()
WHEN NOT MATCHED BY TARGET
  THEN INSERT (codigo, descripcion, referencia, marca, origen, creado_en, sincronizado_en)
       VALUES (s.codigo, s.descripcion, s.referencia, s.marca, 'ERP', SYSUTCDATETIME(), SYSUTCDATETIME())
OUTPUT $action INTO @acc;

SELECT SUM(CASE WHEN accion = 'INSERT' THEN 1 ELSE 0 END) AS nuevos,
       SUM(CASE WHEN accion = 'UPDATE' THEN 1 ELSE 0 END) AS actualizados
FROM @acc;
```

Lotes igual, con la fuente agrupada (por si la consulta de descubrimiento muestra lotes repetidos por bodega):

```sql
SELECT pr.id AS producto_id, LTRIM(RTRIM(sl.NroLote)) COLLATE DATABASE_DEFAULT AS nro_lote,
       MAX(CAST(sl.FechaV AS DATE)) AS fecha_vencimiento
FROM [<ERP_DB>].dbo.SALOTE sl
JOIN producto pr ON pr.codigo = LTRIM(RTRIM(sl.CodProd)) COLLATE DATABASE_DEFAULT
WHERE NULLIF(LTRIM(RTRIM(sl.NroLote)), '') IS NOT NULL
GROUP BY pr.id, LTRIM(RTRIM(sl.NroLote)) COLLATE DATABASE_DEFAULT
```

Un lote `MANUAL` que aparece en el ERP pasa a `ERP` y toma su vencimiento. Nunca se borra nada.

`COLLATE DATABASE_DEFAULT`: si la base del ERP tiene otra intercalación, sin esto SQL Server da *"Cannot resolve the collation conflict"*.

**Desarrollo:** `backend/sql/erp_demo.sql` crea la base `SaintDemo` con `SAPROD (CodProd, Descrip, Refere, CodInst)`, `SALOTE (CodProd, NroLote, FechaV)` y `MarcasCopia (CodInst, DescripcionMarca)` con unas 20 filas de ejemplo (incluir `136022` / `01599-9`, un lote en minúsculas como `a12572`, uno numérico como `24084133`, y un producto con dos filas del mismo lote). Los nombres de columna reales se confirman con la consulta de descubrimiento 4.4 de la especificación.

## 8. Frontend

### 8.1 Base

- `vite.config.ts`: proxy `/api` → `http://localhost:3001`. En producción el backend sirve `frontend/dist`, misma URL, sin CORS. En Express 5 la ruta comodín que devuelve `index.html` se escribe `app.get('/{*splat}', …)`; `'*'` ya no funciona.
- `lib/api.ts`: axios con `withCredentials`; un interceptor que ante 401 limpia la sesión y manda a `/login`; otro que convierte `error.response.data.error` en un `ApiError` con `mensaje` y `detalles`.
- `lib/auth.tsx`: contexto con `GET /auth/me`; `<RequireAuth roles?>` para las rutas.
- `lib/formato.ts`: `fechaHora()` en `America/Bogota`, `fecha()` para columnas DATE en UTC, `numero()` con `es-CO`.
- TanStack Query: `staleTime` 30 s; `refetchInterval` 60 s para los contadores de *Por recibir* y *Aprobaciones*. Tras cada mutación, invalidar `movimientos`, `inventario`, `inicio`.
- Toda la interfaz en español. Funciona en el celular: menú lateral en escritorio, menú desplegable en pantallas angostas, tablas con desplazamiento horizontal propio.

### 8.2 Rutas

| Ruta | Pantalla (sección 8 de la especificación) | Rol |
|------|------------------------------------------|-----|
| `/login` | 1 Login | — |
| `/` | 2 Inicio | todos |
| `/inventario` | 3 Inventario | todos |
| `/kardex` | 4 Kardex | todos |
| `/traslados/nuevo` (`?copiar=:id`) | 5 Nuevo traslado | todos |
| `/salidas/nueva` | 6 Nueva salida | todos |
| `/ajustes/nuevo` | 7 Nuevo ajuste | todos |
| `/por-recibir` | 8 Por recibir | todos |
| `/aprobaciones` | 9 Aprobaciones | ADMIN+ |
| `/movimientos` · `/movimientos/:id` | 10 Movimientos | todos |
| `/admin/usuarios` · `/admin/sedes` | 11 Usuarios y sedes | SUPERADMIN |
| `/auditoria` | 12 Auditoría | ADMIN+ |
| `/sync` | 13 Sincronización ERP | ADMIN+ |

Los enlaces del menú que el rol no puede usar no se muestran. *Por recibir* y *Aprobaciones* llevan un contador.

### 8.3 Detalles de experiencia que importan

**Nuevo traslado / salida desde sede normal**
- Al elegir la sede origen se cargan sus lotes con saldo (`/inventario/disponible`). Un buscador filtra por código, descripción, referencia o lote mientras se escribe (300 ms de espera).
- Cada línea muestra *Disponible: 5*. El campo de cantidad tiene `max` igual al disponible y se marca en rojo si se pasa; el botón *Enviar* queda deshabilitado.
- Antes de enviar, un resumen: *"Vas a enviar 12 unidades en 4 líneas de Bogotá a Medellín"*.
- Si el backend responde 422 con `detalles`, marcar cada línea con su mensaje; no perder lo digitado.
- Con `?copiar=:id` (desde un traslado rechazado) se prellenan origen, destino y líneas.

**Nuevo traslado desde la Bodega ERP**
- Buscador de producto con sugerencias del catálogo; cada sugerencia con etiqueta *ERP* o *Manual*. Si no aparece: *Crear producto "X"* abre campos de código, descripción, referencia y marca en la misma línea.
- Buscador de lote del producto elegido. Si no aparece: *Crear lote "X"* con vencimiento (prellenado si viene del ERP).
- **Pegar desde Excel**: un cuadro donde se pegan filas copiadas (código, lote, vencimiento, cantidad, separadas por tabulación). Se llama a `/catalogo/resolver` y se muestra cada fila con su estado: *ok*, *lote nuevo*, *producto desconocido (falta descripción)*. Se corrige ahí y se agregan las líneas. Es la herramienta de la carga inicial.

**Nuevo ajuste**
- Elegir sede; agregar lotes desde sus lotes con saldo o desde el catálogo (un lote encontrado en el conteo que el sistema no tenía).
- Por línea: *Sistema* (solo lectura), *Contado* (se digita), *Diferencia* calculada (verde +, rojo −). Las líneas con diferencia 0 se marcan como "sin cambio" y no se envían.

**Por recibir**
- Una tarjeta por traslado: origen, fecha, quién lo envió, documento, líneas.
- *Confirmar recibido*: diálogo *"Confirmo que recibí físicamente todo lo listado."*
- *Rechazar*: motivo obligatorio, con la ayuda *"Si llegó algo distinto, recházalo; el origen lo enviará de nuevo con lo correcto."*

**Aprobaciones**
- Por ajuste: lote, sistema al contar, saldo actual, contado, diferencia. Si el saldo actual cambió desde el conteo, aviso: *"El saldo cambió desde el conteo (era 3, ahora 5). Se aplicará la diferencia: −1."*
- *Aprobar* deshabilitado en los ajustes propios, con el texto *"No puedes aprobar tu propio ajuste."*

**Movimientos**
- Insignias de estado con color fijo: NO_CONFIRMADO ámbar, RECIBIDO / APLICADO / APROBADO verde, PENDIENTE azul, RECHAZADO rojo, ANULADO gris.
- El detalle muestra el motivo de rechazo o anulación y enlaza la ANULACION con su original.
- En un traslado RECHAZADO, quien opera el origen ve *Crear de nuevo*.

**Botones de acción**: deshabilitados mientras la petición está en curso (evita doble envío).

## 9. Configuración y arranque

`docker-compose.yml`:

```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "Dev_Inventario_2026!"
    ports:
      - "1433:1433"
    volumes:
      - mssql:/var/opt/mssql
volumes:
  mssql:
```

`backend/.env.example`:

```
DATABASE_URL="sqlserver://localhost:1433;database=InventarioSedes;user=sa;password=Dev_Inventario_2026!;trustServerCertificate=true"
DATABASE_URL_TEST="sqlserver://localhost:1433;database=InventarioSedes_test;user=sa;password=Dev_Inventario_2026!;trustServerCertificate=true"
JWT_SECRET="cambiar"
JWT_EXPIRES_IN="12h"
PORT=3001
ERP_DB="SaintDemo"
SYNC_INTERVAL_MIN=15
SEED_SUPERADMIN_EMAIL="admin@rpdental.local"
SEED_SUPERADMIN_CLAVE="cambiar"
```

Scripts del backend: `dev`, `build`, `start`, `db:migrate`, `db:reset`, `db:seed`, `erp:demo` (corre `sql/erp_demo.sql`), `test`.

**Seed** (`prisma/seed.ts`): superadmin desde `.env`; sedes `BOG` Bogotá y `MED` Medellín (controlan saldo) y `ERP` Bodega ERP (sin saldo). En desarrollo, además: un admin y un usuario base por sede, y un traslado `CARGA_INICIAL` desde la Bodega ERP a Bogotá ya confirmado, para que haya datos.

**Producción**: base `InventarioSedes` en el servidor del ERP; usuario de SQL propio con permisos sobre esa base y solo `SELECT` sobre `SAPROD`, `SALOTE` y `MarcasCopia`; un solo proceso Node (`npm run build && npm start`) como servicio de Windows (NSSM o pm2); cookie con `secure: true` detrás de HTTPS.

## 10. Pruebas

- Vitest + supertest contra `InventarioSedes_test`. `globalSetup` corre `prisma migrate reset --force --skip-seed` una vez por ejecución.
- **Sin limpieza entre pruebas:** cada prueba crea sus propias sedes, usuarios y lotes con códigos únicos (`factories.ts`). Así no choca con los triggers que bloquean `DELETE` en `kardex`.
- Un archivo por caso P1–P19 de la especificación. Las de reglas llaman al servicio; las de permisos (P6, P12, P14) van por HTTP.
- P3 (concurrencia): dos `crearTraslado` con `Promise.all` sobre un saldo de 3, cada uno de 2. Debe pasar exactamente uno y el saldo quedar en 1.
- P9: `UPDATE saldo SET cantidad = -1` crudo debe fallar.
- P15: dos `confirmar` simultáneos → uno responde OK y el otro 409; el destino suma una sola vez.
- P19: helper `verificarInvariante()` que compara `saldo` con `SUM(kardex)` agrupado; llamarlo en el `afterEach` de todas las pruebas.

## 11. Verificaciones tempranas (hacer primero, antes de construir encima)

Son supuestos de este diseño que solo se confirman ejecutando:

1. **Prisma insertando en tablas con triggers.** SQL Server no permite `OUTPUT` sin `INTO` en tablas con triggers, y Prisma usa `OUTPUT` en los `INSERT`. Probar `prisma.movimiento.create()` con el trigger activo. Si falla: quitar los triggers de auditoría y escribir la auditoría desde el backend, en la misma transacción, con una función `auditar(tx, {tabla, registroId, accion, antes, despues})` llamada desde los servicios. Los bloqueos de `kardex` y `auditoria` son `INSTEAD OF UPDATE, DELETE` y no afectan los `INSERT`.
2. **`SESSION_CONTEXT` dentro de `$transaction` interactiva**: confirmar que el trigger lee el `usuario_id` fijado al inicio.
3. **`UPDLOCK, HOLDLOCK`**: correr P3 y P15 antes de seguir con las pantallas.
4. **Contra el ERP real** (fase 0 de la especificación): nombres de columnas, lotes repetidos, intercalación de la base del ERP, permiso de lectura entre bases.

## 12. Orden de construcción

| Paso | Qué | Listo cuando |
|------|-----|--------------|
| 1 | `docker-compose`, backend base, esquema, migración `reglas_sql`, seed, `erp_demo.sql` | `db:reset` corre limpio; verificaciones 1 y 2 hechas |
| 2 | `conUsuario`, `aplicarEfectos`, consecutivos, servicio de movimientos | P1–P5, P7–P11, P13, P15, P16, P19 en verde |
| 3 | Auth, permisos, rutas de la API | P6, P12, P14, P17 en verde |
| 4 | Frontend: login, layout, menú por rol, cliente API | Se entra con cada rol y se ve su menú |
| 5 | Pantallas 5–10 (los flujos de movimiento) | Recorrido completo en el navegador: carga inicial → traslado → rechazo → crear de nuevo → recibido → salida → ajuste → aprobación → anulación |
| 6 | Pantallas 2–4 (inicio, inventario, kardex) y exportar a Excel | Cifras cuadran con `v_inventario_sede` |
| 7 | Pantallas 11–13 y sincronización | P18 en verde con `SaintDemo` |
| 8 | Build de producción servido por el backend y README | `npm run build && npm start` sirve todo en una URL |
