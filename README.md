# Inventario por Sedes — RP Dental

App web que reemplaza el kardex en Excel y aísla el inventario aprobado (lo verificado físicamente) del inventario del ERP. Ver [Inventario_Sedes_Especificacion_v0.3.md](Inventario_Sedes_Especificacion_v0.3.md) (qué hace, reglas R1–R12) y [Inventario_Sedes_Diseno_Tecnico_v0.3.md](Inventario_Sedes_Diseno_Tecnico_v0.3.md) (cómo está construido).

## Arrancar en local

Requiere Docker Desktop corriendo y Node 20.

```bash
docker compose up -d                 # SQL Server en :1433
cd backend
cp .env.example .env                 # ya trae valores de desarrollo que funcionan
npm install
npm run db:reset                     # migra + aplica reglas_sql + seed
npm run erp:demo                     # crea la base SaintDemo (ERP falso) para probar la sincronización
npm run dev                          # API en :3001
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev                          # :5173, proxy /api -> :3001
```

Abrir `http://localhost:5173`.

### Usuarios de prueba (creados por el seed)

| Correo | Clave | Rol | Sede |
|---|---|---|---|
| `admin@rpdental.local` | `Admin123!` | SUPERADMIN | ninguna (crea usuarios y sedes; para operar necesita que le asignen una) |
| `admin.bog@rpdental.local` | `Admin123!` | ADMIN | Bogotá |
| `base.bog@rpdental.local` | `Base123!` | BASE | Bogotá |
| `admin.med@rpdental.local` | `Admin123!` | ADMIN | Medellín |
| `base.med@rpdental.local` | `Base123!` | BASE | Medellín |

El seed además crea la Bodega ERP (sede sin saldo) y un traslado `CARGA_INICIAL` ya confirmado con 20 unidades en Bogotá, para que haya datos al entrar.

## Pruebas

```bash
cd backend
npm test        # P1–P19 de la especificación, contra InventarioSedes_test
```

Corre con `globalSetup` propio: recrea `InventarioSedes_test` por SQL directo y aplica las migraciones (no usa `prisma migrate reset` para no disparar la protección de Prisma contra comandos destructivos invocados por un agente de IA).

## Producción

```bash
cd backend && npm run build
cd ../frontend && npm run build      # genera frontend/dist
cd ../backend && npm start           # sirve la API y frontend/dist en una sola URL (NODE_ENV=production)
```

Variables de entorno de producción: ver `backend/.env.example`. En el servidor real, `DATABASE_URL` apunta a la base `InventarioSedes` en el mismo SQL Server del ERP, con un usuario de aplicación que solo tiene `SELECT` sobre `SAPROD`, `SALOTE` y `MarcasCopia`, y sin permiso de `UPDATE`/`DELETE` sobre `auditoria` ni `kardex` (además del trigger que ya lo bloquea).

## Pendientes conocidos (ver sección 13 de la especificación)

- **D3 (rotación)**: no implementado — la especificación lo deja condicionado ("si sí, se agrega...") sin resolver. Si se necesita, agrega `estado` (APROBADO/ROTACION) a `saldo` y `movimiento_linea`.
- **D5**: cantidad real de sedes y usuarios — se seedearon Bogotá y Medellín como ejemplo; agregar las demás sedes desde Usuarios y sedes (superadmin).
- El checklist de inspección al confirmar recepción desde la Bodega ERP (D4) es una validación de interfaz (obliga a marcar las casillas antes de habilitar "Confirmar"); no queda guardado como dato en la base porque el diseño no define columnas para eso.
