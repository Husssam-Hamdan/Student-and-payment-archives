const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

ipcMain.handle("save-excel", async (event, defaultFileName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "اختر مكان حفظ ملف الإكسل",
    defaultPath: defaultFileName,
    filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
  });

  if (canceled) {
    console.log("حفظ تم إلغاؤه.");
    return null; // إذا تم إلغاء الحفظ
  }

  console.log("تم حفظ الملف في المسار: ", filePath); // طباعة المسار في وحدة التحكم
  return filePath; // إرجاع المسار
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
