const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerGastosHandlers() {

  ipcMain.handle('gastos:listar', (_, cajaId) => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM gastos
      WHERE caja_id = ?
      ORDER BY created_at DESC
    `).all(cajaId);
  });

  ipcMain.handle('gastos:crear', (_, data) => {
    const db = getDB();

    if (!data.caja_id) throw new Error('No hay caja abierta');
    if (!data.monto || data.monto <= 0) throw new Error('El monto debe ser mayor a 0');

    const resultado = db.prepare(`
      INSERT INTO gastos (descripcion, monto, categoria, caja_id)
      VALUES (@descripcion, @monto, @categoria, @caja_id)
    `).run(data);

    return db.prepare(`
      SELECT * FROM gastos WHERE id = ?
    `).get(resultado.lastInsertRowid);
  });

  ipcMain.handle('gastos:eliminar', (_, id) => {
    const db = getDB();

    const gasto = db.prepare(`
      SELECT g.*, c.estado AS caja_estado
      FROM gastos g
      JOIN cierres_caja c ON c.id = g.caja_id
      WHERE g.id = ?
    `).get(id);

    if (!gasto) throw new Error('Gasto no encontrado');
    if (gasto.caja_estado === 'cerrado') {
      throw new Error('No se puede eliminar un gasto de una caja ya cerrada');
    }

    db.prepare(`DELETE FROM gastos WHERE id = ?`).run(id);

    return { ok: true };
  });

}

module.exports = { registerGastosHandlers };