const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  caja: {
    abrir: () => ipcRenderer.invoke('caja:abrir'),
    cerrar: (id) => ipcRenderer.invoke('caja:cerrar', id),
    actual: () => ipcRenderer.invoke('caja:actual'),
  },

  productos: {
    listar: () => ipcRenderer.invoke('productos:listar'),
    crear: (data) => ipcRenderer.invoke('productos:crear', data),
    actualizar: (id, data)=> ipcRenderer.invoke('productos:actualizar', id, data),
    eliminar: (id) => ipcRenderer.invoke('productos:eliminar', id),
  },

  servicios: {
    listar: () => ipcRenderer.invoke('servicios:listar'),
    crear: (data) => ipcRenderer.invoke('servicios:crear', data),
    actualizar: (id, data)=> ipcRenderer.invoke('servicios:actualizar', id, data),
    eliminar: (id) => ipcRenderer.invoke('servicios:eliminar', id),
  },

  ordenes: {
    listar: (filtros) => ipcRenderer.invoke('ordenes:listar', filtros),
    crear: (data) => ipcRenderer.invoke('ordenes:crear', data),
    actualizar: (id, data)=> ipcRenderer.invoke('ordenes:actualizar', id, data),
    pagar: (id, data) => ipcRenderer.invoke('ordenes:pagar', id, data),
  },

  ventas: {
    listar: (filtros) => ipcRenderer.invoke('ventas:listar', filtros),
    cuadernoVentas: (cajaId) => ipcRenderer.invoke('ventas:cuaderno-ventas', cajaId),
    cuadernoTaller: (cajaId) => ipcRenderer.invoke('ventas:cuaderno-taller', cajaId),
  },

  gastos: {
    listar: (cajaId) => ipcRenderer.invoke('gastos:listar', cajaId),
    crear: (data) => ipcRenderer.invoke('gastos:crear', data),
    eliminar: (id) => ipcRenderer.invoke('gastos:eliminar', id),
  },

  facturas: {
    listar: (filtros) => ipcRenderer.invoke('facturas:listar', filtros),
    crear: (data) => ipcRenderer.invoke('facturas:crear', data),
    marcarPagada: (id) => ipcRenderer.invoke('facturas:marcar-pagada', id),
  },

  clientes: {
    listar: () => ipcRenderer.invoke('clientes:listar'),
    crear: (data) => ipcRenderer.invoke('clientes:crear', data),
  },

});