/**
 * SEED - Psicologo unico del sistema
 * Ejecutar: node database/seed_psicologo.js
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
    const hash = await bcrypt.hash('psico2024', 12);

    // Insertar usuario psicologo
    const result = await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id)
      VALUES ('Maria Elena', 'Vargas Ruiz', 'mvargas@universidad.edu', $1, 2)
      ON CONFLICT (email) DO UPDATE
        SET nombre = 'Maria Elena', apellido = 'Vargas Ruiz'
      RETURNING id
    `, [hash]);

    const psico_id = result.rows[0].id;

    // Insertar datos profesionales
    await client.query(`
      INSERT INTO psicologos (id, cedula_prof, especialidades, bio, max_citas_dia)
      VALUES ($1, 'PSI-2019-0347',
        ARRAY['Ansiedad y estres academico','Depresion','Orientacion vocacional','Dificultades de aprendizaje'],
        'Psicologa educativa con mas de 6 anos de experiencia acompanando a estudiantes universitarios en su desarrollo personal y academico.',
        8)
      ON CONFLICT (id) DO UPDATE
        SET especialidades = ARRAY['Ansiedad y estres academico','Depresion','Orientacion vocacional','Dificultades de aprendizaje'],
            bio = 'Psicologa educativa con mas de 6 anos de experiencia acompanando a estudiantes universitarios en su desarrollo personal y academico.'
    `, [psico_id]);

    // Horarios Lunes a Viernes 8am - 12pm (dias 1 al 5)
    for (let dia = 1; dia <= 5; dia++) {
      await client.query(`
        INSERT INTO horarios_disponibles (psicologo_id, dia_semana, hora_inicio, hora_fin, duracion_min)
        VALUES ($1, $2, '08:00', '12:00', 50)
        ON CONFLICT DO NOTHING
      `, [psico_id, dia]);
    }

    // Estudiante de prueba
    const hashEst = await bcrypt.hash('demo1234', 12);
    await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, matricula, rol_id, facultad_id)
      VALUES ('Carlos','Mendez','estudiante@demo.com', $1, '2024-0042', 1, 1)
      ON CONFLICT (email) DO NOTHING
    `, [hashEst]);

    // Admin de prueba
    await client.query(`
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_id)
      VALUES ('Admin','Sistema','admin@demo.com', $1, 3)
      ON CONFLICT (email) DO NOTHING
    `, [hashEst]);

    await client.query('COMMIT');

    console.log('\n  Usuarios creados exitosamente');
    console.log('  ─────────────────────────────────────────');
    console.log('  Psicologa:');
    console.log('    Email:      mvargas@universidad.edu');
    console.log('    Contrasena: psico2024');
    console.log('    Horario:    Lunes a Viernes 8am - 12pm');
    console.log('  ─────────────────────────────────────────');
    console.log('  Estudiante:');
    console.log('    Email:      estudiante@demo.com');
    console.log('    Contrasena: demo1234');
    console.log('  ─────────────────────────────────────────');
    console.log('  Admin:');
    console.log('    Email:      admin@demo.com');
    console.log('    Contrasena: demo1234\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
