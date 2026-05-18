/* ====== مصادقة بباسورد موحّد - StudentsArchive (بدون رمز استرداد) ====== */
(() => {
  const AUTH_STORAGE_KEY = 'studentsArchive.passwordHash.v1';
  const AUTH_SALT_KEY = 'studentsArchive.salt.v1';
  const LOCK_INACTIVITY_MS = 20 * 60 * 1000; // 20 دقيقة
  let inactivityTimer;

  const $ = (sel) => document.querySelector(sel);

  function getOrCreateSalt() {
    let salt = localStorage.getItem(AUTH_SALT_KEY);
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16)).join(',');
      localStorage.setItem(AUTH_SALT_KEY, salt);
    }
    return salt;
  }

  async function hashPassword(password, saltCSV) {
    const enc = new TextEncoder();
    const salt = new Uint8Array(saltCSV.split(',').map(x => parseInt(x, 10)));
    const data = new Uint8Array([...enc.encode(password), ...salt]);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const len = Math.max(a.length, b.length);
    let res = 0;
    for (let i = 0; i < len; i++) {
      const ca = a.charCodeAt(i) || 0;
      const cb = b.charCodeAt(i) || 0;
      res |= (ca ^ cb);
    }
    return res === 0 && a.length === b.length;
  }

  function showLogin() {
    const ov = $('#loginOverlay');
    if (!ov) return;
    ov.style.display = 'flex';
    document.body.classList.add('is-locked');
    stopInactivityWatcher();

    // حبس التركيز داخل البطاقة
    const card = $('#loginCard');
    if (card) {
      const focusables = card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length) focusables[0].focus();
      // منع تبويب للخارج
      card.addEventListener('keydown', trapTab, true);
    }
  }

  function trapTab(e) {
    if (e.key !== 'Tab') return;
    const card = $('#loginCard');
    if (!card) return;
    const focusables = [...card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function hideLogin() {
    const ov = $('#loginOverlay');
    if (!ov) return;
    ov.style.display = 'none';
    document.body.classList.remove('is-locked');

    const card = $('#loginCard');
    if (card) card.removeEventListener('keydown', trapTab, true);
  }

  function startInactivityWatcher() {
    stopInactivityWatcher();
    inactivityTimer = setTimeout(() => showLogin(), LOCK_INACTIVITY_MS);
  }
  function stopInactivityWatcher() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
  }
  function resetInactivityTimer() {
    const ov = $('#loginOverlay');
    if (ov && ov.style.display !== 'none') return;
    startInactivityWatcher();
  }

  async function initAuth() {
    const loginOverlay = $('#loginOverlay');
    const loginForm = $('#loginForm');
    const passwordInput = $('#passwordInput');
    const togglePass = $('#togglePass');
    const loginError = $('#loginError');
    const loginTitle = $('#loginTitle');
    const loginHint = $('#loginHint');

    if (!loginOverlay || !loginForm) return;

    const hasPassword = !!localStorage.getItem(AUTH_STORAGE_KEY);
    if (!hasPassword) {
      loginTitle && (loginTitle.textContent = 'تعيين كلمة مرور');
      loginHint && (loginHint.textContent = 'أول مرة! عيّن كلمة مرور للدخول لاحقًا');
    } else {
      loginTitle && (loginTitle.textContent = 'تسجيل الدخول');
      loginHint && (loginHint.textContent = 'أدخل كلمة المرور للمتابعة');
    }

    showLogin();

    if (togglePass && passwordInput) {
      togglePass.addEventListener('click', () => {
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.focus();
      });
    }

    // إعادة تعيين بكلمة المرور (فقط)
    const openResetWithPwd = document.getElementById('openResetWithPwd');
    const resetFormPwd = document.getElementById('resetFormPwd');
    const cancelResetPwd = document.getElementById('cancelResetPwd');
    const currentPwd = document.getElementById('currentPwd');
    const newPwd = document.getElementById('newPwd');
    const newPwd2 = document.getElementById('newPwd2');
    const resetPwdError = document.getElementById('resetPwdError');

    if (openResetWithPwd && resetFormPwd) {
      openResetWithPwd.addEventListener('click', () => {
        loginForm.style.display = 'none';
        resetFormPwd.style.display = 'block';
      });
    }
    if (cancelResetPwd && resetFormPwd) {
      cancelResetPwd.addEventListener('click', () => {
        resetFormPwd.reset?.();
        resetFormPwd.style.display = 'none';
        loginForm.style.display = 'block';
        resetPwdError && (resetPwdError.textContent = '');
      });
    }
    if (resetFormPwd) {
      resetFormPwd.addEventListener('submit', async (e) => {
        e.preventDefault();
        resetPwdError && (resetPwdError.textContent = '');
        const cur = currentPwd?.value?.trim() || '';
        const np1 = newPwd?.value?.trim() || '';
        const np2 = newPwd2?.value?.trim() || '';
        if (!cur || !np1 || np1 !== np2 || np1.length < 4) {
          resetPwdError && (resetPwdError.textContent = 'تحقق من البيانات. الحد الأدنى 4 أحرف، والتأكيد متطابق.');
          return;
        }
        const salt = getOrCreateSalt();
        const savedHash = localStorage.getItem(AUTH_STORAGE_KEY);
        const curHash = await hashPassword(cur, salt);
        if (!timingSafeEqual(savedHash, curHash)) {
          resetPwdError && (resetPwdError.textContent = 'كلمة المرور الحالية غير صحيحة.');
          return;
        }
        const newHash = await hashPassword(np1, salt);
        localStorage.setItem(AUTH_STORAGE_KEY, newHash);
        resetFormPwd.reset?.();
        resetFormPwd.style.display = 'none';
        loginForm.style.display = 'block';
        alert('تم تغيير كلمة المرور بنجاح.');
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!passwordInput) return;
      loginError && (loginError.textContent = '');
      const pwd = passwordInput.value?.trim() || '';
      if (pwd.length < 4) {
        loginError && (loginError.textContent = 'كلمة المرور قصيرة. الحد الأدنى 4 أحرف.');
        return;
      }
      try {
        const salt = getOrCreateSalt();
        if (!hasPassword) {
          const hash = await hashPassword(pwd, salt);
          localStorage.setItem(AUTH_STORAGE_KEY, hash);
          hideLogin();
          startInactivityWatcher();
        } else {
          const savedHash = localStorage.getItem(AUTH_STORAGE_KEY);
          const providedHash = await hashPassword(pwd, salt);
          if (timingSafeEqual(savedHash, providedHash)) {
            hideLogin();
            startInactivityWatcher();
          } else {
            loginError && (loginError.textContent = 'كلمة المرور غير صحيحة.');
          }
        }
      } catch (err) {
        console.error(err);
        loginError && (loginError.textContent = 'حدث خطأ غير متوقع.');
      } finally {
        passwordInput.value = '';
      }
    });

    // زر القفل اليدوي
    const lockBtn = document.getElementById('lockBtn');
    if (lockBtn) lockBtn.addEventListener('click', () => showLogin());

    // زر إعادة التعيين (من الزر العائم)
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn && resetFormPwd) {
      resetBtn.addEventListener('click', () => {
        showLogin();
        const loginFormEl = document.getElementById('loginForm');
        if (loginFormEl) loginFormEl.style.display = 'none';
        resetFormPwd.style.display = 'block';
      });
    }

    // مراقبة الخمول
    ['click','keydown','mousemove','wheel','touchstart'].forEach(evt => {
      window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // إظهار الأزرار العائمة إن كانت مخفية بالـHTML
    const floatBtns = document.getElementById('floatBtns');
    if (floatBtns) floatBtns.style.display = 'flex';
  }

  document.addEventListener('DOMContentLoaded', initAuth);
})();

