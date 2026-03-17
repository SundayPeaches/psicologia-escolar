const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Multer config ──────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf','.doc','.docx','.jpg','.jpeg','.png','.txt','.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// ── Listar pacientes del psicologo ────────────────────────
router.get('/pacientes', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  try {
    const psico_id = req.user.id;
    const result = await db.query(`
      SELECT DISTINCT
        u.id, u.nombre, u.apellido, u.email, u.matricula,
        u.foto_url, u.color_perfil, u.emoji_perfil, u.bio_personal,
        f.nombre AS facultad,
        e.id AS expediente_id,
        e.titulo AS expediente_titulo,
        e.actualizado_en AS ultima_actualizacion,
        COUNT(c.id) FILTER (WHERE c.estado NOT IN ('cancelada_estudiante','cancelada_psicologo')) AS total_citas,
        COUNT(c.id) FILTER (WHERE c.estado = 'completada') AS citas_completadas,
        MAX(c.fecha_hora_inicio) FILTER (WHERE c.estado = 'completada') AS ultima_cita
      FROM citas c
      JOIN usuarios u ON u.id = c.estudiante_id
      LEFT JOIN facultades f ON f.id = u.facultad_id
      LEFT JOIN expedientes e ON e.estudiante_id = u.id AND e.psicologo_id = $1
      WHERE c.psicologo_id = $1
      GROUP BY u.id, u.nombre, u.apellido, u.email, u.matricula,
               u.foto_url, u.color_perfil, u.emoji_perfil, u.bio_personal,
               f.nombre, e.id, e.titulo, e.actualizado_en
      ORDER BY u.apellido
    `, [psico_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
});

// ── Listar resultados de tests ────────────────────────────
router.get('/:expediente_id/tests', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM resultados_tests
       WHERE expediente_id = $1
       ORDER BY fecha_aplicacion DESC, creado_en DESC`,
      [req.params.expediente_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resultados' });
  }
});

// ── Crear resultado de test ───────────────────────────────
router.post('/:expediente_id/tests', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  const { nombre_test, fecha_aplicacion, puntuacion_raw, puntuacion_std, percentil, interpretacion, observaciones } = req.body;
  if (!nombre_test) return res.status(422).json({ error: 'El nombre del test es requerido' });
  try {
    const result = await db.query(
      `INSERT INTO resultados_tests
         (expediente_id, psicologo_id, nombre_test, fecha_aplicacion, puntuacion_raw, puntuacion_std, percentil, interpretacion, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.expediente_id, req.user.id, nombre_test,
       fecha_aplicacion || null, puntuacion_raw || null, puntuacion_std || null,
       percentil || null, interpretacion || null, observaciones || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar resultado' });
  }
});

// ── Eliminar resultado de test ────────────────────────────
router.delete('/tests/:test_id', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  try {
    await db.query(
      'DELETE FROM resultados_tests WHERE id = $1 AND psicologo_id = $2',
      [req.params.test_id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar resultado' });
  }
});

// ── Obtener o crear expediente ────────────────────────────
router.get('/:estudiante_id', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  try {
    const { estudiante_id } = req.params;
    const psicologo_id = req.user.id;

    let exp = await db.query(
      `SELECT e.*, u.nombre||' '||u.apellido AS estudiante_nombre,
              u.email AS estudiante_email, u.matricula, f.nombre AS facultad,
              u.foto_url, u.color_perfil, u.emoji_perfil, u.bio_personal
       FROM expedientes e
       JOIN usuarios u ON u.id = e.estudiante_id
       LEFT JOIN facultades f ON f.id = u.facultad_id
       WHERE e.estudiante_id = $1 AND e.psicologo_id = $2`,
      [estudiante_id, psicologo_id]
    );

    if (!exp.rows.length) {
      // Crear expediente vacío automáticamente
      const nuevo = await db.query(
        `INSERT INTO expedientes (estudiante_id, psicologo_id)
         VALUES ($1, $2) RETURNING *`,
        [estudiante_id, psicologo_id]
      );
      const estudiante = await db.query(
        `SELECT u.nombre||' '||u.apellido AS estudiante_nombre,
                u.email AS estudiante_email, u.matricula, f.nombre AS facultad
         FROM usuarios u LEFT JOIN facultades f ON f.id = u.facultad_id
         WHERE u.id = $1`, [estudiante_id]
      );
      exp = { rows: [{ ...nuevo.rows[0], ...estudiante.rows[0] }] };
    }

    // Archivos
    const archivos = await db.query(
      `SELECT id, nombre_original, tipo_mime, tamano_bytes, descripcion, subido_en
       FROM archivos_expediente WHERE expediente_id = $1 ORDER BY subido_en DESC`,
      [exp.rows[0].id]
    );

    // Notas de sesión
    const notas = await db.query(
      `SELECT ns.*, c.fecha_hora_inicio
       FROM notas_sesion ns
       JOIN citas c ON c.id = ns.cita_id
       WHERE ns.expediente_id = $1
       ORDER BY c.fecha_hora_inicio DESC`,
      [exp.rows[0].id]
    );

    // Citas del paciente con este psicólogo
    const citas = await db.query(
      `SELECT c.id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado, c.modalidad,
              m.nombre AS motivo,
              ns.id AS nota_id
       FROM citas c
       LEFT JOIN motivos_consulta m ON m.id = c.motivo_id
       LEFT JOIN notas_sesion ns ON ns.cita_id = c.id
       WHERE c.psicologo_id = $1 AND c.estudiante_id = $2
       ORDER BY c.fecha_hora_inicio DESC`,
      [psicologo_id, estudiante_id]
    );

    res.json({ expediente: exp.rows[0], archivos: archivos.rows, notas: notas.rows, citas: citas.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener expediente' });
  }
});

// ── Actualizar expediente ─────────────────────────────────
router.patch('/:estudiante_id', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  const { titulo, resumen, diagnostico, objetivos, observaciones } = req.body;
  try {
    const result = await db.query(
      `UPDATE expedientes SET titulo=$1, resumen=$2, diagnostico=$3, objetivos=$4, observaciones=$5
       WHERE estudiante_id=$6 AND psicologo_id=$7 RETURNING *`,
      [titulo, resumen, diagnostico, objetivos, observaciones, req.params.estudiante_id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar expediente' });
  }
});

// ── Subir archivo ─────────────────────────────────────────
router.post('/:expediente_id/archivos', authenticate, requireRole('psicologo','admin'),
  upload.single('archivo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Archivo no recibido o tipo no permitido' });
    try {
      const result = await db.query(
        `INSERT INTO archivos_expediente (expediente_id, nombre_original, nombre_guardado, tipo_mime, tamano_bytes, descripcion)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.expediente_id, req.file.originalname, req.file.filename,
         req.file.mimetype, req.file.size, req.body.descripcion || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error al guardar archivo' });
    }
  }
);

// ── Descargar archivo ─────────────────────────────────────
router.get('/archivos/:archivo_id/download', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM archivos_expediente WHERE id = $1', [req.params.archivo_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Archivo no encontrado' });
    const archivo = result.rows[0];
    const filePath = path.join(uploadDir, archivo.nombre_guardado);
    res.download(filePath, archivo.nombre_original);
  } catch (err) {
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
});

// ── Eliminar archivo ──────────────────────────────────────
router.delete('/archivos/:archivo_id', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM archivos_expediente WHERE id=$1', [req.params.archivo_id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Archivo no encontrado' });
    fs.unlink(path.join(uploadDir, result.rows[0].nombre_guardado), () => {});
    await db.query('DELETE FROM archivos_expediente WHERE id=$1', [req.params.archivo_id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar archivo' });
  }
});

// ── Guardar nota de sesión ────────────────────────────────
router.post('/notas', authenticate, requireRole('psicologo','admin'), async (req, res) => {
  const { cita_id, expediente_id, contenido, humor_paciente, avance, proximos_pasos } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO notas_sesion (cita_id, expediente_id, contenido, humor_paciente, avance, proximos_pasos)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (cita_id) DO UPDATE SET
         contenido=$3, humor_paciente=$4, avance=$5, proximos_pasos=$6
       RETURNING *`,
      [cita_id, expediente_id || null, contenido, humor_paciente || null, avance || null, proximos_pasos || null]
    );
    // Marcar cita como completada si no lo está
    await db.query(
      `UPDATE citas SET estado='completada' WHERE id=$1 AND estado NOT IN ('completada','cancelada_estudiante','cancelada_psicologo')`,
      [cita_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar nota' });
  }
});

module.exports = router;
