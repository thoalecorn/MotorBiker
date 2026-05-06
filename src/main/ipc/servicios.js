const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerServiciosHandlers() {

  ipcMain.handle('servicios:listar', () => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM servicios
      WHERE activo = 1
      ORDER BY nombre ASC
    `).all();
  });

  ipcMain.handle('servicios:crear', (_, data) => {
    const db = getDB();

    const resultado = db.prepare(`
      INSERT INTO servicios (nombre, precio, descripcion)
      VALUES (@nombre, @precio, @descripcion)
    `).run(data);

    return db.prepare(`
      SELECT * FROM servicios WHERE id = ?
    `).get(resultado.lastInsertRowid);
  });
  ipcMain.handle('servicios:actualizar', (_, id, data) => {
    const db = getDB();

    db.prepare(`
      UPDATE servicios SET
        nombre = @nombre,
        precio = @precio,
        descripcion = @descripcion
      WHERE id = @id
    `).run({ ...data, id });

    return db.prepare(`
      SELECT * FROM servicios WHERE id = ?
    `).get(id);
  });

  ipcMain.handle('servicios:eliminar', (_, id) => {
    const db = getDB();

    db.prepare(`
      UPDATE servicios SET activo = 0 WHERE id = ?
    `).run(id);

    return { ok: true };
  });

}

module.exports = { registerServiciosHandlers };