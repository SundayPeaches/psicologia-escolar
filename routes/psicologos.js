const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Listar psicólogos ─────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.telefono,
              p.cedula_prof, p.especialidades, p.bio, p.foto_url, p.max_citas_dia
       FROM psicologos p
       JOIN usuarios u ON u.id = p.id
       WHERE u.activo = TRUE
       ORDER BY u.apellido`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener psicologos' });
  }
});

// ── Slots disponibles de un psicólogo ────────────────────
router.get('/:id/disponibilidad', authenticate, async (req, res) => {
  const { fecha } = req.query; // YYYY-MM-DD
  if (!fecha) return res.status(400).json({ error: 'Parametro fecha requerido (YYYY-MM-DD)' });

  try {
    const dia = new Date(fecha + 'T00:00:00');
    const diaSemana = dia.getDay() === 0 ? 7 : dia.getDay(); // Lunes=1 .. Domingo=7

    const horarios = await db.query(
      `SELECT hora_inicio, hora_fin, duracion_min
       FROM horarios_disponibles
       WHERE psicologo_id = $1 AND dia_semana = $2 AND activo = TRUE`,
      [req.params.id, diaSemana]
    );

    // Citas ya tomadas ese día
    const citasTomadas = await db.query(
      `SELECT fecha_hora_inicio, fecha_hora_fin FROM citas
       WHERE psicologo_id = $1
         AND DATE(fecha_hora_inicio AT TIME ZONE 'America/Mexico_City') = $2
         AND estado NOT IN ('cancelada_estudiante','cancelada_psicologo','no_presentado')`,
      [req.params.id, fecha]
    );

    const slots = [];
    for (const h of horarios.rows) {
      const [hIni, mIni] = h.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = h.hora_fin.split(':').map(Number);
      let cur = hIni * 60 + mIni;
      const end = hFin * 60 + mFin;

      while (cur + h.duracion_min <= end) {
        const slotInicio = new Date(fecha + 'T' + String(Math.floor(cur/60)).padStart(2,'0') + ':' + String(cur%60).padStart(2,'0') + ':00');
        const slotFin    = new Date(slotInicio.getTime() + h.duracion_min * 60000);

        const ocupado = citasTomadas.rows.some(c => {
          const ci = new Date(c.fecha_hora_inicio);
          const cf = new Date(c.fecha_hora_fin);
          return slotInicio < cf && slotFin > ci;
        });

        slots.push({ inicio: slotInicio.toISOString(), fin: slotFin.toISOString(), disponible: !ocupado });
        cur += h.duracion_min;
      }
    }

    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular disponibilidad' });
  }
});

// ── Horarios de un psicólogo ──────────────────────────────
router.get('/:id/horarios', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, dia_semana, hora_inicio, hora_fin, duracion_min, activo
       FROM horarios_disponibles
       WHERE psicologo_id = $1 ORDER BY dia_semana, hora_inicio`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

// ── Agregar horario (solo psicólogo dueño o admin) ───────
router.post('/:id/horarios', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  if (req.user.rol_id === 2 && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'Solo puedes editar tus propios horarios' });

  const { dia_semana, hora_inicio, hora_fin, duracion_min = 50 } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO horarios_disponibles (psicologo_id, dia_semana, hora_inicio, hora_fin, duracion_min)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, dia_semana, hora_inicio, hora_fin, duracion_min]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear horario' });
  }
});

// ── Actualizar perfil del psicólogo ──────────────────────
router.patch('/:id', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  if (req.user.rol_id === 2 && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });

  const { bio, foto_url, especialidades, cedula_prof, max_citas_dia } = req.body;
  try {
    const fields = [], params = [];
    let idx = 1;
    if (bio            !== undefined) { fields.push(`bio=$${idx++}`);            params.push(bio); }
    if (foto_url       !== undefined) { fields.push(`foto_url=$${idx++}`);       params.push(foto_url); }
    if (especialidades !== undefined) { fields.push(`especialidades=$${idx++}`); params.push(especialidades); }
    if (cedula_prof    !== undefined) { fields.push(`cedula_prof=$${idx++}`);    params.push(cedula_prof); }
    if (max_citas_dia  !== undefined) { fields.push(`max_citas_dia=$${idx++}`);  params.push(max_citas_dia); }

    if (!fields.length) return res.status(422).json({ error: 'No hay campos para actualizar' });
    params.push(req.params.id);
    const result = await db.query(
      `UPDATE psicologos SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

module.exports = router;
