const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// ══════════════════════════════════════════════
//  DIARIO DE BIENESTAR
// ══════════════════════════════════════════════

// GET /paciente/diario — historial del estudiante
router.get('/diario', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM diario_bienestar
       WHERE usuario_id = $1
       ORDER BY fecha DESC
       LIMIT 90`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /paciente/diario — crear/actualizar entrada del día
router.post('/diario', authenticate, requireRole('estudiante'), async (req, res) => {
  const { estado_animo, emociones, nota, fecha } = req.body;
  if (!estado_animo || estado_animo < 1 || estado_animo > 10)
    return res.status(400).json({ error: 'Estado de ánimo debe ser entre 1 y 10' });
  try {
    const r = await db.query(
      `INSERT INTO diario_bienestar (usuario_id, fecha, estado_animo, emociones, nota)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id, fecha) DO UPDATE
         SET estado_animo=$3, emociones=$4, nota=$5, creado_en=NOW()
       RETURNING *`,
      [req.user.id, fecha || new Date().toISOString().slice(0,10), estado_animo, emociones||[], nota||'']
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
//  BIBLIOTECA DE RECURSOS
// ══════════════════════════════════════════════

// GET /paciente/recursos — recursos asignados al estudiante
router.get('/recursos', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT rc.*, res.titulo, res.descripcion, res.tipo, res.url, res.contenido,
              u.nombre||' '||u.apellido AS psicologo_nombre
       FROM recursos_asignados rc
       JOIN recursos res ON res.id = rc.recurso_id
       JOIN usuarios u   ON u.id  = rc.psicologo_id
       WHERE rc.estudiante_id = $1
       ORDER BY rc.creado_en DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /paciente/recursos/:id/visto
router.patch('/recursos/:id/visto', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    await db.query(
      `UPDATE recursos_asignados SET visto=TRUE, visto_en=NOW()
       WHERE id=$1 AND estudiante_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /paciente/recursos — psicólogo crea recurso
