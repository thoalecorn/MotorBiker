const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerClientesHandlers() {
  ipcMain.handle('clientes:listar', () => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM clientes ORDER BY nombre ASC
    `).all();
  });
  ipcMain.handle('clientes:buscar', (_, query) => {
    const db = getDB();
    return db.prepare(`
      SELECT * FROM clientes
      WHERE nombre LIKE @q OR telefono LIKE @q
      ORDER BY nombre ASC
      LIMIT 10
    `).all({ q: `%${query}%` });
  });

  ipcMain.handle('clientes:crear', (_, data) => {
    const db = getDB();

    const resultado = db.prepare(`
      INSERT INTO clientes (nombre, telefono)
      VALUES (@nombre, @telefono)
    `).run(data);

    return db.prepare(`
      SELECT * FROM clientes WHERE id = ?
    `).get(resultado.lastInsertRowid);
  });

  ipcMain.handle('clientes:historial', (_, clienteId) => {
    const db = getDB();
    return db.prepare(`
      SELECT v.*, o.descripcion AS descripcion_orden, o.tipo
      FROM ventas v
      JOIN ordenes o ON o.id = v.orden_id
      WHERE o.cliente_id = ?
      ORDER BY v.created_at DESC
    `).all(clienteId);
  });

}

module.exports = { registerClientesHandlers };