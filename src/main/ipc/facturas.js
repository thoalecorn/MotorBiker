const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerFacturasHandlers() {

  ipcMain.handle('facturas:listar', (_, filtros = {}) => {
    const db = getDB();

    const condiciones = ['1=1'];
    const params = {};

    if (filtros.estado) {
      condiciones.push('estado = @estado');
      params.estado = filtros.estado;
    }

    return db.prepare(`
      SELECT *,
        CAST(
          julianday(fecha_vencimiento) - julianday(date('now', 'localtime'))
        AS INTEGER) AS dias_para_vencer
      FROM facturas_proveedor
      WHERE ${condiciones.join(' AND ')}
      ORDER BY fecha_vencimiento ASC
    `).all(params);
  });

  ipcMain.handle('facturas:crear', (_, data) => {
    const db = getDB();

    if (!data.monto || data.monto <= 0) throw new Error('El monto debe ser mayor a 0');
    if (!data.fecha_vencimiento) throw new Error('La fecha de vencimiento es obligatoria');

    const resultado = db.prepare(`
      INSERT INTO facturas_proveedor
        (proveedor, descripcion, monto, fecha_emision, fecha_vencimiento)
      VALUES
        (@proveedor, @descripcion, @monto, @fecha_emision, @fecha_vencimiento)
    `).run(data);

    return db.prepare(`
      SELECT * FROM facturas_proveedor WHERE id = ?
    `).get(resultado.lastInsertRowid);
  });

  ipcMain.handle('facturas:marcar-pagada', (_, id) => {
    const db = getDB();

    const factura = db.prepare(`
      SELECT * FROM facturas_proveedor WHERE id = ?
    `).get(id);

    if (!factura) throw new Error('Factura no encontrada');
    if (factura.estado === 'pagada') throw new Error('Esta factura ya fue pagada');

    db.prepare(`
      UPDATE facturas_proveedor SET estado = 'pagada' WHERE id = ?
    `).run(id);

    return db.prepare(`
      SELECT * FROM facturas_proveedor WHERE id = ?
    `).get(id);
  });
  ipcMain.handle('facturas:eliminar', (_, id) => {
    const db = getDB();

    const factura = db.prepare(`
      SELECT * FROM facturas_proveedor WHERE id = ?
    `).get(id);

    if (!factura) throw new Error('Factura no encontrada');
    if (factura.estado === 'pagada') {
      throw new Error('No se puede eliminar una factura ya pagada');
    }

    db.prepare(`DELETE FROM facturas_proveedor WHERE id = ?`).run(id);

    return { ok: true };
  });

}

module.exports = { registerFacturasHandlers };