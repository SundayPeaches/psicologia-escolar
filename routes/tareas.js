const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ════════════════════════════════════════
//  TAREAS
// ════════════════════════════════════════

// Crear tarea (psicologo)
router.post('/', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  const { estudiante_id, expediente_id, titulo, descripcion, instrucciones, fecha_limite } = req.body;
  if (!estudiante_id || !titulo || !descripcion) return res.status(422).json({ error: 'Campos requeridos: estudiante_id, titulo, descripcion' });
  try {
    const result = await db.query(
      `INSERT INTO tareas (estudiante_id, psicologo_id, expediente_id, titulo, descripcion, instrucciones, fecha_limite)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [estudiante_id, req.user.id, expediente_id||null, titulo, descripcion, instrucciones||null, fecha_limite||null]
    );
    // Notificar al estudiante
    await db.query(
      `INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES ($1,'tarea',$2)`,
      [estudiante_id, `Tu psicologa te ha asignado una nueva tarea: "${titulo}"`]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

// Listar tareas (psicologo ve las que asignó; estudiante las suyas)
router.get('/', authenticate, async (req, res) => {
  const rolMap = { 1:'estudiante', 2:'psicologo', 3:'admin' };
  const rol = rolMap[req.user.rol_id];
  try {
    let sql, params;
    if (rol === 'estudiante') {
      sql = `SELECT t.*, u.nombre||' '||u.apellido AS psicologo_nombre,
                    (SELECT COUNT(*) FROM retroalimentacion r WHERE r.tarea_id = t.id) AS tiene_retro
             FROM tareas t JOIN usuarios u ON u.id = t.psicologo_id
             WHERE t.estudiante_id = $1 ORDER BY t.creado_en DESC`;
      params = [req.user.id];
    } else {
      const { estudiante_id } = req.query;
      sql = `SELECT t.*, u.nombre||' '||u.apellido AS estudiante_nombre, u.matricula
             FROM tareas t JOIN usuarios u ON u.id = t.estudiante_id
             WHERE t.psicologo_id = $1 ${estudiante_id ? 'AND t.estudiante_id = $2' : ''}
             ORDER BY t.creado_en DESC`;
      params = estudiante_id ? [req.user.id, estudiante_id] : [req.user.id];
    }
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
});

// Detalle tarea
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u_est.nombre||' '||u_est.apellido AS estudiante_nombre,
              u_psi.nombre||' '||u_psi.apellido AS psicologo_nombre
       FROM tareas t
       JOIN usuarios u_est ON u_est.id = t.estudiante_id
       JOIN usuarios u_psi ON u_psi.id = t.psicologo_id
       WHERE t.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tarea' });
  }
});

// Actualizar tarea (psicologo edita; estudiante entrega respuesta)
router.patch('/:id', authenticate, async (req, res) => {
  const rolMap = { 1:'estudiante', 2:'psicologo', 3:'admin' };
  const rol = rolMap[req.user.rol_id];
  try {
    let result;
    if (rol === 'estudiante') {
      const { respuesta_alumno } = req.body;
      result = await db.query(
        `UPDATE tareas SET respuesta_alumno=$1, estado='en_proceso'
         WHERE id=$2 AND estudiante_id=$3 RETURNING *`,
        [respuesta_alumno, req.params.id, req.user.id]
      );
    } else {
      const { titulo, descripcion, instrucciones, fecha_limite, estado } = req.body;
      result = await db.query(
        `UPDATE tareas SET titulo=COALESCE($1,titulo), descripcion=COALESCE($2,descripcion),
         instrucciones=COALESCE($3,instrucciones), fecha_limite=COALESCE($4,fecha_limite),
         estado=COALESCE($5,estado)
         WHERE id=$6 AND psicologo_id=$7 RETURNING *`,
        [titulo, descripcion, instrucciones, fecha_limite, estado, req.params.id, req.user.id]
      );
    }
    if (!result.rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

// ════════════════════════════════════════
//  RETROALIMENTACION
// ════════════════════════════════════════

// Crear retroalimentación
router.post('/retro', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  const { estudiante_id, tarea_id, titulo, contenido, tipo } = req.body;
  if (!estudiante_id || !contenido) return res.status(422).json({ error: 'estudiante_id y contenido son requeridos' });
  try {
    const result = await db.query(
      `INSERT INTO retroalimentacion (estudiante_id, psicologo_id, tarea_id, titulo, contenido, tipo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [estudiante_id, req.user.id, tarea_id||null, titulo||null, contenido, tipo||'general']
    );
    // Si es de tarea, marcarla como revisada
    if (tarea_id) {
      await db.query(`UPDATE tareas SET estado='revisada' WHERE id=$1`, [tarea_id]);
    }
    // Notificar al estudiante
    await db.query(
      `INSERT INTO notificaciones (usuario_id, tipo, mensaje) VALUES ($1,'retroalimentacion',$2)`,
      [estudiante_id, `Tienes nueva retroalimentacion de tu psicologa${titulo ? `: "${titulo}"` : ''}`]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear retroalimentacion' });
  }
});

// Listar retroalimentacion
router.get('/retro/lista', authenticate, async (req, res) => {
  const rolMap = { 1:'estudiante', 2:'psicologo', 3:'admin' };
  const rol = rolMap[req.user.rol_id];
  const { estudiante_id } = req.query;
  try {
    let sql, params;
    if (rol === 'estudiante') {
      sql = `SELECT r.*, u.nombre||' '||u.apellido AS psicologo_nombre, t.titulo AS tarea_titulo
             FROM retroalimentacion r
             JOIN usuarios u ON u.id = r.psicologo_id
             LEFT JOIN tareas t ON t.id = r.tarea_id
             WHERE r.estudiante_id = $1 ORDER BY r.creado_en DESC`;
      params = [req.user.id];
    } else {
      sql = `SELECT r.*, u.nombre||' '||u.apellido AS estudiante_nombre, t.titulo AS tarea_titulo
             FROM retroalimentacion r
             JOIN usuarios u ON u.id = r.estudiante_id
             LEFT JOIN tareas t ON t.id = r.tarea_id
             WHERE r.psicologo_id = $1 ${estudiante_id ? 'AND r.estudiante_id = $2' : ''}
             ORDER BY r.creado_en DESC`;
      params = estudiante_id ? [req.user.id, estudiante_id] : [req.user.id];
    }
    const result = await db.query(sql, params);
    // Marcar como leídas para el estudiante
    if (rol === 'estudiante') {
      await db.query(`UPDATE retroalimentacion SET leida=TRUE WHERE estudiante_id=$1`, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener retroalimentacion' });
  }
});

module.exports = router;
