# Inventario por Sedes — RP Dental

App web que reemplaza el kardex en Excel y aísla el inventario aprobado (lo verificado físicamente) del inventario del ERP. Ver [Inventario_Sedes_Especificacion_v0.3.md](Inventario_Sedes_Especificacion_v0.3.md) (qué hace, reglas R1–R12) y [Inventario_Sedes_Diseno_Tecnico_v0.3.md](Inventario_Sedes_Diseno_Tecnico_v0.3.md) (cómo está construido).

Backend: Node 20 + Express 5 + Prisma 6 + SQL Server. Frontend: React 19 + Vite 6 + Tailwind 4.

---

## 1. Requisitos en el equipo nuevo

Instalar antes de clonar:

- **Node.js 20.x** (LTS) — [nodejs.org](https://nodejs.org). Verificar con `node --version`.
- **Docker Desktop** — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop). Solo se usa para correr SQL Server en local; en Windows, dejar que instale WSL2 si lo pide.
- **Git**.

No hace falta instalar SQL Server, Prisma CLI, ni nada más de forma global: todo lo demás llega con `npm install`.

## 2. Primera vez en un equipo (clonar y levantar)

Abrir una terminal (PowerShell en Windows) y ejecutar:

```bash
git clone https://github.com/DavidRuizL/inventario.git
cd inventario
```

### 2.1 Levantar la base de datos

**Abrir Docker Desktop primero** (la app de escritorio) y esperar a que el ícono de la ballena diga que está listo. Luego:

```bash
docker compose up -d
```

Esto crea un contenedor de SQL Server 2022 en el puerto `1433` con la clave `Dev_Inventario_2026!` (ya está en `docker-compose.yml`, es solo para desarrollo local). Confirmar que quedó sano:

```bash
docker compose ps
# STATUS debe decir "Up ... (healthy)"
```

### 2.2 Backend

```bash
cd backend
copy .env.example .env      # Windows (PowerShell/cmd). En Git Bash o Mac/Linux: cp .env.example .env
npm install
npm run db:reset            # crea la base, migra, aplica triggers/CHECK y corre el seed
npm run erp:demo            # crea la base SaintDemo (ERP falso), para la pantalla de Sincronización
```

`.env.example` ya trae valores que funcionan tal cual contra el SQL Server de Docker — no hay que editar nada para desarrollo local. `db:reset` crea la base `InventarioSedes` sola (Prisma la crea si no existe); no hay que crearla a mano.

Dejar el backend corriendo:

```bash
npm run dev                 # API en http://localhost:3001
```

### 2.3 Frontend

En **otra terminal**, desde la raíz del repo:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, con proxy /api -> :3001
```

### 2.4 Entrar

Abrir `http://localhost:5173` e iniciar sesión con cualquiera de los usuarios de la tabla de abajo.

## 3. Ya lo tenías instalado y solo quieres traer cambios nuevos

```bash
git pull
```

Después, según lo que haya cambiado:

| Qué cambió | Qué correr |
|---|---|
| Archivos dentro de `backend/src` o `frontend/src` | Nada extra: `npm run dev` ya los recarga solo (tsx watch / Vite HMR). |
| `backend/package.json` o `frontend/package.json` | `npm install` en la carpeta correspondiente. |
| Hay una carpeta nueva en `backend/prisma/migrations/` | `cd backend && npm run db:migrate` (aplica solo lo que falte, sin borrar datos). Si prefieres partir de cero: `npm run db:reset`. |
| `backend/prisma/schema.prisma` cambió | Igual que arriba, más `npm run db:generate` si por algún motivo el cliente de Prisma no se regeneró solo. |

Docker Desktop y el contenedor de SQL Server normalmente quedan corriendo entre reinicios del equipo; si no, `docker compose up -d` de nuevo.

## 4. Verificar que quedó bien

1. `curl http://localhost:3001/health` → `{"status":"ok",...}`.
2. Entrar a `http://localhost:5173/login`, ver el logo de RP Dental y los colores corporativos.
3. Iniciar sesión con `admin.bog@rpdental.local` / `Admin123!` y ver el menú lateral con contador en "Movimientos".
4. En **Inventario**, debe aparecer el tornillo de titanio con 20 unidades en Bogotá (lo crea el seed).

Si algo de esto falla, ver la sección 7 (problemas comunes).

### Usuarios de prueba (creados por el seed)

| Correo | Clave | Rol | Sede |
|---|---|---|---|
| `admin@rpdental.local` | `Admin123!` | SUPERADMIN | ninguna (crea usuarios y sedes; para operar necesita que le asignen una) |
| `admin.bog@rpdental.local` | `Admin123!` | ADMIN | Bogotá |
| `base.bog@rpdental.local` | `Base123!` | BASE | Bogotá |
| `admin.med@rpdental.local` | `Admin123!` | ADMIN | Medellín |
| `base.med@rpdental.local` | `Base123!` | BASE | Medellín |

