# Sistema de Reservacion de Citas — Psicologia Escolar

Sistema completo de agendamiento de citas para centros de atencion psicologica en instituciones educativas. Incluye backend REST con Node.js + Express, base de datos PostgreSQL y frontend SPA integrado.

---

## Tecnologias

- **Backend**: Node.js 18+ / Express 4
- **Base de datos**: PostgreSQL 14+
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla (SPA)
- **Autenticacion**: JWT (Bearer token)
- **Seguridad**: Helmet, CORS, rate limiting, bcrypt

---

## Requisitos previos

- Node.js >= 18
- PostgreSQL >= 14 corriendo localmente o en la nube
- npm >= 9

---

## Instalacion

### 1. Clonar el proyecto

```bash
cd psicologia-escolar
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales de PostgreSQL y un JWT_SECRET seguro
```

### 3. Crear la base de datos

```bash
psql -U postgres -c "CREATE DATABASE psicologia_escolar;"
psql -U postgres -d psicologia_escolar -f database/schema.sql
```

### 4. Cargar datos de demo (opcional)

```bash
node database/seed.js
```

Esto crea los siguientes usuarios de prueba:

| Email                            | Password  | Rol          |
|----------------------------------|-----------|--------------|
| admin@demo.com                   | demo1234  | Administrador|
| laura.mendoza@universidad.edu    | demo1234  | Psicologa    |
| carlos.reyes@universidad.edu     | demo1234  | Psicologo    |
| estudiante@demo.com              | demo1234  | Estudiante   |

### 5. Iniciar el servidor

```bash
# Produccion
npm start

# Desarrollo (con auto-reload)
npm run dev
```

Accede en: **http://localhost:3000**

---

## Estructura del proyecto

```
psicologia-escolar/
├── config/
│   └── db.js                  # Conexion PostgreSQL (Pool)
├── database/
│   ├── schema.sql             # DDL completo con triggers e indices
│   └── seed.js                # Datos iniciales de demo
├── middleware/
│   └── auth.js                # JWT verify + requireRole()
├── routes/
│   ├── auth.js                # POST /api/auth/login|registro, GET /api/auth/me
│   ├── citas.js               # CRUD de citas
│   ├── psicologos.js          # Listado, disponibilidad, horarios
│   └── general.js             # Motivos, facultades, notificaciones, stats
├── public/
│   └── index.html             # SPA completa (HTML + CSS + JS)
├── server.js                  # Entry point Express
├── package.json
└── .env.example
```

---

## API Reference

### Autenticacion

| Metodo | Endpoint              | Descripcion                   | Auth |
|--------|-----------------------|-------------------------------|------|
| POST   | /api/auth/registro    | Crear cuenta de estudiante    | No   |
| POST   | /api/auth/login       | Iniciar sesion                | No   |
| GET    | /api/auth/me          | Perfil del usuario actual     | Si   |

### Citas

| Metodo | Endpoint               | Descripcion                    | Auth |
|--------|------------------------|--------------------------------|------|
| GET    | /api/citas             | Listar citas (filtrado por rol)| Si   |
| POST   | /api/citas             | Crear nueva cita               | Si   |
| GET    | /api/citas/:id         | Detalle de una cita            | Si   |
| PATCH  | /api/citas/:id/estado  | Cambiar estado de la cita      | Si   |

**Estados posibles**: pendiente → confirmada → en_curso → completada
Cancelaciones: cancelada_estudiante, cancelada_psicologo, no_presentado

### Psicologos

| Metodo | Endpoint                              | Descripcion                  | Auth |
|--------|---------------------------------------|------------------------------|------|
| GET    | /api/psicologos                       | Listar especialistas activos | Si   |
| GET    | /api/psicologos/:id/disponibilidad    | Slots disponibles (por fecha)| Si   |
| GET    | /api/psicologos/:id/horarios          | Horarios registrados         | Si   |
| POST   | /api/psicologos/:id/horarios          | Agregar bloque horario       | Si   |

### General

| Metodo | Endpoint                          | Descripcion                   | Auth |
|--------|-----------------------------------|-------------------------------|------|
| GET    | /api/motivos                      | Motivos de consulta           | No   |
| GET    | /api/facultades                   | Facultades registradas        | No   |
| GET    | /api/notificaciones               | Notificaciones del usuario    | Si   |
| PATCH  | /api/notificaciones/:id/leer      | Marcar notificacion como leida| Si   |
| GET    | /api/stats                        | Estadisticas (admin)          | Si   |

---

## Roles y permisos

| Accion                      | Estudiante | Psicologo | Admin |
|-----------------------------|:----------:|:---------:|:-----:|
| Registrarse                 | Si         | —         | —     |
| Reservar cita               | Si         | —         | Si    |
| Ver sus propias citas       | Si         | Si        | Si    |
| Ver todas las citas         | —          | —         | Si    |
| Confirmar / completar citas | —          | Si        | Si    |
| Gestionar horarios          | —          | Si        | Si    |
| Ver estadisticas            | —          | —         | Si    |

---

## Esquema de base de datos

Las tablas principales son:

- **usuarios** — base de todos los perfiles (estudiantes, psicologos, admins)
- **psicologos** — extiende usuarios con datos profesionales
- **horarios_disponibles** — bloques de atencion por dia de semana
- **citas** — reservaciones con estado, modalidad y notas
- **notificaciones** — alertas en tiempo real para los usuarios
- **motivos_consulta** — catalogo de razones de consulta
- **facultades** — dependencias academicas
- **bloqueos_agenda** — vacaciones y dias no disponibles

---

## Seguridad implementada

- Passwords hasheados con bcrypt (rounds configurables via .env)
- JWT de corta duracion (8h por defecto)
- Helmet para headers HTTP seguros
- CORS configurado por variable de entorno
- Rate limiting: 200 req/15min general, 20 req/15min en login
- Validacion de inputs con express-validator
- Proteccion de datos: estudiantes no pueden leer notas del psicologo

---

## Personalizacion

Para adaptar a tu institucion, edita en `database/schema.sql`:
- Las **facultades** registradas en el INSERT inicial
- Los **motivos de consulta** disponibles
- La **duracion por defecto** de las sesiones (default: 50 min)

Para modificar la identidad visual, edita las variables CSS en el `:root` de `public/index.html`.
