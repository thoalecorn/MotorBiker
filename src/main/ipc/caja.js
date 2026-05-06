const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerCajaHandlers() {
  ipcMain.handle('caja:abrir', () => {
    const db = getDB();

    const cajaExistente = db.prepare(`
      SELECT * FROM cierres_caja WHERE estado = 'abierto' LIMIT 1
    `).get();

    if (cajaExistente) return cajaExistente; 
    const resultado = db.prepare(`
      INSERT INTO cierres_caja (fecha, estado)
      VALUES (date('now', 'localtime'), 'abierto')
    `).run();

    return db.prepare(`
      SELECT * FROM cierres_caja WHERE id = ?
    `).get(resultado.lastInsertRowid);
  });

  ipcMain.handle('caja:actual', () => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM cierres_caja WHERE estado = 'abierto' LIMIT 1
    `).get() ?? null;
  });

  ipcMain.handle('caja:cerrar', (_, cajaId) => {
    const db = getDB();
    const caja = db.prepare(`
      SELECT * FROM cierres_caja WHERE id = ? AND estado = 'abierto'
    `).get(cajaId);

    if (!caja) throw new Error('No existe una caja abierta con ese ID');

    const { total_productos } = db.prepare(`
      SELECT COALESCE(SUM(total_productos), 0) AS total_productos
      FROM ventas WHERE caja_id = ?
    `).get(cajaId);

    const { total_mano_obra } = db.prepare(`
      SELECT COALESCE(SUM(total_mano_obra), 0) AS total_mano_obra
      FROM ventas WHERE caja_id = ?
    `).get(cajaId);

    const { total_gastos } = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) AS total_gastos
      FROM gastos WHERE caja_id = ?
    `).get(cajaId);

    const comision_mecanico = total_mano_obra * 0.60;
    const balance_neto = (total_productos + total_mano_obra * 0.40) - total_gastos;

    db.prepare(`
      UPDATE cierres_caja SET
        estado = 'cerrado',
        total_ventas_productos = ?,
        total_mano_obra = ?,
        total_gastos = ?,
        comision_mecanico = ?,
        balance_neto = ?,
        closed_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      total_productos,
      total_mano_obra,
      total_gastos,
      comision_mecanico,
      balance_neto,
      cajaId
    );

    return db.prepare(`
      SELECT * FROM cierres_caja WHERE id = ?
    `).get(cajaId);
  });
}

module.exports = { registerCajaHandlers };