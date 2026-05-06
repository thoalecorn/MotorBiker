const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'BikerCore.db');

let db;

function getDatabase() {
    if(!db) throw new Error('Database not initialized');
    return db;
}

function initializeDatabase() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    createTables();
    createViews();

    console.log('Database initialized at', DB_PATH);
    return db;
}

function createTables() {
  db.exec(`

    CREATE TABLE IF NOT EXISTS clientes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT    NOT NULL,
      telefono    TEXT,
      created_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS productos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT    NOT NULL,
      referencia    TEXT,
      precio_venta  REAL    NOT NULL,
      precio_costo  REAL    DEFAULT 0,
      stock         INTEGER DEFAULT 0,
      stock_minimo  INTEGER DEFAULT 0,
      categoria     TEXT    DEFAULT 'general',
      activo        INTEGER DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS servicios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL,
      precio      REAL NOT NULL,
      descripcion TEXT,
      activo      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS cierres_caja (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha                  TEXT    NOT NULL,
      estado                 TEXT    DEFAULT 'abierto', -- 'abierto' | 'cerrado'
      total_ventas_productos REAL    DEFAULT 0,
      total_mano_obra        REAL    DEFAULT 0,
      total_gastos           REAL    DEFAULT 0,
      comision_mecanico      REAL    DEFAULT 0,  -- 60% de total_mano_obra
      balance_neto           REAL    DEFAULT 0,  -- (ventas_prod + 40% mano_obra) - gastos
      created_at             TEXT    DEFAULT (datetime('now', 'localtime')),
      closed_at              TEXT
    );

    CREATE TABLE IF NOT EXISTS ordenes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id       INTEGER REFERENCES clientes(id),
      cliente_nombre   TEXT    NOT NULL,  -- snapshot por si el cliente no está registrado
      descripcion      TEXT,
      tipo             TEXT    DEFAULT 'directa', -- 'directa' | 'taller'
      estado           TEXT    DEFAULT 'pendiente', -- 'pendiente' | 'en_proceso' | 'terminado' | 'pagado' | 'cancelado'
      total_productos  REAL    DEFAULT 0,
      total_mano_obra  REAL    DEFAULT 0,
      total            REAL    DEFAULT 0,
      metodo_pago      TEXT,  -- 'efectivo' | 'transferencia' | 'credito' — se llena al pagar
      caja_id          INTEGER REFERENCES cierres_caja(id),
      created_at       TEXT    DEFAULT (datetime('now', 'localtime')),
      updated_at       TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS orden_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id        INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
      tipo_item       TEXT    NOT NULL, -- 'producto' | 'servicio'
      referencia_id   INTEGER,          -- id del producto o servicio original
      nombre          TEXT    NOT NULL, -- snapshot del nombre al momento de crear
      precio_unitario REAL    NOT NULL, -- snapshot del precio al momento de crear
      cantidad        INTEGER DEFAULT 1,
      subtotal        REAL    NOT NULL
    );


    CREATE TABLE IF NOT EXISTS ventas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      orden_id        INTEGER NOT NULL REFERENCES ordenes(id),
      cliente_nombre  TEXT    NOT NULL,
      total_productos REAL    DEFAULT 0,
      total_mano_obra REAL    DEFAULT 0,
      total           REAL    NOT NULL,
      metodo_pago     TEXT    NOT NULL,
      caja_id         INTEGER REFERENCES cierres_caja(id),
      created_at      TEXT    DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS venta_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      tipo_item       TEXT    NOT NULL, -- 'producto' | 'servicio'
      referencia_id   INTEGER,
      nombre          TEXT    NOT NULL, -- snapshot
      precio_unitario REAL    NOT NULL, -- snapshot
      cantidad        INTEGER DEFAULT 1,
      subtotal        REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gastos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT NOT NULL,
      monto       REAL NOT NULL,
      categoria   TEXT DEFAULT 'general',
      caja_id     INTEGER REFERENCES cierres_caja(id),
      created_at  TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS facturas_proveedor (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor        TEXT NOT NULL,
      descripcion      TEXT,
      monto            REAL NOT NULL,
      fecha_emision    TEXT NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      estado           TEXT DEFAULT 'pendiente', -- 'pendiente' | 'pagada'
      created_at       TEXT DEFAULT (datetime('now', 'localtime'))
    );

  `);
}

function createViews() {
  db.exec(`

    -- Cuaderno de Ventas: solo ítems de tipo producto
    DROP VIEW IF EXISTS cuaderno_ventas;
    CREATE VIEW cuaderno_ventas AS
      SELECT
        vi.id,
        v.created_at AS fecha,
        v.cliente_nombre,
        vi.nombre AS producto,
        vi.cantidad,
        vi.precio_unitario,
        vi.subtotal,
        v.metodo_pago,
        v.caja_id
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE vi.tipo_item = 'producto';

    -- Cuaderno de Taller: solo ítems de tipo servicio
    DROP VIEW IF EXISTS cuaderno_taller;
    CREATE VIEW cuaderno_taller AS
      SELECT
        vi.id,
        v.created_at AS fecha,
        v.cliente_nombre,
        vi.nombre AS servicio,
        vi.cantidad,
        vi.precio_unitario,
        vi.subtotal,
        v.metodo_pago,
        v.caja_id
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE vi.tipo_item = 'servicio';

  `);
}