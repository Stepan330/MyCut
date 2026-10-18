const {contextBridge,ipcRenderer}=require('electron');
// Only project dialogs are exposed; renderer cannot supply filesystem paths.
contextBridge.exposeInMainWorld('projectFiles',Object.freeze({
  save:(text,saveAs=false)=>ipcRenderer.invoke('project:save',text,saveAs),
  open:dirty=>ipcRenderer.invoke('project:open',dirty),
}));
