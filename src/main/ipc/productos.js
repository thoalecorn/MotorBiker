const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerProductosHandlers() {
  ipcMain.handle('productos:listar', () => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM productos
      WHERE activo = 1
      ORDER BY nombre ASC
    `).all();
  });

  ipcMain.handle('productos:stock-bajo', () => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM productos
      WHERE activo = 1 AND stock <= stock_minimo
      ORDER BY stock ASC
    `).all();
  });

  ipcMain.handle('productos:crear', (_, data) => {
    const db = getDB();

    const resultado = db.prepare(`
      INSERT INTO productos
        (nombre, referencia, precio_venta, precio_costo, stock, stock_minimo, categoria)
      VALUES
        (@nombre, @referencia, @precio_venta, @precio_costo, @stock, @stock_minimo, @categoria)
    `).run(data);

    return db.prepare(`
      SELECT * FROM productos WHERE id = ?
    `).get(resultado.lastInsertRowid);
  });

  ipcMain.handle('productos:actualizar', (_, id, data) => {
    const db = getDB();

    db.prepare(`
      UPDATE productos SET
        nombre = @nombre,
        referencia = @referencia,
        precio_venta = @precio_venta,
        precio_costo = @precio_costo,
        stock_minimo = @stock_minimo,
        categoria = @categoria
      WHERE id = @id
    `).run({ ...data, id });

    return db.prepare(`
      SELECT * FROM productos WHERE id = ?
    `).get(id);
  });

  ipcMain.handle('productos:ajustar-stock', (_, id, cantidad, motivo) => {
    const db = getDB();

    const producto = db.prepare(`
      SELECT * FROM productos WHERE id = ?
    `).get(id);

    if (!producto) throw new Error('Producto no encontrado');

    const nuevoStock = producto.stock + cantidad;
    if (nuevoStock < 0) throw new Error('El stock no puede quedar negativo');

    db.prepare(`
      UPDATE productos SET stock = ? WHERE id = ?
    `).run(nuevoStock, id);

    return db.prepare(`
      SELECT * FROM productos WHERE id = ?
    `).get(id);
  });

  ipcMain.handle('productos:eliminar', (_, id) => {
    const db = getDB();

    db.prepare(`
      UPDATE productos SET activo = 0 WHERE id = ?
    `).run(id);

    return { ok: true };
  });

}

module.exports = { registerProductosHandlers };