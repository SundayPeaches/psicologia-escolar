const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db       = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Registro ──────────────────────────────────────────────
router.post('/registro',
  [
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('apellido').trim().notEmpty().withMessage('Apellido requerido'),
    body('email').isEmail().normalizeEmail().withMessage('Email invalido'),
    body('password').isLength({ min: 8 }).withMessage('Minimo 8 caracteres'),
    body('matricula').optional().trim(),
    body('facultad_id').optional().isInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { nombre, apellido, email, password, matricula, facultad_id, telefono } = req.body;

    try {
      const existe = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
      if (existe.rows.length) return res.status(409).json({ error: 'Email ya registrado' });

      const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

      const result = await db.query(
        `INSERT INTO usuarios (nombre, apellido, email, password_hash, matricula,
          facultad_id, telefono, rol_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1) RETURNING id, nombre, apellido, email, rol_id`,
        [nombre, apellido, email, hash, matricula || null,
         facultad_id || null, telefono || null]
      );

      const user = result.rows[0];
      const token = generateToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// ── Login ──────────────────────────────────────────────────
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const result = await db.query(
        `SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash,
                u.rol_id, u.activo, r.nombre AS rol
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         WHERE u.email = $1`,
        [email]
      );

      const user = result.rows[0];
      if (!user || !user.activo) return res.status(401).json({ error: 'Credenciales invalidas' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Credenciales invalidas' });

      const token = generateToken(user);
      const { password_hash, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// ── Perfil actual ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.matricula, u.telefono,
              u.rol_id, r.nombre AS rol, f.nombre AS facultad, u.creado_en,
              u.foto_url, u.color_perfil, u.emoji_perfil, u.bio_personal
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN facultades f ON f.id = u.facultad_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Actualizar perfil propio ──────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  const { nombre, apellido, telefono, password, foto_url, color_perfil, emoji_perfil, bio_personal } = req.body;
  try {
    const fields = [], vals = [];
    let i = 1;
    if (nombre      !== undefined) { fields.push(`nombre=$${i++}`);       vals.push(nombre); }
    if (apellido    !== undefined) { fields.push(`apellido=$${i++}`);     vals.push(apellido); }
    if (telefono    !== undefined) { fields.push(`telefono=$${i++}`);     vals.push(telefono); }
    if (foto_url    !== undefined) { fields.push(`foto_url=$${i++}`);     vals.push(foto_url || null); }
    if (color_perfil!== undefined) { fields.push(`color_perfil=$${i++}`); vals.push(color_perfil); }
    if (emoji_perfil!== undefined) { fields.push(`emoji_perfil=$${i++}`); vals.push(emoji_perfil); }
    if (bio_personal!== undefined) { fields.push(`bio_personal=$${i++}`); vals.push(bio_personal); }
    if (password) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password_hash=$${i++}`);
      vals.push(hash);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    vals.push(req.user.id);
    const result = await db.query(
      `UPDATE usuarios SET ${fields.join(',')} WHERE id=$${i} RETURNING id, nombre, apellido, email, foto_url, color_perfil, emoji_perfil, bio_personal`,
      vals
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

function generateToken(user) {
  return jwt.sign(
    { id: user.id, rol_id: user.rol_id },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

module.exports = router;