El seed además crea la Bodega ERP (sede sin saldo) y un traslado `CARGA_INICIAL` ya confirmado con 20 unidades en Bogotá, para que haya datos al entrar.

## 5. Pruebas

```bash
cd backend
npm test        # P1–P19 de la especificación, contra InventarioSedes_test
```

Corre con un `globalSetup` propio: recrea `InventarioSedes_test` por SQL directo y aplica las migraciones (Prisma también la crea sola la primera vez). No hace falta nada manual, solo que Docker esté arriba.

## 6. Producción (servidor real)

Esto es para cuando el equipo nuevo **es** el servidor donde va a quedar corriendo la app (no un PC de desarrollo):

```bash
cd backend && npm run build       # compila a backend/dist
cd ../frontend && npm run build   # compila a frontend/dist
cd ../backend
NODE_ENV=production npm start     # sirve la API y frontend/dist en una sola URL, un solo proceso
```

En PowerShell, la última línea es `$env:NODE_ENV="production"; npm start`. En cmd.exe, `set NODE_ENV=production && npm start`.

Antes de eso, en `backend/.env` del servidor (no el de desarrollo):

- `DATABASE_URL`: apunta a la base `InventarioSedes` en el **mismo SQL Server del ERP** (así la sincronización es una consulta entre bases, sin exponer el ERP a internet). Usuario de aplicación con permisos normales sobre `InventarioSedes` y **solo `SELECT`** sobre `SAPROD`, `SALOTE` y `MarcasCopia`. Además, revisar que ese usuario **no** tenga `UPDATE`/`DELETE` sobre `auditoria` ni `kardex` (el trigger ya lo bloquea, pero el permiso de base de datos es una segunda barrera).
- `JWT_SECRET`: un valor largo y aleatorio real, no el de desarrollo.
- `ERP_DB`: el nombre real de la base del ERP en ese servidor (no `SaintDemo`).
- `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_CLAVE`: el superadmin real; cambiar la clave apenas se entra por primera vez.

Para que quede corriendo siempre (no solo mientras la terminal esté abierta), usar un gestor de procesos como [pm2](https://pm2.keymetrics.io/) o [NSSM](https://nssm.cc/) (como servicio de Windows) apuntando a `npm start` dentro de `backend/`.

Si el servidor va detrás de HTTPS, en `backend/src/shared/middleware/auth.ts` la cookie de sesión ya se pone `secure: true` automáticamente cuando `NODE_ENV=production` — no hay que tocar nada ahí, solo asegurarse de que la URL real sea `https://`.

## 7. Problemas comunes

| Síntoma | Causa típica |
|---|---|
| `docker compose up -d` no hace nada o tarda mucho | Docker Desktop no estaba abierto. Abrirlo y esperar a que termine de iniciar antes de reintentar. |
| Prisma dice que no puede conectar a `localhost:1433` | El contenedor no terminó de arrancar todavía (tarda ~15-20s la primera vez). Esperar y correr `docker compose ps` hasta ver `healthy`. |
| `EADDRINUSE` en el puerto 3001 o 5173 | Ya hay otro `npm run dev` corriendo (de una terminal anterior que quedó abierta). Cerrarla o matar el proceso que tiene el puerto. |
| El login da 401 con las claves de la tabla | Verificar que sí corriste `npm run db:reset` (sin eso no existen los usuarios) y que estás contra la base correcta en `.env`. |
| La sincronización ERP dice "no configurada" | Falta `ERP_DB` en `backend/.env`, o no corriste `npm run erp:demo` en desarrollo. |
| `npm run db:migrate` o `db:reset` fallan por permisos / "destructive action" | Si lo corre un asistente de IA (Claude Code, Copilot, etc.) en vez de la persona directamente, Prisma bloquea `migrate reset` por seguridad y pide confirmación explícita — corriéndolo tú mismo en la terminal no tiene ese problema. |

## 8. Pendientes conocidos (ver sección 13 de la especificación)

- **D3 (rotación)**: no implementado — la especificación lo deja condicionado ("si sí, se agrega...") sin resolver. Si se necesita, agrega `estado` (APROBADO/ROTACION) a `saldo` y `movimiento_linea`.
- **D5**: cantidad real de sedes y usuarios — se seedearon Bogotá y Medellín como ejemplo; agregar las demás sedes desde Usuarios y sedes (superadmin).
- El checklist de inspección al confirmar recepción desde la Bodega ERP (D4) es una validación de interfaz (obliga a marcar las casillas antes de habilitar "Confirmar"); no queda guardado como dato en la base porque el diseño no define columnas para eso.
