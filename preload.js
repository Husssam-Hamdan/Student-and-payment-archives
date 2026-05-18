// preload.js

// إظهار أن العملية جاهزة للربط بين الـRenderer و الـMain
window.addEventListener('DOMContentLoaded', () => {
  console.log("Preload script loaded!");
});

// يمكنك إضافة وظائف إضافية هنا حسب الحاجة
// مثال: تفاعل مع الـMain process عبر `ipcRenderer`
const { ipcRenderer } = require('electron');
ipcRenderer.on('message-from-main', (event, message) => {
  console.log("Message from main process: ", message);
});
