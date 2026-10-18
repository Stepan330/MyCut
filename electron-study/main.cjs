const { app, BrowserWindow, Menu, session,ipcMain,dialog } = require('electron');
const path = require('node:path');
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const projectCodec=import('./src/project-file.mjs');
const projectRequests=new Set();
const projectPaths=new Map();
function windowFor(event){const win=BrowserWindow.fromWebContents(event.sender),url=pathToFileURL(path.join(__dirname,'dist/index.html')).href;if(!win||event.senderFrame!==event.sender.mainFrame||event.sender.getURL()!==url)throw new Error('Project request denied');return win;}
ipcMain.handle('project:save',async(event,text,saveAs=false)=>{
  let temporary,request;try{const win=windowFor(event);if(typeof saveAs!=='boolean')throw new Error('Invalid save request');if(projectRequests.has(event.sender.id))throw new Error('A project dialog is already open');request=event.sender.id;projectRequests.add(request);const codec=await projectCodec;codec.decodeProject(text);let filePath=saveAs?null:projectPaths.get(request);if(!filePath){const result=await dialog.showSaveDialog(win,{title:'Save MyCut project',defaultPath:projectPaths.get(request)??'Untitled.mycutproject',filters:[{name:'MyCut project',extensions:['mycutproject']}]});if(result.canceled||!result.filePath)return {canceled:true};filePath=result.filePath;}
    const candidate=filePath+'.'+randomUUID()+'.tmp',handle=await fs.open(candidate,'wx');temporary=candidate;try{await handle.writeFile(text,{encoding:'utf8'});await handle.sync();}finally{await handle.close();}await fs.rename(temporary,filePath);temporary=null;projectPaths.set(request,filePath);return {name:path.basename(filePath)};
  }catch(error){return {error:error.message};}finally{if(request!==undefined)projectRequests.delete(request);if(temporary)await fs.unlink(temporary).catch(()=>{});}
});
ipcMain.handle('project:open',async(event,dirty=false)=>{
  let request;try{const win=windowFor(event);if(projectRequests.has(event.sender.id))throw new Error('A project dialog is already open');request=event.sender.id;projectRequests.add(request);const codec=await projectCodec;if(typeof dirty!=='boolean')throw new Error('Invalid project request');if(dirty){const result=await dialog.showMessageBox(win,{type:'warning',message:'Open another project?',detail:'Unsaved changes in the current project will be discarded.',buttons:['Cancel','Open'],defaultId:0,cancelId:0});if(result.response!==1)return {canceled:true};}const {canceled,filePaths}=await dialog.showOpenDialog(win,{title:'Open MyCut project',properties:['openFile'],filters:[{name:'MyCut project',extensions:['mycutproject']}]});if(canceled||!filePaths?.[0])return {canceled:true};const stat=await fs.stat(filePaths[0]);if(!stat.isFile()||stat.size>codec.MAX_PROJECT_BYTES)throw new Error('Project exceeds 128 MB or is not a file');const text=await fs.readFile(filePaths[0],'utf8');codec.decodeProject(text);projectPaths.set(request,filePaths[0]);return {name:path.basename(filePaths[0]),text};
  }catch(error){return {error:error.message};}finally{if(request!==undefined)projectRequests.delete(request);}
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 980, minWidth: 1000, minHeight: 700,
    title: 'MyCut — Electron UI study', backgroundColor: '#151515', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false,preload:path.join(__dirname,'preload.cjs') },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const contentsId=win.webContents.id;win.once('closed',()=>projectPaths.delete(contentsId));
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'dist/index.html'));
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