/* ====== التطبيق (معدّل ليشمل رفع/تنزيل الملفات وتاريخ الانضمام واستيراد مرن) ====== */
const XLSX = require("xlsx");
const Swal = require("sweetalert2");
const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

// ===== تحميل البيانات (مع الحقول الجديدة) =====
let students = JSON.parse(localStorage.getItem("students_archive_v1") || "[]").map((st, index) => ({
  ...st,
  ref: st.ref || index + 1,
  lastPayment: st.lastPayment || "",
  paymentCount: Number(st.paymentCount || 0),
  // ملفات: كائن يحتوي filename و data (dataURL)
  hasOriginalIdCopyFileName: st.hasOriginalIdCopyFileName || "",
  hasOriginalIdCopyData: st.hasOriginalIdCopyData || "",
  hasOriginalCertificateFileName: st.hasOriginalCertificateFileName || "",
  hasOriginalCertificateData: st.hasOriginalCertificateData || "",
  joinDate: st.joinDate || "",
}));
let nextRef = students.length > 0 ? Math.max(...students.map(s => s.ref)) + 1 : 1;
let editingIndex = null;

// ===== عناصر DOM =====
const nameInput = document.getElementById("name");
const nationalIdInput = document.getElementById("nationalId");
const phoneInput = document.getElementById("phone");
const employerInput = document.getElementById("employer");
const hasOriginalIdCopyFileInput = document.getElementById("hasOriginalIdCopyFile");
const hasOriginalCertificateFileInput = document.getElementById("hasOriginalCertificateFile");
const paymentMethodSelect = document.getElementById("paymentMethod");
const hasArrearsCheckbox = document.getElementById("hasArrears");
const arrearsAmountInput = document.getElementById("arrearsAmount");
const lastPaymentInput = document.getElementById("lastPayment");
const paymentCountInput = document.getElementById("paymentCount");
const joinDateInput = document.getElementById("joinDate");
const notesInput = document.getElementById("notes");