router.post('/recursos', authenticate, requireRole('psicologo'), async (req, res) => {
  const { titulo, descripcion, tipo, url, contenido, publico } = req.body;
  if (!titulo) return res.status(400).json({ error: 'Título requerido' });
  try {
    const r = await db.query(
      `INSERT INTO recursos (psicologo_id, titulo, descripcion, tipo, url, contenido, publico)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, titulo, descripcion||'', tipo||'articulo', url||'', contenido||'', publico||false]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /paciente/recursos/biblioteca — psicólogo lista sus recursos
router.get('/recursos/biblioteca', authenticate, requireRole('psicologo'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM recursos WHERE psicologo_id=$1 ORDER BY creado_en DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /paciente/recursos/asignar — psicólogo asigna recurso a paciente
router.post('/recursos/asignar', authenticate, requireRole('psicologo'), async (req, res) => {
  const { recurso_id, estudiante_id } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO recursos_asignados (recurso_id, estudiante_id, psicologo_id)
       VALUES ($1,$2,$3)
       ON CONFLICT (recurso_id, estudiante_id) DO NOTHING
       RETURNING *`,
      [recurso_id, estudiante_id, req.user.id]
    );
    res.json(r.rows[0] || { ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /paciente/recursos/:id — psicólogo elimina recurso
router.delete('/recursos/:id', authenticate, requireRole('psicologo'), async (req, res) => {
  try {
    await db.query(`DELETE FROM recursos WHERE id=$1 AND psicologo_id=$2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
//  ENCUESTAS POST-SESIÓN
// ══════════════════════════════════════════════

// GET /paciente/encuestas/pendientes
router.get('/encuestas/pendientes', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT e.*, c.fecha_hora_inicio, c.motivo_id,
              u.nombre||' '||u.apellido AS psicologo_nombre,
              m.nombre AS motivo
       FROM encuestas_sesion e
       JOIN citas c ON c.id = e.cita_id
       JOIN usuarios u ON u.id = c.psicologo_id
       LEFT JOIN motivos_consulta m ON m.id = c.motivo_id
       WHERE e.estudiante_id=$1 AND e.respondida=FALSE
       ORDER BY e.creado_en DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /paciente/encuestas/:id/responder
router.post('/encuestas/:id/responder', authenticate, requireRole('estudiante'), async (req, res) => {
  const { utilidad, bienestar_antes, bienestar_despues, comentario } = req.body;
  try {
    const r = await db.query(
      `UPDATE encuestas_sesion
       SET utilidad=$1, bienestar_antes=$2, bienestar_despues=$3,
           comentario=$4, respondida=TRUE
       WHERE id=$5 AND estudiante_id=$6
       RETURNING *`,
      [utilidad, bienestar_antes, bienestar_despues, comentario||'', req.params.id, req.user.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// ══════════════════════════════════════════════
//  CUADERNOS PERSONALES
// ══════════════════════════════════════════════

// GET /paciente/cuadernos
router.get('/cuadernos', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    // Auto-crear cuaderno principal si no existe
    const exists = await db.query(
      `SELECT id FROM cuadernos WHERE usuario_id=$1 AND es_principal=TRUE`, [req.user.id]
    );
    if (!exists.rows.length) {
      await db.query(
        `INSERT INTO cuadernos (usuario_id, nombre, icono, color, papel, es_principal, orden)
         VALUES ($1, 'Mi diario de bienestar', '📓', 'sage', 'lined', TRUE, 0)`,
        [req.user.id]
      );
    }
    const r = await db.query(
      `SELECT * FROM cuadernos WHERE usuario_id=$1 ORDER BY orden, creado_en`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /paciente/cuadernos
router.post('/cuadernos', authenticate, requireRole('estudiante'), async (req, res) => {
  const { nombre, icono, color, papel } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO cuadernos (usuario_id, nombre, icono, color, papel, es_principal)
       VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *`,
      [req.user.id, nombre||'Nuevo cuaderno', icono||'📓', color||'sage', papel||'lined']
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /paciente/cuadernos/:id
router.patch('/cuadernos/:id', authenticate, requireRole('estudiante'), async (req, res) => {
  const { nombre, icono, color, papel, orden } = req.body;
  try {
    const r = await db.query(
      `UPDATE cuadernos
       SET nombre=COALESCE($1,nombre), icono=COALESCE($2,icono),
           color=COALESCE($3,color), papel=COALESCE($4,papel),
           orden=COALESCE($5,orden)
       WHERE id=$6 AND usuario_id=$7 RETURNING *`,
      [nombre, icono, color, papel, orden, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Cuaderno no encontrado' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /paciente/cuadernos/:id  (no se puede borrar el principal)
router.delete('/cuadernos/:id', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    const r = await db.query(
      `DELETE FROM cuadernos WHERE id=$1 AND usuario_id=$2 AND es_principal=FALSE RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'No se puede eliminar el cuaderno principal' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /paciente/cuadernos/:id/entradas
router.get('/cuadernos/:id/entradas', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM cuaderno_entradas
       WHERE cuaderno_id=$1 AND usuario_id=$2
       ORDER BY fecha DESC, actualizado_en DESC`,
      [req.params.id, req.user.id]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /paciente/cuadernos/:id/entradas
router.post('/cuadernos/:id/entradas', authenticate, requireRole('estudiante'), async (req, res) => {
  const { titulo, contenido, fecha, imagenes } = req.body;
  try {
    const r = await db.query(
      `INSERT INTO cuaderno_entradas (cuaderno_id, usuario_id, titulo, contenido, fecha, imagenes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, req.user.id, titulo||'', contenido||'',
       fecha||new Date().toISOString().slice(0,10),
       JSON.stringify(imagenes||[])]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /paciente/cuadernos/:id/entradas/:eid
router.patch('/cuadernos/:id/entradas/:eid', authenticate, requireRole('estudiante'), async (req, res) => {
  const { titulo, contenido, imagenes } = req.body;
  try {
    const r = await db.query(
      `UPDATE cuaderno_entradas
       SET titulo=COALESCE($1,titulo), contenido=COALESCE($2,contenido),
           imagenes=COALESCE($3,imagenes), actualizado_en=NOW()
       WHERE id=$4 AND cuaderno_id=$5 AND usuario_id=$6 RETURNING *`,
      [titulo, contenido,
       imagenes !== undefined ? JSON.stringify(imagenes) : null,
       req.params.eid, req.params.id, req.user.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /paciente/cuadernos/:id/entradas/:eid
router.delete('/cuadernos/:id/entradas/:eid', authenticate, requireRole('estudiante'), async (req, res) => {
  try {
    await db.query(
      `DELETE FROM cuaderno_entradas WHERE id=$1 AND cuaderno_id=$2 AND usuario_id=$3`,
      [req.params.eid, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
