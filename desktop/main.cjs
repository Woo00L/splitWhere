const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const entryFile = path.join(__dirname, '..', 'dist', 'index.html');
const entryUrl = pathToFileURL(entryFile).href;
const referenceUrl = 'https://www.splitimg.com/zh';
let mainWindow;

function openReference(url) {
  if (url === referenceUrl) void shell.openExternal(url);
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'ImgSplit · 本地图片切割',
    width: 1280,
    height: 900,
    minWidth: 740,
    minHeight: 600,
    backgroundColor: '#151317',
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { if (mainWindow === window) mainWindow = undefined; });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openReference(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== entryUrl) {
      event.preventDefault();
      openReference(url);
    }
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('did-fail-load', (_event, code, description) => {
    if (code === -3) return;
    void dialog.showMessageBox(window, { type: 'error', title: 'ImgSplit 无法启动', message: '应用界面加载失败', detail: description });
  });
  void window.loadFile(entryFile);
}

function createMenu() {
  const template = [];
  if (process.platform === 'darwin') {
    template.push({ label: app.name, submenu: [
      { role: 'about', label: '关于 ImgSplit' }, { type: 'separator' },
      { role: 'services', label: '服务' }, { type: 'separator' },
      { role: 'hide', label: '隐藏 ImgSplit' }, { role: 'hideOthers', label: '隐藏其他应用' },
      { role: 'unhide', label: '显示全部' }, { type: 'separator' }, { role: 'quit', label: '退出 ImgSplit' },
    ] });
  }
  template.push(
    { label: '编辑', submenu: [
      { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
      { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' },
    ] },
    { label: '视图', submenu: [
      { role: 'resetZoom', label: '恢复界面大小' }, { role: 'zoomIn', label: '放大界面' },
      { role: 'zoomOut', label: '缩小界面' }, { type: 'separator' }, { role: 'togglefullscreen', label: '切换全屏' },
    ] },
    { label: '窗口', submenu: [ { role: 'minimize', label: '最小化' }, { role: 'close', label: '关闭窗口' } ] },
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName('ImgSplit');
app.setAboutPanelOptions({ applicationName: 'ImgSplit', applicationVersion: app.getVersion(), copyright: '本地图片切割工具 · 图片只在你的设备上处理' });

app.whenReady().then(() => {
  const { session } = require('electron');
  const localSession = session.defaultSession;
  localSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'clipboard-sanitized-write');
  });
  localSession.setPermissionCheckHandler((_webContents, permission) => permission === 'clipboard-sanitized-write');
  // 桌面版只载入本地资源；点击参考来源时交由系统浏览器打开。
  localSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  localSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      title: '保存切图',
      defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())),
      buttonLabel: '保存',
    });
    item.once('done', (_doneEvent, state) => {
      if (state === 'interrupted' && mainWindow) {
        void dialog.showMessageBox(mainWindow, { type: 'error', title: '保存失败', message: '文件保存未完成，请重新点击保存。' });
      }
    });
  });
  createMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