const submitBtn = document.getElementById("submitBtn");
const clearBtn = document.getElementById("clearBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const exportBtn = document.getElementById("exportBtn");
const exportOverdueBtn = document.getElementById("exportOverdueBtn");
const importFile = document.getElementById("importFile");
const searchInput = document.getElementById("searchInput");
const studentsTable = document.getElementById("studentsTable");
const tableBody = studentsTable.querySelector("tbody");

// العدّادات
const statTotal = document.getElementById("statTotal");
const statArrears = document.getElementById("statArrears");
const statOverdue = document.getElementById("statOverdue");
const statSum = document.getElementById("statSum");

// الفلاتر
const filterAllBtn = document.getElementById("filterAll");
const filterHasArrearsBtn = document.getElementById("filterHasArrears");
const filterOverdueBtn = document.getElementById("filterOverdue");
const filterPaySelect = document.getElementById("filterPay");

// ===== قيود إدخال =====
nationalIdInput.addEventListener("input", (e) => {
  const v = e.target.value.replace(/\D/g, "").slice(0, 10);
  if (e.target.value !== v) e.target.value = v;
});
phoneInput.addEventListener("input", (e) => {
  const v = e.target.value.replace(/\D/g, "").slice(0, 12);
  if (e.target.value !== v) e.target.value = v;
});

// المتأخرات: تفعيل/تعطيل
hasArrearsCheckbox.addEventListener("change", () => {
  arrearsAmountInput.disabled = !hasArrearsCheckbox.checked;
});

// ===== تخزين =====
function saveStorage() {
  localStorage.setItem("students_archive_v1", JSON.stringify(students));
}

// ===== أدوات =====
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

function normalizeKsaMobile(raw) {
  if (!raw) return "";
  let num = String(raw).replace(/\D/g, "");
  if (num.startsWith("00966")) {
    num = "0" + num.slice(5);
  } else if (num.startsWith("966")) {
    num = "0" + num.slice(3);
  } else if (num.startsWith("5") && num.length === 9) {
    num = "0" + num;
  }
  return num;
}

// ===== حالة الفرز والفلاتر =====
let sortState = { key: null, dir: "asc" };
let filterState = { mode: "all", pay: "all" };
let refToggleDir = "desc";

const sortKeys = {
  ref: (st) => Number(st.ref) || 0,
  name: (st) => (st.name || "").toLowerCase(),
  nationalId: (st) => (st.nationalId || ""),
  phone: (st) => (st.phone || ""),
  employer: (st) => (st.employer || "").toLowerCase(),
  hasOriginalIdCopy: (st) => st.hasOriginalIdCopyFileName ? 1 : 0,
  hasOriginalCertificate: (st) => st.hasOriginalCertificateFileName ? 1 : 0,
  paymentMethod: (st) => (st.paymentMethod || "").toLowerCase(),
  arrearsAmount: (st) => Number(st.arrearsAmount || 0),
  lastPayment: (st) => {
    const d = new Date(st.lastPayment);
    return isNaN(d) ? -Infinity : d.getTime();
  },
  paymentCount: (st) => Number(st.paymentCount || 0),
  joinDate: (st) => {
    const d = new Date(st.joinDate);
    return isNaN(d) ? -Infinity : d.getTime();
  },
  notes: (st) => (st.notes || "").toLowerCase()
};

function applyFilters(list, searchText) {
  const q = (searchText || "").toLowerCase();

  return list.filter(st => {
    const matchesSearch = !q ||
      (st.name || "").toLowerCase().includes(q) ||
      (st.nationalId || "").toLowerCase().includes(q) ||
      (st.phone || "").toLowerCase().includes(q) ||
      (st.employer || "").toLowerCase().includes(q) ||
      (st.notes || "").toLowerCase().includes(q) ||
      (st.lastPayment || "").toLowerCase().includes(q) ||
      (st.joinDate || "").toLowerCase().includes(q);

    if (!matchesSearch) return false;

    const d = daysSince(st.lastPayment);
    const isOverdue = st.hasArrears && d !== null && d >= 30;
    if (filterState.mode === "hasArrears" && !st.hasArrears) return false;
    if (filterState.mode === "overdue" && !isOverdue) return false;

    if (filterState.pay !== "all" && (st.paymentMethod || "").toLowerCase() !== filterState.pay) {
      return false;
    }

    return true;
  });
}

function applySort(list) {
  const key = sortState.key;
  if (!key || !sortKeys[key]) return list.slice();
  const dir = sortState.dir === "desc" ? -1 : 1;
  const getter = sortKeys[key];

  return list.slice().sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

function setSortIndicators() {
  const ths = studentsTable.querySelectorAll("thead th[data-sort-key]");
  ths.forEach(t => t.classList.remove("sorted-asc", "sorted-desc"));
  if (sortState.key) {
    const th = studentsTable.querySelector(`thead th[data-sort-key="${sortState.key}"]`);
    if (th) th.classList.add(sortState.dir === "asc" ? "sorted-asc" : "sorted-desc");
  }
}

// ===== إحصائيات =====
function computeStats(list) {
  let total = list.length, arrears = 0, overdue = 0, sum = 0;
  list.forEach(st => {
    if (st.hasArrears) {
      arrears++;
      sum += Number(st.arrearsAmount || 0);
      const d = daysSince(st.lastPayment);
      if (d !== null && d >= 30) overdue++;
    }
  });
  return { total, arrears, overdue, sum };
}

function renderStats() {
  const { total, arrears, overdue, sum } = computeStats(students);
  statTotal.textContent = total;
  statArrears.textContent = arrears;
  statOverdue.textContent = overdue;
  statSum.textContent = sum.toLocaleString('ar-SA') + " ريال";
}

// ===== قراءة ملف إلى dataURL =====
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

// ===== حفظ الملفات المرفوعة إلى مجلد منفصل =====
async function saveUploadedFiles(studentData, studentRef) {
  const filesDir = path.join(__dirname, 'uploaded_files');
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }

  const studentDir = path.join(filesDir, `student_${studentRef}`);
  if (!fs.existsSync(studentDir)) {
    fs.mkdirSync(studentDir, { recursive: true });
  }

  let idFilePath = '';
  let certFilePath = '';

  // حفظ ملف الهوية إذا موجود
  if (studentData.hasOriginalIdCopyData && studentData.hasOriginalIdCopyData.startsWith('data:')) {
    const base64Data = studentData.hasOriginalIdCopyData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExtension = studentData.hasOriginalIdCopyFileName.split('.').pop() || 'jpg';
    idFilePath = path.join(studentDir, `id.${fileExtension}`);
    fs.writeFileSync(idFilePath, buffer);
  }

  // حفظ ملف الشهادة إذا موجود
  if (studentData.hasOriginalCertificateData && studentData.hasOriginalCertificateData.startsWith('data:')) {
    const base64Data = studentData.hasOriginalCertificateData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExtension = studentData.hasOriginalCertificateFileName.split('.').pop() || 'pdf';
    certFilePath = path.join(studentDir, `certificate.${fileExtension}`);
    fs.writeFileSync(certFilePath, buffer);
  }

  return {
    idFilePath,
    certFilePath
  };
}

// ===== رسم الجدول =====
function renderTable() {
  tableBody.innerHTML = "";

  const filtered = applyFilters(students, searchInput.value);
  const sorted = applySort(filtered);

  if (sorted.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="14" class="center">لا توجد سجلات</td></tr>`;
    renderStats();
    setSortIndicators();
    return;
  }

  sorted.forEach((st) => {
    const row = document.createElement("tr");

    const idCopyCell = st.hasOriginalIdCopyFileName
      ? `${escapeHtml(st.hasOriginalIdCopyFileName)} · <a href="${st.hasOriginalIdCopyData}" download="${escapeHtml(st.hasOriginalIdCopyFileName)}">تنزيل</a>`
      : 'لا';

    const certCell = st.hasOriginalCertificateFileName
      ? `${escapeHtml(st.hasOriginalCertificateFileName)} · <a href="${st.hasOriginalCertificateData}" download="${escapeHtml(st.hasOriginalCertificateFileName)}">تنزيل</a>`
      : 'لا';

    row.innerHTML = `
      <td>${st.ref}</td>
      <td>${escapeHtml(st.name || "")}</td>
      <td>${st.nationalId || ""}</td>
      <td>${st.phone || ""}</td>
      <td>${escapeHtml(st.employer || "")}</td>
      <td>${idCopyCell}</td>
      <td>${certCell}</td>
      <td>${st.paymentMethod || ""}</td>
      <td>${st.hasArrears ? ((st.arrearsAmount || "0") + " ريال") : "-"}</td>
      <td>${st.lastPayment ? st.lastPayment : "-"}</td>
      <td>${Number(st.paymentCount || 0)}</td>
      <td>${st.joinDate ? st.joinDate : "-"}</td>
      <td>${st.notes ? escapeHtml(st.notes) : "-"}</td>
      <td class="actions">
        <button class="payBtn">سدد</button>
        <button class="editBtn">تعديل</button>
        <button class="deleteBtn">حذف</button>
      </td>
    `;

    const d = daysSince(st.lastPayment);
    if (st.hasArrears && d !== null && d >= 30) {
      row.classList.add("overdue");
    }

    tableBody.appendChild(row);

    const idxInStudents = students.findIndex(s => s.ref === st.ref);
    row.querySelector(".editBtn").addEventListener("click", () => editStudent(idxInStudents));
    row.querySelector(".deleteBtn").addEventListener("click", () => deleteStudent(idxInStudents));
    row.querySelector(".payBtn").addEventListener("click", () => pay500(idxInStudents));
  });

  renderStats();
  setSortIndicators();
}

// ===== خصم 500 عند السداد + تأكيد =====
async function pay500(i) {
  const st = students[i];
  let arrears = Number(st.arrearsAmount || 0);
  if (isNaN(arrears) || arrears <= 0) {
    await Swal.fire({ icon:'info', title:'لا توجد متأخرات', text:'لا يوجد مبلغ مستحق للسداد.' });
    return;
  }

  const res = await Swal.fire({
    icon: 'question',
    title: 'تأكيد السداد',
    text: 'هل أنت متأكد من خصم 500 ريال من المبلغ المتبقي؟',
    showCancelButton: true,
    confirmButtonText: 'نعم، خصم 500',
    cancelButtonText: 'إلغاء'
  });
  if (!res.isConfirmed) return;

  arrears = Math.max(0, arrears - 500);
  st.arrearsAmount = arrears;
  st.paymentCount = Number(st.paymentCount || 0) + 1;
  st.lastPayment = new Date().toISOString().slice(0, 10);
  st.hasArrears = arrears > 0; // لو وصل 0 نشيل العلامة

  saveStorage();
  renderTable();
}

// ===== فرز رؤوس الأعمدة =====
function setupSorting() {
  const ths = studentsTable.querySelectorAll("thead th[data-sort-key]");
  ths.forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort-key");
      if (sortState.key === key) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.key = key;
        sortState.dir = "asc";
      }
      ths.forEach(t => t.classList.remove("sorted-asc","sorted-desc"));
      th.classList.add(sortState.dir === "asc" ? "sorted-asc" : "sorted-desc");
      renderTable();
    });
  });
}

// ===== فلاتر =====
function setupFilters() {
  if (filterAllBtn) filterAllBtn.addEventListener("click", () => {
    filterState.mode = "all";
    sortState.key = "ref";
    sortState.dir = refToggleDir;
    refToggleDir = refToggleDir === "desc" ? "asc" : "desc";
    renderTable();
  });

  if (filterHasArrearsBtn) filterHasArrearsBtn.addEventListener("click", () => {
    filterState.mode = "hasArrears";
    renderTable();
  });

  if (filterOverdueBtn) filterOverdueBtn.addEventListener("click", () => {
    filterState.mode = "overdue";
    renderTable();
  });

  if (filterPaySelect) filterPaySelect.addEventListener("change", (e) => {
    const val = (e.target.value || "all").toLowerCase();
    filterState.pay = val;
    renderTable();
  });

  searchInput.addEventListener("input", () => renderTable());
}

// ===== إضافة/تعديل (يتعامل مع ملفات المدخلات) =====
submitBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const natDigits = (nationalIdInput.value || "").replace(/\D/g, "");
  const phoneNormalized = normalizeKsaMobile(phoneInput.value || "");
  const method = (paymentMethodSelect.value || "").trim();

  // اقرأ الملفات (إن وجدت)
  const idFile = hasOriginalIdCopyFileInput.files && hasOriginalIdCopyFileInput.files[0] ? hasOriginalIdCopyFileInput.files[0] : null;
  const certFile = hasOriginalCertificateFileInput.files && hasOriginalCertificateFileInput.files[0] ? hasOriginalCertificateFileInput.files[0] : null;

  let idData = null;
  let certData = null;
  try {
    idData = await readFileAsDataURL(idFile);
    certData = await readFileAsDataURL(certFile);
  } catch (err) {
    console.warn('file read error', err);
  }

  const student = {
    name: (nameInput.value || "").trim(),
    nationalId: natDigits,
    phone: phoneNormalized,
    employer: (employerInput.value || "").trim(),
    hasOriginalIdCopyFileName: idFile ? idFile.name : (editingIndex !== null ? students[editingIndex].hasOriginalIdCopyFileName : ""),
    hasOriginalIdCopyData: idData || (editingIndex !== null ? students[editingIndex].hasOriginalIdCopyData : ""),
    hasOriginalCertificateFileName: certFile ? certFile.name : (editingIndex !== null ? students[editingIndex].hasOriginalCertificateFileName : ""),
    hasOriginalCertificateData: certData || (editingIndex !== null ? students[editingIndex].hasOriginalCertificateData : ""),
    paymentMethod: method === "كاش" ? "نقدي" : method,
    hasArrears: hasArrearsCheckbox.checked,
    arrearsAmount: arrearsAmountInput.value || "0",
    lastPayment: lastPaymentInput.value || "",
    paymentCount: Number(paymentCountInput.value || 0),
    joinDate: joinDateInput.value || "",
    notes: (notesInput.value || "").trim()
  };

  // تحقق أساسي
  if (!student.name || !student.nationalId || !student.phone) {
    await Swal.fire({ icon:'error', title:'خطأ', text:'تأكد من إدخال الاسم، رقم الهوية، ورقم الجوال!' });
    return;
  }
  if (student.nationalId.length !== 10) {
    await Swal.fire({ icon:'error', title:'رقم الهوية غير صحيح', text:'رقم الهوية يجب أن يكون 10 أرقام بالضبط.' });
    return;
  }
  if (!(student.phone.length === 10 && student.phone.startsWith("05"))) {
    await Swal.fire({ icon:'error', title:'رقم الجوال غير صحيح', text:'أدخل رقم جوال صحيح (05XXXXXXXX أو 966…) سيتم تطبيعه إلى 05XXXXXXXX.' });
    return;
  }
  if (student.hasArrears && Number(student.arrearsAmount) <= 0) {
    await Swal.fire({ icon:'error', title:'خطأ', text:'أدخل قيمة المتأخرات أو أزل علامة المتأخرات' });
    return;
  }
  if (student.hasArrears && !student.lastPayment) {
    await Swal.fire({ icon:'error', title:'خطأ', text:'عند وجود متأخرات، أدخل تاريخ آخر سداد.' });
    return;
  }

  // منع التكرار
  const dupIndex = students.findIndex((s, idx) =>
    idx !== editingIndex && (s.nationalId === student.nationalId || s.phone === student.phone)
  );
  if (dupIndex !== -1) {
    const existing = students[dupIndex];
    const res = await Swal.fire({
      icon: 'warning',
      title: 'سجل مكرر',
      html: `يوجد سجل بنفس <b>رقم الهوية</b> أو <b>رقم الجوال</b> (الرقم التسلسلي: ${existing.ref}).<br>افتح السجل للتعديل بدل إنشاء سجل جديد.`,
      showCancelButton: true,
      confirmButtonText: 'فتح السجل',
      cancelButtonText: 'إلغاء'
    });
    if (res.isConfirmed) editStudent(dupIndex);
    return;
  }

  // حفظ الملفات المرفوعة
  let studentRef = editingIndex !== null ? students[editingIndex].ref : nextRef;
  try {
    const filePaths = await saveUploadedFiles(student, studentRef);
    // يمكنك حفظ مسارات الملفات إذا أردت
    console.log('تم حفظ الملفات في:', filePaths);
  } catch (err) {
    console.warn('فشل في حفظ الملفات:', err);
  }

  // حفظ
  if (editingIndex === null) {
    student.ref = nextRef++;
    students.unshift(student);
  } else {
    student.ref = students[editingIndex].ref;
    students[editingIndex] = student;
    editingIndex = null;
    submitBtn.textContent = "إضافة";
  }

  saveStorage();
  renderTable();
  document.getElementById("studentForm").reset();
  arrearsAmountInput.disabled = true;
});

// مسح النموذج
clearBtn.addEventListener("click", () => {
  document.getElementById("studentForm").reset();
  editingIndex = null;
  submitBtn.textContent = "إضافة";
  arrearsAmountInput.disabled = true;
});

// مسح كل البيانات
clearAllBtn.addEventListener("click", async () => {
  const result = await Swal.fire({
    title: 'هل أنت متأكد؟',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'نعم',
    cancelButtonText: 'لا'
  });
  if (!result.isConfirmed) return;

  students = [];
  nextRef = 1;
  saveStorage();
  renderTable();
});

// تعديل سجل
function editStudent(i) {
  const st = students[i];
  nameInput.value = st.name || "";
  nationalIdInput.value = st.nationalId || "";
  phoneInput.value = st.phone || "";
  employerInput.value = st.employer || "";

  // لا يمكن تعبئة input[type=file] برمجياً. اسم الملف محفوظ ويظهر كرابط في الجدول.
  paymentMethodSelect.value = (st.paymentMethod === "كاش") ? "نقدي" : (st.paymentMethod || "شبكة");
  hasArrearsCheckbox.checked = !!st.hasArrears;
  arrearsAmountInput.value = st.arrearsAmount || "0";
  arrearsAmountInput.disabled = !st.hasArrears;

  lastPaymentInput.value = (st.lastPayment && !isNaN(new Date(st.lastPayment)))
    ? new Date(st.lastPayment).toISOString().slice(0, 10)
    : "";
  paymentCountInput.value = Number(st.paymentCount || 0);
  joinDateInput.value = st.joinDate || "";
  notesInput.value = st.notes || "";

  editingIndex = i;
  submitBtn.textContent = "حفظ التعديل";
}

// حذف سجل
async function deleteStudent(i) {
  const result = await Swal.fire({
    title: 'هل أنت متأكد من الحذف؟',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'نعم',
    cancelButtonText: 'لا'
  });
  if (!result.isConfirmed) return;

  students.splice(i, 1);
  saveStorage();
  renderTable();
}

// ===== تصدير Excel (الحل الجديد) =====
exportBtn.addEventListener("click", async () => {
  console.log("تم الضغط على زر التصدير");

  if (students.length === 0) {
    await Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد بيانات للتصدير' });
    return;
  }

  const header = [
    "الرقم التسلسلي", "الاسم", "رقم الهوية", "الجوال", "جهة العمل",
    "اسم ملف نسخة الهوية", "اسم ملف الشهادة", "طريقة الدفع",
    "عليه متأخرات", "قيمة المتأخرات", "آخر سداد", "عدد مرات السداد", "تاريخ الانضمام", "الملاحظات"
  ];

  const wsData = [
    header,
    ...students.map(st => [
      st.ref,
      st.name || "",
      st.nationalId || "",
      st.phone || "",
      st.employer || "",
      // فقط اسم الملف بدلاً من الرابط
      st.hasOriginalIdCopyFileName || "",
      st.hasOriginalCertificateFileName || "",
      st.paymentMethod || "",
      st.hasArrears ? "نعم" : "لا",
      st.hasArrears ? (st.arrearsAmount || "0") : "0",
      st.lastPayment || "",
      Number(st.paymentCount || 0),
      st.joinDate || "",
      st.notes || ""
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الطلاب");

  const defaultFileName = "students_archive.xlsx";

  const filePath = await ipcRenderer.invoke("save-excel", defaultFileName);
  console.log("تم تحديد المسار للحفظ:", filePath);
  
  if (filePath) {
    console.log("حفظ الملف في المسار:", filePath);
    XLSX.writeFile(wb, filePath);
    await Swal.fire({ 
      icon: 'success', 
      title: 'تم الحفظ', 
      text: 'تم حفظ الملف بنجاح! ملاحظة: تم حفظ أسماء الملفات فقط في Excel. الملفات الأصلية مخزنة في مجلد uploaded_files.' 
    });
  } else {
    console.log("لم يتم تحديد المسار للحفظ.");
    await Swal.fire({ icon: 'error', title: 'خطأ', text: 'حدث خطأ أثناء حفظ الملف!' });
  }
});

// ===== تصدير Excel (المتأخرين 30+ يوم) =====
exportOverdueBtn.addEventListener("click", async () => {
  const overdueStudents = students.filter(st => {
    if (!st.hasArrears) return false;
    const d = daysSince(st.lastPayment);
    return d !== null && d >= 30;
  });

  if (overdueStudents.length === 0) {
    await Swal.fire({ icon:'info', title:'تنبيه', text:'لا توجد سجلات متأخرة للتصدير' });
    return;
  }

  const header = [
    "الرقم التسلسلي","الاسم","رقم الهوية","الجوال","جهة العمل",
    "اسم ملف نسخة الهوية","اسم ملف الشهادة","طريقة الدفع",
    "عليه متأخرات","قيمة المتأخرات","آخر سداد","عدد مرات السداد","تاريخ الانضمام","الملاحظات"
  ];

  const wsData = [
    header,
    ...overdueStudents.map(st => [
      st.ref,
      st.name || "",
      st.nationalId || "",
      st.phone || "",
      st.employer || "",
      st.hasOriginalIdCopyFileName || "",
      st.hasOriginalCertificateFileName || "",
      st.paymentMethod || "",
      st.hasArrears ? "نعم" : "لا",
      st.hasArrears ? (st.arrearsAmount || "0") : "0",
      st.lastPayment || "",
      Number(st.paymentCount || 0),
      st.joinDate || "",
      st.notes || ""
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = wsData[0].map((_, i) => ({ 
    wch: Math.max(...wsData.map(row => row[i] ? row[i].toString().length : 0)) + 2 
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المتأخرين");

  const hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
    day: 'numeric', month: 'numeric', year: 'numeric'
  }).format(new Date());
  const defaultFileName = `students_overdue_${hijriDate}.xlsx`;

  const filePath = await ipcRenderer.invoke("save-excel", defaultFileName);
  if (filePath) {
    XLSX.writeFile(wb, filePath);
    await Swal.fire({ icon:'success', title:'تم الحفظ', text:'تم حفظ ملف المتأخرين بنجاح!' });
  }
});

// ===== استيراد Excel (مرن مع اختلاف ترتيب/أسماء الأعمدة) =====
importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = new Uint8Array(ev.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!rows || rows.length === 0) return;

    const headerRow = rows[0].map(h => (h || "").toString().trim());
    const dataRows = rows.slice(1);

    // مطابقة مرنة لأسماء الأعمدة
    function findIndexByCandidates(candidates) {
      const lower = headerRow.map(h => (h || "").toString().toLowerCase());
      for (const cand of candidates) {
        const idx = lower.findIndex(h => h === cand.toLowerCase());
        if (idx !== -1) return idx;
      }
      // محاولة مطابقة بدون مسافات
      for (const cand of candidates) {
        const c = cand.toString().toLowerCase().replace(/\s+/g, '');
        const idx = lower.findIndex(h => h.replace(/\s+/g,'') === c);
        if (idx !== -1) return idx;
      }
      return -1;
    }

    const nameCandidates = ["الاسم","name","student name"];
    const natCandidates = ["رقم الهوية","الهوية","id","national id","nationalid"];
    const phoneCandidates = ["الجوال","الهاتف","phone","mobile","phone number"];
    const employerCandidates = ["جهة العمل","الجهة","employer","company"];
    const idFileCandidates = ["نسخة الهوية","اسم ملف نسخة الهوية","id file","id filename","idcopy","id_copy"];
    const certFileCandidates = ["الشهادة","اسم ملف الشهادة","certificate file","certificate filename","certfile","cert_filename"];
    const payMethCandidates = ["طريقة الدفع","payment method","paymethod"];
    const hasArrCandidates = ["عليه متأخرات","has arrears","arrears"];
    const arrAmtCandidates = ["قيمة المتأخرات","قيمة المتاخرات","قيمة","arrears amount","arrearsamt"];
    const lastPayCandidates = ["آخر سداد","last payment","lastpay","last_payment"];
    const payCntCandidates = ["عدد مرات السداد","عدد مرات","payment count","paycount"];
    const joinDateCandidates = ["تاريخ الانضمام","join date","joined"];
    const notesCandidates = ["الملاحظات","notes","remark","comments"];

    const iName     = findIndexByCandidates(nameCandidates);
    const iNatId    = findIndexByCandidates(natCandidates);
    const iPhone    = findIndexByCandidates(phoneCandidates);
    const iEmployer = findIndexByCandidates(employerCandidates);
    const iIdFile   = findIndexByCandidates(idFileCandidates);
    const iCertFile = findIndexByCandidates(certFileCandidates);
    const iPayMeth  = findIndexByCandidates(payMethCandidates);
    const iHasArr   = findIndexByCandidates(hasArrCandidates);
    const iArrAmt   = findIndexByCandidates(arrAmtCandidates);
    const iLastPay  = findIndexByCandidates(lastPayCandidates);
    const iPayCnt   = findIndexByCandidates(payCntCandidates);
    const iJoinDate = findIndexByCandidates(joinDateCandidates);
    const iNotes    = findIndexByCandidates(notesCandidates);

    const newStudents = dataRows
      .filter(row => Array.isArray(row) && row.length > 0)
      .map(row => {
        const nat = (iNatId !== -1 ? (row[iNatId] ?? "") : "").toString().replace(/\D/g, "").slice(0, 10);
        const phoneRaw = (iPhone !== -1 ? (row[iPhone] ?? "") : "").toString();
        const phoneNorm = normalizeKsaMobile(phoneRaw);

        let pay = (iPayMeth !== -1 ? (row[iPayMeth] ?? "شبكة") : "شبكة").toString().trim();
        if (pay === "كاش") pay = "نقدي";

        const hasArrears = (iHasArr !== -1) ? ((row[iHasArr] ?? "") === "نعم") : false;
        const arrAmt = (iArrAmt !== -1 ? (row[iArrAmt] ?? "0") : "0").toString();

        return {
          ref: nextRef++,
          name: (iName !== -1 ? (row[iName] ?? "") : "").toString(),
          nationalId: nat,
          phone: phoneNorm,
          employer: (iEmployer !== -1 ? (row[iEmployer] ?? "") : "").toString(),
          hasOriginalIdCopyFileName: (iIdFile !== -1 ? (row[iIdFile] ?? "") : "").toString(),
          hasOriginalIdCopyData: "",
          hasOriginalCertificateFileName: (iCertFile !== -1 ? (row[iCertFile] ?? "") : "").toString(),
          hasOriginalCertificateData: "",
          paymentMethod: pay,
          hasArrears,
          arrearsAmount: hasArrears ? arrAmt : "0",
          lastPayment: (iLastPay !== -1 ? (row[iLastPay] ?? "") : "").toString(),
          paymentCount: Number(iPayCnt !== -1 ? (row[iPayCnt] ?? 0) : 0),
          joinDate: (iJoinDate !== -1 ? (row[iJoinDate] ?? "") : "").toString(),
          notes: (iNotes !== -1 ? (row[iNotes] ?? "") : "").toString()
        };
      });

    students.push(...newStudents);
    saveStorage();
    renderTable();
    Swal.fire({ icon:'success', title:'تم الاستيراد', text:'تم استيراد البيانات بنجاح! (ملاحظة: الملفات لا تُحمّل من الإكسل — فقط أسماء الملفات إذا كانت موجودة)'});
  };
  reader.readAsArrayBuffer(file);
});

// ===== تهيئة =====
function setupEvents() {
  setupSorting();
  setupFilters();
  searchInput.addEventListener("input", () => renderTable());
}
function init() {
  setupEvents();
  renderTable();
}
init();