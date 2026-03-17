const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Motivos de consulta ───────────────────────────────────
router.get('/motivos', async (_req, res) => {
  try {
    const result = await db.query('SELECT id, nombre FROM motivos_consulta WHERE activo = TRUE ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener motivos' });
  }
});

// ── Facultades ────────────────────────────────────────────
router.get('/facultades', async (_req, res) => {
  try {
    const result = await db.query('SELECT id, nombre, codigo FROM facultades ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener facultades' });
  }
});

// ── Notificaciones del usuario ────────────────────────────
router.get('/notificaciones', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, cita_id, tipo, mensaje, leida, creada_en
       FROM notificaciones WHERE usuario_id = $1 ORDER BY creada_en DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// ── Marcar notificacion como leida ────────────────────────
router.patch('/notificaciones/:id/leer', authenticate, async (req, res) => {
  try {
    await db.query(
      `UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar notificacion' });
  }
});

// ── Dashboard stats (admin) ───────────────────────────────
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [citas, psicologo, estudiantes] = await Promise.all([
      db.query(`SELECT estado, COUNT(*) AS total FROM citas GROUP BY estado`),
      db.query(`SELECT COUNT(*) AS total FROM psicologos`),
      db.query(`SELECT COUNT(*) AS total FROM usuarios WHERE rol_id = 1 AND activo = TRUE`),
    ]);
    res.json({
      citas: citas.rows,
      psicologos: parseInt(psicologo.rows[0].total),
      estudiantes: parseInt(estudiantes.rows[0].total),
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estadisticas' });
  }
});

module.exports = router;
