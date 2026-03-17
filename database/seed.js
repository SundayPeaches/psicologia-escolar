/**
 * SEED - Datos iniciales de demostración
 * Ejecutar: node database/seed.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'psicologia_escolar',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash('demo1234', 12);

    // Admin
    await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id) VALUES
      ('Administrador','Sistema','admin@demo.com',$1,3)
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    // Psicologo 1
    const psi1 = await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id) VALUES
      ('Laura','Mendoza','laura.mendoza@universidad.edu',$1,2)
      ON CONFLICT (email) DO UPDATE SET nombre='Laura' RETURNING id
    `, [hash]);

    if (psi1.rows.length) {
      await client.query(`
        INSERT INTO psicologos (id, cedula_prof, especialidades, bio, max_citas_dia)
        VALUES ($1,'PSI-001',ARRAY['Ansiedad','Depresion','Orientacion vocacional'],
          'Especialista en salud mental universitaria con 8 anos de experiencia en atencion a jovenes adultos.',8)
        ON CONFLICT (id) DO NOTHING
      `, [psi1.rows[0].id]);
      // Horarios L-V
      for (let dia = 1; dia <= 5; dia++) {
        await client.query(`
          INSERT INTO horarios_disponibles (psicologo_id, dia_semana, hora_inicio, hora_fin, duracion_min)
          VALUES ($1,$2,'09:00','13:00',50)
          ON CONFLICT DO NOTHING
        `, [psi1.rows[0].id, dia]);
      }
    }

    // Psicologo 2
    const psi2 = await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id) VALUES
      ('Carlos','Reyes','carlos.reyes@universidad.edu',$1,2)
      ON CONFLICT (email) DO UPDATE SET nombre='Carlos' RETURNING id
    `, [hash]);

    if (psi2.rows.length) {
      await client.query(`
        INSERT INTO psicologos (id, cedula_prof, especialidades, bio, max_citas_dia)
        VALUES ($1,'PSI-002',ARRAY['Estres academico','Habilidades sociales','TDAH'],
          'Psicologo clinico con enfoque cognitivo-conductual, especializado en poblacion estudiantil.',6)
        ON CONFLICT (id) DO NOTHING
      `, [psi2.rows[0].id]);
      for (let dia = 1; dia <= 5; dia++) {
        await client.query(`
          INSERT INTO horarios_disponibles (psicologo_id, dia_semana, hora_inicio, hora_fin, duracion_min)
          VALUES ($1,$2,'14:00','18:00',50)
          ON CONFLICT DO NOTHING
        `, [psi2.rows[0].id, dia]);
      }
    }

    // Estudiante demo
    await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, matricula, rol_id, facultad_id)
      VALUES ('Sofia','Torres','estudiante@demo.com',$1,'2024-0001',1,1)
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    await client.query('COMMIT');
    console.log('\n  Seed completado exitosamente');
    console.log('  Usuarios de demo:');
    console.log('    admin@demo.com        / demo1234  (Administrador)');
    console.log('    laura.mendoza@...     / demo1234  (Psicologa)');
    console.log('    carlos.reyes@...      / demo1234  (Psicologo)');
    console.log('    estudiante@demo.com   / demo1234  (Estudiante)\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
