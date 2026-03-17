const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticacion requerido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      'SELECT id, nombre, apellido, email, rol_id, activo FROM usuarios WHERE id = $1',
      [decoded.id]
    );

    if (!result.rows.length || !result.rows[0].activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalido' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  const roleMap = { 1: 'estudiante', 2: 'psicologo', 3: 'admin' };
  const userRole = roleMap[req.user.rol_id];
  if (!roles.includes(userRole)) {
    return res.status(403).json({ error: 'No tienes permisos para esta accion' });
  }
  next();
};

module.exports = { authenticate, requireRole };
