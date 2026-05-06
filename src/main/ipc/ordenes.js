const { ipcMain } = require('electron');
const { getDB } = require('../database');

function registerOrdenesHandlers() {

  ipcMain.handle('ordenes:listar', (_, filtros = {}) => {
    const db = getDB();

    const condiciones = ['1=1']; 
    const params = {};

    if (filtros.estado) {
      condiciones.push('o.estado = @estado');
      params.estado = filtros.estado;
    }
    if (filtros.tipo) {
      condiciones.push('o.tipo = @tipo');
      params.tipo = filtros.tipo;
    }
    if (filtros.caja_id) {
      condiciones.push('o.caja_id = @caja_id');
      params.caja_id = filtros.caja_id;
    }

    const ordenes = db.prepare(`
      SELECT o.*
      FROM ordenes o
      WHERE ${condiciones.join(' AND ')}
      ORDER BY o.created_at DESC
    `).all(params);

    const getItems = db.prepare(`
      SELECT * FROM orden_items WHERE orden_id = ?
    `);

    return ordenes.map(orden => ({
      ...orden,
      items: getItems.all(orden.id)
    }));
  });

  ipcMain.handle('ordenes:crear', (_, data) => {
    const db = getDB();

    if (!data.items || data.items.length === 0) {
      throw new Error('La orden debe tener al menos un ítem');
    }
    if (!data.caja_id) {
      throw new Error('No hay caja abierta. Abre la caja antes de crear una orden');
    }
    let total_productos = 0;
    let total_mano_obra = 0;

    for (const item of data.items) {
      item.subtotal = item.precio_unitario * item.cantidad;
      if (item.tipo_item === 'producto') total_productos += item.subtotal;
      if (item.tipo_item === 'servicio') total_mano_obra += item.subtotal;
    }

    const total = total_productos + total_mano_obra;
    const crearOrden = db.transaction(() => {
      const resultado = db.prepare(`
        INSERT INTO ordenes
          (cliente_id, cliente_nombre, descripcion, tipo, estado,
           total_productos, total_mano_obra, total, caja_id)
        VALUES
          (@cliente_id, @cliente_nombre, @descripcion, @tipo, 'pendiente',
           @total_productos, @total_mano_obra, @total, @caja_id)
      `).run({
        cliente_id: data.cliente_id ?? null,
        cliente_nombre: data.cliente_nombre,
        descripcion: data.descripcion ?? null,
        tipo: data.tipo ?? 'directa',
        total_productos,
        total_mano_obra,
        total,
        caja_id: data.caja_id,
      });

      const ordenId = resultado.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO orden_items
          (orden_id, tipo_item, referencia_id, nombre, precio_unitario, cantidad, subtotal)
        VALUES
          (@orden_id, @tipo_item, @referencia_id, @nombre, @precio_unitario, @cantidad, @subtotal)
      `);

      for (const item of data.items) {
        insertItem.run({
          orden_id: ordenId,
          tipo_item: item.tipo_item,
          referencia_id: item.referencia_id ?? null,
          nombre: item.nombre,
          precio_unitario: item.precio_unitario,
          cantidad: item.cantidad,
          subtotal: item.subtotal,
        });
      }

      return ordenId;
    });

    const ordenId = crearOrden(); 

    return db.prepare(`SELECT * FROM ordenes WHERE id = ?`).get(ordenId);
  });

  ipcMain.handle('ordenes:actualizar', (_, id, data) => {
    const db = getDB();

    const estadosValidos = ['pendiente', 'en_proceso', 'terminado', 'cancelado'];
    if (data.estado && !estadosValidos.includes(data.estado)) {
      throw new Error(`Estado inválido: ${data.estado}`);
    }

    db.prepare(`
      UPDATE ordenes SET
        estado = COALESCE(@estado, estado),
        descripcion = COALESCE(@descripcion, descripcion),
        updated_at = datetime('now', 'localtime')
      WHERE id = @id
    `).run({
      estado: data.estado ?? null,
      descripcion: data.descripcion ?? null,
      id,
    });

    return db.prepare(`SELECT * FROM ordenes WHERE id = ?`).get(id);
  });

  ipcMain.handle('ordenes:pagar', (_, ordenId, data) => {
    const db = getDB();

    const orden = db.prepare(`
      SELECT * FROM ordenes WHERE id = ?
    `).get(ordenId);

    if (!orden) throw new Error('Orden no encontrada');
    if (orden.estado === 'pagado') throw new Error('Esta orden ya fue pagada');
    if (orden.estado === 'cancelado') throw new Error('No se puede pagar una orden cancelada');

    const items = db.prepare(`
      SELECT * FROM orden_items WHERE orden_id = ?
    `).all(ordenId);
    for (const item of items) {
      if (item.tipo_item !== 'producto') continue;

      const producto = db.prepare(`
        SELECT stock, nombre FROM productos WHERE id = ?
      `).get(item.referencia_id);

      if (!producto) throw new Error(`Producto no encontrado: ${item.nombre}`);
      if (producto.stock < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${item.nombre}". ` +
          `Disponible: ${producto.stock}, requerido: ${item.cantidad}`
        );
      }
    }
    const pagar = db.transaction(() => {

      const descontarStock = db.prepare(`
        UPDATE productos SET stock = stock - ? WHERE id = ?
      `);
      for (const item of items) {
        if (item.tipo_item === 'producto') {
          descontarStock.run(item.cantidad, item.referencia_id);
        }
      }

      const ventaResultado = db.prepare(`
        INSERT INTO ventas
          (orden_id, cliente_nombre, total_productos, total_mano_obra, total, metodo_pago, caja_id)
        VALUES
          (@orden_id, @cliente_nombre, @total_productos, @total_mano_obra, @total, @metodo_pago, @caja_id)
      `).run({
        orden_id: orden.id,
        cliente_nombre: orden.cliente_nombre,
        total_productos: orden.total_productos,
        total_mano_obra: orden.total_mano_obra,
        total: orden.total,
        metodo_pago: data.metodo_pago,
        caja_id: orden.caja_id,
      });

      const ventaId = ventaResultado.lastInsertRowid;

      const insertVentaItem = db.prepare(`
        INSERT INTO venta_items
          (venta_id, tipo_item, referencia_id, nombre, precio_unitario, cantidad, subtotal)
        VALUES
          (@venta_id, @tipo_item, @referencia_id, @nombre, @precio_unitario, @cantidad, @subtotal)
      `);

      for (const item of items) {
        insertVentaItem.run({
          venta_id: ventaId,
          tipo_item: item.tipo_item,
          referencia_id: item.referencia_id,
          nombre: item.nombre,
          precio_unitario: item.precio_unitario,
          cantidad: item.cantidad,
          subtotal: item.subtotal,
        });
      }

      db.prepare(`
        UPDATE ordenes SET
          estado = 'pagado',
          metodo_pago = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(data.metodo_pago, ordenId);

      return ventaId;
    });

    const ventaId = pagar();

    return db.prepare(`SELECT * FROM ventas WHERE id = ?`).get(ventaId);
  });

}

module.exports = { registerOrdenesHandlers };