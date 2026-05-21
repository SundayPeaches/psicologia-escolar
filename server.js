app.set('trust proxy', 1);
require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const authRoutes        = require('./routes/auth');
const pacienteRoutes = require('./routes/paciente');
const citasRoutes       = require('./routes/citas');
const psicologosRoutes  = require('./routes/psicologos');
const generalRoutes     = require('./routes/general');
const expedientesRoutes = require('./routes/expedientes');
const tareasRoutes      = require('./routes/tareas');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

const limiter = rateLimit({ windowMs: 15*60*1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 30 });
app.use(limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/citas',       citasRoutes);
app.use('/api/paciente',    pacienteRoutes);
app.use('/api/psicologos',  psicologosRoutes);
app.use('/api/expedientes', expedientesRoutes);
app.use('/api/tareas',      tareasRoutes);
app.use('/api',             generalRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n  Psicologia Escolar - Servidor iniciado`);
  console.log(`  http://localhost:${PORT}\n`);
});

module.exports = app;
