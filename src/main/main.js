const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDB } = require('./database');
const { registerCajaHandlers } = require('./ipc/caja'); 
const { registerProductosHandlers } = require('./ipc/productos');
const { registerServiciosHandlers } = require('./ipc/servicios');
const { registerOrdenesHandlers } = require('./ipc/ordenes');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false,   
    },
    show: false, 
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  initDB();        
  createWindow();  

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


app.whenReady().then(() => {
  initDB();
  registerCajaHandlers();
  registerProductosHandlers();
  registerServiciosHandlers();
  registerOrdenesHandlers();  
  createWindow();
});