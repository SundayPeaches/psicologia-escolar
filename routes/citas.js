const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Listar citas (estudiante ve las suyas; psicólogo las propias; admin todas) ──
router.get('/', authenticate, async (req, res) => {
  try {
    const { estado, desde, hasta, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const roleMap = { 1: 'estudiante', 2: 'psicologo', 3: 'admin' };
    const rol = roleMap[req.user.rol_id];

    let where = [];
    let params = [];
    let idx = 1;

    if (rol === 'estudiante') { where.push(`c.estudiante_id = $${idx++}`); params.push(req.user.id); }
    else if (rol === 'psicologo') { where.push(`c.psicologo_id = $${idx++}`); params.push(req.user.id); }

    if (estado)  { where.push(`c.estado = $${idx++}`);              params.push(estado); }
    if (desde)   { where.push(`c.fecha_hora_inicio >= $${idx++}`);  params.push(desde); }
    if (hasta)   { where.push(`c.fecha_hora_inicio <= $${idx++}`);  params.push(hasta); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const sql = `
      SELECT c.id, c.fecha_hora_inicio, c.fecha_hora_fin, c.modalidad, c.estado,
             c.notas_estudiante, c.url_videollamada,
             u_est.nombre||' '||u_est.apellido AS estudiante_nombre,
             u_est.email AS estudiante_email, u_est.matricula,
             u_psi.nombre||' '||u_psi.apellido AS psicologo_nombre,
             m.nombre AS motivo, f.nombre AS facultad
      FROM citas c
      JOIN usuarios u_est ON u_est.id = c.estudiante_id
      JOIN usuarios u_psi ON u_psi.id = c.psicologo_id
      LEFT JOIN motivos_consulta m ON m.id = c.motivo_id
      LEFT JOIN facultades f ON f.id = u_est.facultad_id
      ${whereClause}
      ORDER BY c.fecha_hora_inicio DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const result = await db.query(sql, params);
    res.json({ data: result.rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// ── Crear cita ──────────────────────────────────────────────
router.post('/',
  authenticate,
  requireRole('estudiante', 'admin'),
  [
    body('psicologo_id').isUUID(),
    body('fecha_hora_inicio').isISO8601(),
    body('modalidad').isIn(['presencial','virtual']),
    body('motivo_id').optional().isInt(),
    body('notas_estudiante').optional().trim().isLength({ max: 1000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { psicologo_id, fecha_hora_inicio, modalidad, motivo_id, notas_estudiante } = req.body;
    const estudiante_id = req.user.id;

    try {
      const inicio = new Date(fecha_hora_inicio);
      const fin    = new Date(inicio.getTime() + 50 * 60 * 1000); // 50 minutos

      // Verificar conflicto
      const conflicto = await db.query(
        `SELECT id FROM citas
         WHERE psicologo_id = $1
           AND estado NOT IN ('cancelada_estudiante','cancelada_psicologo','no_presentado')
           AND tstzrange(fecha_hora_inicio, fecha_hora_fin) && tstzrange($2::timestamptz, $3::timestamptz)`,
        [psicologo_id, inicio, fin]
      );
      if (conflicto.rows.length) return res.status(409).json({ error: 'El horario seleccionado no esta disponible' });

      const result = await db.query(
        `INSERT INTO citas (estudiante_id, psicologo_id, motivo_id, fecha_hora_inicio,
           fecha_hora_fin, modalidad, notas_estudiante)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [estudiante_id, psicologo_id, motivo_id || null, inicio, fin, modalidad, notas_estudiante || null]
      );

      // Notificacion
      await db.query(
        `INSERT INTO notificaciones (usuario_id, cita_id, tipo, mensaje)
         VALUES ($1,$2,'confirmacion',$3)`,
        [estudiante_id, result.rows[0].id, `Tu cita ha sido agendada para el ${inicio.toLocaleString('es-MX')}`]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al crear cita' });
    }
  }
);

// ── Detalle cita ────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u_est.nombre||' '||u_est.apellido AS estudiante_nombre,
              u_est.email AS estudiante_email, u_est.matricula,
              u_psi.nombre||' '||u_psi.apellido AS psicologo_nombre,
              m.nombre AS motivo, f.nombre AS facultad
       FROM citas c
       JOIN usuarios u_est ON u_est.id = c.estudiante_id
       JOIN usuarios u_psi ON u_psi.id = c.psicologo_id
       LEFT JOIN motivos_consulta m ON m.id = c.motivo_id
       LEFT JOIN facultades f ON f.id = u_est.facultad_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Cita no encontrada' });
    const cita = result.rows[0];

    const roleMap = { 1: 'estudiante', 2: 'psicologo', 3: 'admin' };
    const rol = roleMap[req.user.rol_id];
    if (rol === 'estudiante' && cita.estudiante_id !== req.user.id)
      return res.status(403).json({ error: 'Sin acceso a esta cita' });
    if (rol === 'psicologo' && cita.psicologo_id !== req.user.id)
      return res.status(403).json({ error: 'Sin acceso a esta cita' });

    // Ocultar notas privadas a estudiantes
    if (rol === 'estudiante') delete cita.notas_psicologo;

    res.json(cita);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener cita' });
  }
});

// ── Actualizar estado ───────────────────────────────────────
router.patch('/:id/estado', authenticate, async (req, res) => {
  const { estado, cancelacion_motivo, notas_psicologo, url_videollamada } = req.body;
  const roleMap = { 1: 'estudiante', 2: 'psicologo', 3: 'admin' };
  const rol = roleMap[req.user.rol_id];

  const estadosPermitidos = {
    estudiante: ['cancelada_estudiante'],
    psicologo:  ['confirmada','en_curso','completada','cancelada_psicologo','no_presentado'],
    admin:      ['pendiente','confirmada','en_curso','completada','cancelada_estudiante','cancelada_psicologo','no_presentado'],
  };

  if (!estadosPermitidos[rol].includes(estado))
    return res.status(403).json({ error: 'Estado no permitido para tu rol' });

  try {
    const fields  = ['estado = $1'];
    const params  = [estado];
    let idx = 2;

    if (cancelacion_motivo) { fields.push(`cancelacion_motivo = $${idx++}`); params.push(cancelacion_motivo); }
    if (notas_psicologo && rol !== 'estudiante') { fields.push(`notas_psicologo = $${idx++}`); params.push(notas_psicologo); }
    if (url_videollamada)  { fields.push(`url_videollamada = $${idx++}`);  params.push(url_videollamada); }

    params.push(req.params.id);
    const result = await db.query(
      `UPDATE citas SET ${fields.join(',')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Cita no encontrada' });
    const cita = result.rows[0];

    // Auto-crear encuesta post-sesión cuando se completa
    if (estado === 'completada') {
      try {
        await db.query(
          `INSERT INTO encuestas_sesion (cita_id, estudiante_id)
           VALUES ($1, $2) ON CONFLICT (cita_id) DO NOTHING`,
          [cita.id, cita.estudiante_id]
        );
      } catch(encErr) { console.error('encuesta err:', encErr.message); }
    }

    res.json(cita);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

module.exports = router;
