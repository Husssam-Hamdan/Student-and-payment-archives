/* ====================================================
   إدراء — أرشيف الطلاب  |  app.js
   نسخة ويب خالصة (GitHub Pages)
   لا تعتمد على Electron أو Node.js
   ==================================================== */

'use strict';

/* =========================================================
   1. نظام المصادقة بكلمة مرور
   ========================================================= */
(function AuthModule() {
  const AUTH_KEY  = 'edra.passwordHash.v2';
  const SALT_KEY  = 'edra.salt.v2';
  const LOCK_MS   = 20 * 60 * 1000; // 20 دقيقة خمول
  let   lockTimer = null;

  const $ = id => document.getElementById(id);

  /* --- salt --- */
  function getSalt() {
    let s = localStorage.getItem(SALT_KEY);
    if (!s) {
      s = [...crypto.getRandomValues(new Uint8Array(16))].join(',');
      localStorage.setItem(SALT_KEY, s);
    }
    return s;
  }

  /* --- تشفير --- */
  async function hashPwd(pwd, saltCSV) {
    const enc  = new TextEncoder();
    const salt = new Uint8Array(saltCSV.split(',').map(Number));
    const data = new Uint8Array([...enc.encode(pwd), ...salt]);
    const dig  = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(dig)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function safeEq(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  /* --- قفل / فتح --- */
  function lock() {
    stopTimer();
    const ov = $('loginOverlay');
    if (ov) { ov.style.display = 'flex'; ov.setAttribute('aria-hidden','false'); }
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const p = $('passwordInput'); if (p) p.focus(); }, 100);
  }

  function unlock() {
    const ov = $('loginOverlay');
    if (ov) { ov.style.display = 'none'; ov.setAttribute('aria-hidden','true'); }
    document.body.style.overflow = '';
    startTimer();
  }

  function startTimer() {
    stopTimer();
    lockTimer = setTimeout(lock, LOCK_MS);
  }
  function stopTimer() {
    if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
  }
  function resetTimer() {
    if ($('loginOverlay')?.style.display !== 'none') return;
    startTimer();
  }

  /* --- تهيئة --- */
  async function init() {
    const hasHash = !!localStorage.getItem(AUTH_KEY);

    // ضبط النصوص
    const title = $('loginTitle');
    const hint  = $('loginHint');
    if (!hasHash) {
      if (title) title.textContent = 'إدراء — أرشيف الطلاب';
      if (hint)  hint.textContent  = 'المرة الأولى — عيّن كلمة مرور';
    } else {
      if (title) title.textContent = 'تسجيل الدخول';
      if (hint)  hint.textContent  = 'أدخل كلمة مرورك للمتابعة';
    }

    lock();

    /* إظهار/إخفاء كلمة المرور */
    $('togglePass')?.addEventListener('click', () => {
      const p = $('passwordInput');
      p.type = p.type === 'password' ? 'text' : 'password';
      p.focus();
    });

    /* نموذج الدخول */
    $('loginForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const pwd = $('passwordInput')?.value?.trim() || '';
      const err = $('loginError');
      if (err) err.textContent = '';

      if (pwd.length < 4) {
        if (err) err.textContent = 'كلمة المرور يجب أن تكون 4 أحرف على الأقل.';
        return;
      }

      try {
        const salt = getSalt();
        if (!hasHash) {
          // إنشاء جديد
          localStorage.setItem(AUTH_KEY, await hashPwd(pwd, salt));
          unlock();
        } else {
          const stored = localStorage.getItem(AUTH_KEY);
          if (safeEq(stored, await hashPwd(pwd, salt))) {
            unlock();
            if ($('passwordInput')) $('passwordInput').value = '';
          } else {
            if (err) err.textContent = 'كلمة المرور غير صحيحة.';
          }
        }
      } catch { if ($('loginError')) $('loginError').textContent = 'حدث خطأ.'; }
    });

    /* فتح نموذج التغيير */
    $('openResetWithPwd')?.addEventListener('click', () => {
      $('loginForm').style.display = 'none';
      $('resetFormPwd').style.display = 'block';
    });
    $('cancelResetPwd')?.addEventListener('click', () => {
      $('resetFormPwd').style.display = 'none';
      $('resetFormPwd').reset?.();
      $('loginForm').style.display = 'block';
      if ($('resetPwdError')) $('resetPwdError').textContent = '';
    });

    /* نموذج تغيير كلمة المرور */
    $('resetFormPwd')?.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('resetPwdError');
      if (err) err.textContent = '';
      const cur = $('currentPwd')?.value?.trim() || '';
      const np1 = $('newPwd')?.value?.trim() || '';
      const np2 = $('newPwd2')?.value?.trim() || '';

      if (!cur || !np1 || np1 !== np2 || np1.length < 4) {
        if (err) err.textContent = 'تحقق من البيانات: كلمة المرور الجديدة لا تقل عن 4 أحرف والتأكيد متطابق.';
        return;
      }
      const salt   = getSalt();
      const stored = localStorage.getItem(AUTH_KEY);
      if (!safeEq(stored, await hashPwd(cur, salt))) {
        if (err) err.textContent = 'كلمة المرور الحالية غير صحيحة.';
        return;
      }
      localStorage.setItem(AUTH_KEY, await hashPwd(np1, salt));
      $('resetFormPwd').reset?.();
      $('resetFormPwd').style.display = 'none';
      $('loginForm').style.display = 'block';
      Swal.fire({ icon: 'success', title: 'تم', text: 'تم تغيير كلمة المرور بنجاح.', timer: 2000, showConfirmButton: false });
    });

    /* أزرار القفل والتغيير من الـ header */
    $('lockBtn')?.addEventListener('click', lock);
    $('resetBtn')?.addEventListener('click', () => {
      lock();
      setTimeout(() => {
        $('loginForm').style.display = 'none';
        $('resetFormPwd').style.display = 'block';
      }, 50);
    });

    /* مراقبة الخمول */
    ['click','keydown','mousemove','wheel','touchstart'].forEach(ev => {
      window.addEventListener(ev, resetTimer, { passive: true });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();


/* =========================================================
   2. منطق التطبيق الرئيسي
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {

  /* --- بيانات --- */
  let students = [];
  let nextRef  = 1;
  let editIdx  = null;

  function loadStorage() {
    try {
      const raw = localStorage.getItem('edra.students.v2');
      if (!raw) return;
      students = JSON.parse(raw).map((s, i) => ({
        ref: s.ref || (i + 1),
        name: s.name || '',
        nationalId: s.nationalId || '',
        phone: s.phone || '',
        employer: s.employer || '',
        hasOriginalIdCopyFileName: s.hasOriginalIdCopyFileName || '',
        hasOriginalIdCopyData: s.hasOriginalIdCopyData || '',
        hasOriginalCertificateFileName: s.hasOriginalCertificateFileName || '',
        hasOriginalCertificateData: s.hasOriginalCertificateData || '',
        paymentMethod: s.paymentMethod || 'شبكة',
        hasArrears: !!s.hasArrears,
        arrearsAmount: s.arrearsAmount || '0',
        lastPayment: s.lastPayment || '',
        paymentCount: Number(s.paymentCount || 0),
        joinDate: s.joinDate || '',
        notes: s.notes || '',
      }));
      nextRef = students.length ? Math.max(...students.map(s => s.ref)) + 1 : 1;
    } catch { students = []; nextRef = 1; }
  }

  function saveStorage() {
    localStorage.setItem('edra.students.v2', JSON.stringify(students));
  }

  loadStorage();

  /* --- DOM refs --- */
  const G = id => document.getElementById(id);
  const nameInput        = G('name');
  const natIdInput       = G('nationalId');
  const phoneInput       = G('phone');
  const employerInput    = G('employer');
  const payMethodSel     = G('paymentMethod');
  const joinDateInput    = G('joinDate');
  const lastPayInput     = G('lastPayment');
  const payCountInput    = G('paymentCount');
  const hasArrearsChk    = G('hasArrears');
  const arrearsAmtInput  = G('arrearsAmount');
  const idFileInput      = G('hasOriginalIdCopyFile');
  const certFileInput    = G('hasOriginalCertificateFile');
  const idFileNameSpan   = G('idFileName');
  const certFileNameSpan = G('certFileName');
  const notesInput       = G('notes');
  const submitBtn        = G('submitBtn');
  const clearBtn         = G('clearBtn');
  const clearAllBtn      = G('clearAllBtn');
  const exportBtn        = G('exportBtn');
  const exportOverdueBtn = G('exportOverdueBtn');
  const importFile       = G('importFile');
  const searchInput      = G('searchInput');
  const tableBody        = G('studentsTable')?.querySelector('tbody');
  const filterAllBtn     = G('filterAll');
  const filterArrBtn     = G('filterHasArrears');
  const filterOvdBtn     = G('filterOverdue');
  const filterPaySel     = G('filterPay');
  const filterCertSel    = G('filterCert');
  const formTitle        = G('formTitle');
  const toggleFormBtn    = G('toggleFormBtn');
  const studentForm      = G('studentForm');

  /* --- حالة الفرز والفلتر --- */
  let sortState   = { key: 'ref', dir: 'desc' };
  let filterState = { mode: 'all', pay: 'all', cert: 'all' };

  /* --- أدوات مساعدة --- */
  function daysSince(d) {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt)) return null;
    return Math.floor((Date.now() - dt.getTime()) / 86400000);
  }

  function esc(str) {
    return (str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function normPhone(raw) {
    if (!raw) return '';
    let n = String(raw).replace(/\D/g, '');
    if (n.startsWith('00966')) n = '0' + n.slice(5);
    else if (n.startsWith('966')) n = '0' + n.slice(3);
    else if (n.startsWith('5') && n.length === 9) n = '0' + n;
    return n;
  }

  function readFile(file) {
    return new Promise((res, rej) => {
      if (!file) return res(null);
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => rej(new Error('فشل القراءة'));
      r.readAsDataURL(file);
    });
  }

  /* --- طيّ النموذج --- */
  let formCollapsed = false;
  toggleFormBtn?.addEventListener('click', () => {
    formCollapsed = !formCollapsed;
    studentForm.style.display = formCollapsed ? 'none' : 'block';
    toggleFormBtn.textContent = formCollapsed ? 'فتح النموذج ▼' : 'طيّ النموذج ▲';
  });

  /* --- قيود الإدخال --- */
  natIdInput?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });
  phoneInput?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
  });
  arrearsAmtInput?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^0-9.]/g, '');
  });
  hasArrearsChk?.addEventListener('change', () => {
    arrearsAmtInput.disabled = !hasArrearsChk.checked;
    if (!hasArrearsChk.checked) arrearsAmtInput.value = '0';
  });

  /* اسم الملف المختار */
  idFileInput?.addEventListener('change', () => {
    idFileNameSpan.textContent = idFileInput.files[0]?.name || 'لم يُختر ملف';
  });
  certFileInput?.addEventListener('change', () => {
    certFileNameSpan.textContent = certFileInput.files[0]?.name || 'لم يُختر ملف';
  });

  /* --- تنقية + فرز --- */
  function applyFilters(list, q) {
    const lq = (q || '').toLowerCase();
    return list.filter(s => {
      if (lq) {
        const hay = [s.name, s.nationalId, s.phone, s.employer, s.notes, s.joinDate, s.lastPayment]
          .join(' ').toLowerCase();
        if (!hay.includes(lq)) return false;
      }
      const d   = daysSince(s.lastPayment);
      const ovd = s.hasArrears && d !== null && d >= 30;
      if (filterState.mode === 'hasArrears' && !s.hasArrears) return false;
      if (filterState.mode === 'overdue'    && !ovd)          return false;
      if (filterState.pay !== 'all' && (s.paymentMethod || '') !== filterState.pay) return false;
      if (filterState.cert === 'yes' && !s.hasOriginalCertificateFileName) return false;
      if (filterState.cert === 'no'  &&  s.hasOriginalCertificateFileName) return false;
      return true;
    });
  }

  const sortFns = {
    ref:                    s => Number(s.ref) || 0,
    name:                   s => s.name.toLowerCase(),
    nationalId:             s => s.nationalId,
    phone:                  s => s.phone,
    employer:               s => s.employer.toLowerCase(),
    hasOriginalIdCopy:      s => s.hasOriginalIdCopyFileName ? 1 : 0,
    hasOriginalCertificate: s => s.hasOriginalCertificateFileName ? 1 : 0,
    paymentMethod:          s => s.paymentMethod,
    arrearsAmount:          s => Number(s.arrearsAmount) || 0,
    lastPayment:            s => new Date(s.lastPayment).getTime() || -Infinity,
    paymentCount:           s => Number(s.paymentCount) || 0,
    joinDate:               s => new Date(s.joinDate).getTime() || -Infinity,
    notes:                  s => s.notes.toLowerCase(),
  };

  function applySort(list) {
    const { key, dir } = sortState;
    if (!key || !sortFns[key]) return list.slice();
    const d = dir === 'desc' ? -1 : 1;
    const fn = sortFns[key];
    return list.slice().sort((a, b) => {
      const va = fn(a), vb = fn(b);
      return va < vb ? -d : va > vb ? d : 0;
    });
  }

  /* --- إحصائيات --- */
  function renderStats() {
    let total = students.length, arr = 0, ovd = 0, sum = 0;
    students.forEach(s => {
      if (s.hasArrears) {
        arr++; sum += Number(s.arrearsAmount) || 0;
        const d = daysSince(s.lastPayment);
        if (d !== null && d >= 30) ovd++;
      }
    });
    G('statTotal').textContent   = total;
    G('statArrears').textContent = arr;
    G('statOverdue').textContent = ovd;
    G('statSum').textContent     = sum.toLocaleString('ar-SA');
  }

  /* --- رسم الجدول --- */
  function renderTable() {
    if (!tableBody) return;
    const filtered = applyFilters(students, searchInput?.value || '');
    const sorted   = applySort(filtered);

    // مؤشرات الفرز
    document.querySelectorAll('thead th[data-sort-key]').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sortKey === sortState.key)
        th.classList.add(sortState.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    });

    if (!sorted.length) {
      tableBody.innerHTML = '<tr><td colspan="14" class="empty-row">لا توجد سجلات تطابق البحث</td></tr>';
      renderStats();
      return;
    }

    tableBody.innerHTML = '';
    sorted.forEach(st => {
      const i   = students.findIndex(s => s.ref === st.ref);
      const d   = daysSince(st.lastPayment);
      const ovd = st.hasArrears && d !== null && d >= 30;

      const idCell = st.hasOriginalIdCopyFileName
        ? `<span class="badge badge-yes" style="cursor:pointer" onclick="downloadFile('${esc(st.hasOriginalIdCopyFileName)}','${encodeURIComponent(st.ref)}','id')">📥 ${esc(st.hasOriginalIdCopyFileName)}</span>`
        : `<span class="badge badge-no">لا</span>`;

      const certCell = st.hasOriginalCertificateFileName
        ? `<span class="badge badge-yes" style="cursor:pointer" onclick="downloadFile('${esc(st.hasOriginalCertificateFileName)}','${encodeURIComponent(st.ref)}','cert')">📥 ${esc(st.hasOriginalCertificateFileName)}</span>`
        : `<span class="badge badge-no">لا</span>`;

      const arrearsCell = st.hasArrears
        ? `<span class="badge badge-arrears">${Number(st.arrearsAmount).toLocaleString('ar-SA')} ﷼</span>`
        : `<span class="badge badge-no">—</span>`;

      const overdueTag = ovd ? `<br><small style="color:var(--danger)">(${d} يوم)</small>` : '';

      const tr = document.createElement('tr');
      if (ovd) tr.classList.add('overdue');
      tr.innerHTML = `
        <td>${st.ref}</td>
        <td style="text-align:right;white-space:normal;min-width:140px">${esc(st.name)}</td>
        <td style="direction:ltr">${st.nationalId}</td>
        <td style="direction:ltr">${st.phone}</td>
        <td style="white-space:normal;min-width:120px">${esc(st.employer) || '—'}</td>
        <td>${idCell}</td>
        <td>${certCell}</td>
        <td><span class="badge badge-pay">${esc(st.paymentMethod)}</span></td>
        <td>${arrearsCell}</td>
        <td>${st.lastPayment || '—'}${overdueTag}</td>
        <td>${st.paymentCount}</td>
        <td>${st.joinDate || '—'}</td>
        <td style="white-space:normal;min-width:120px;text-align:right">${esc(st.notes) || '—'}</td>
        <td>
          <div class="actions">
            ${st.hasArrears ? `<button class="tbl-btn pay" data-i="${i}">💰 سدد</button>` : ''}
            <button class="tbl-btn" data-edit="${i}">✏️ تعديل</button>
            <button class="tbl-btn del" data-del="${i}">🗑</button>
          </div>
        </td>`;
      tableBody.appendChild(tr);
    });

    // أحداث الأزرار
    tableBody.querySelectorAll('.tbl-btn[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => editStudent(+btn.dataset.edit)));
    tableBody.querySelectorAll('.tbl-btn[data-del]').forEach(btn =>
      btn.addEventListener('click', () => deleteStudent(+btn.dataset.del)));
    tableBody.querySelectorAll('.tbl-btn.pay[data-i]').forEach(btn =>
      btn.addEventListener('click', () => payInstallment(+btn.dataset.i)));

    renderStats();
  }

  /* --- تنزيل ملف محفوظ --- */
  window.downloadFile = function(fileName, refEnc, type) {
    const ref = decodeURIComponent(refEnc);
    const st  = students.find(s => String(s.ref) === String(ref));
    if (!st) return;
    const data = type === 'id' ? st.hasOriginalIdCopyData : st.hasOriginalCertificateData;
    if (!data) { Swal.fire({ icon: 'info', title: 'لا يوجد ملف', text: 'الملف غير متوفر (ربما تم الاستيراد من Excel).' }); return; }
    const a = document.createElement('a');
    a.href = data; a.download = fileName; a.click();
  };

  /* --- مسح النموذج --- */
  function clearForm() {
    studentForm?.reset();
    arrearsAmtInput.disabled = true;
    idFileNameSpan.textContent   = 'لم يُختر ملف';
    certFileNameSpan.textContent = 'لم يُختر ملف';
    editIdx = null;
    submitBtn.textContent = '➕ إضافة';
    if (formTitle) formTitle.textContent = '➕ إضافة طالب';
    nameInput?.focus();
  }

  clearBtn?.addEventListener('click', clearForm);

  /* --- إضافة / تعديل --- */
  studentForm?.addEventListener('submit', async e => {
    e.preventDefault();

    const name     = (nameInput?.value || '').trim();
    const natId    = (natIdInput?.value || '').replace(/\D/g, '');
    const phone    = normPhone(phoneInput?.value || '');
    const employer = (employerInput?.value || '').trim();
    const method   = payMethodSel?.value || 'شبكة';
    const joinDate = joinDateInput?.value || '';
    const lastPay  = lastPayInput?.value || '';
    const payCnt   = Number(payCountInput?.value || 0);
    const hasArr   = hasArrearsChk?.checked || false;
    const arrAmt   = arrearsAmtInput?.value || '0';
    const notes    = (notesInput?.value || '').trim();
    const idFile   = idFileInput?.files?.[0] || null;
    const certFile = certFileInput?.files?.[0] || null;

    /* تحقق */
    if (!name) return Swal.fire({ icon:'error', title:'خطأ', text:'الاسم مطلوب.' });
    if (natId.length !== 10) return Swal.fire({ icon:'error', title:'خطأ', text:'رقم الهوية يجب أن يكون 10 أرقام.' });
    if (!(phone.length === 10 && phone.startsWith('05')))
      return Swal.fire({ icon:'error', title:'خطأ', text:'أدخل رقم جوال صحيح (05XXXXXXXX).' });
    if (hasArr && Number(arrAmt) <= 0)
      return Swal.fire({ icon:'error', title:'خطأ', text:'أدخل قيمة المتأخرات.' });
    if (hasArr && !lastPay)
      return Swal.fire({ icon:'error', title:'خطأ', text:'أدخل تاريخ آخر سداد.' });

    /* تكرار */
    const dupIdx = students.findIndex((s, idx) =>
      idx !== editIdx && (s.nationalId === natId || s.phone === phone));
    if (dupIdx !== -1) {
      const res = await Swal.fire({
        icon:'warning', title:'سجل مكرر',
        html:`يوجد سجل بنفس الهوية أو الجوال (رقم ${students[dupIdx].ref}).<br>هل تريد فتحه للتعديل؟`,
        showCancelButton:true, confirmButtonText:'فتح للتعديل', cancelButtonText:'إلغاء'
      });
      if (res.isConfirmed) editStudent(dupIdx);
      return;
    }

    /* قراءة الملفات */
    let idData   = editIdx !== null ? students[editIdx].hasOriginalIdCopyData   : '';
    let certData = editIdx !== null ? students[editIdx].hasOriginalCertificateData : '';
    try { if (idFile)   idData   = await readFile(idFile);   } catch {}
    try { if (certFile) certData = await readFile(certFile); } catch {}

    const student = {
      name, nationalId: natId, phone, employer,
      hasOriginalIdCopyFileName:       idFile   ? idFile.name   : (editIdx !== null ? students[editIdx].hasOriginalIdCopyFileName   : ''),
      hasOriginalIdCopyData:           idData,
      hasOriginalCertificateFileName:  certFile ? certFile.name : (editIdx !== null ? students[editIdx].hasOriginalCertificateFileName : ''),
      hasOriginalCertificateData:      certData,
      paymentMethod: method, hasArrears: hasArr,
      arrearsAmount: hasArr ? arrAmt : '0',
      lastPayment: lastPay, paymentCount: payCnt,
      joinDate, notes,
    };

    if (editIdx === null) {
      student.ref = nextRef++;
      students.unshift(student);
    } else {
      student.ref = students[editIdx].ref;
      students[editIdx] = student;
    }

    saveStorage();
    clearForm();
    renderTable();
    Swal.fire({ icon:'success', title:'تم', text: editIdx === null ? 'تمت إضافة الطالب.' : 'تم حفظ التعديل.', timer:1500, showConfirmButton:false });
    editIdx = null;
  });

  /* --- تعديل --- */
  function editStudent(i) {
    const s = students[i];
    if (!s) return;
    nameInput.value       = s.name;
    natIdInput.value      = s.nationalId;
    phoneInput.value      = s.phone;
    employerInput.value   = s.employer;
    payMethodSel.value    = s.paymentMethod || 'شبكة';
    joinDateInput.value   = s.joinDate || '';
    lastPayInput.value    = s.lastPayment || '';
    payCountInput.value   = s.paymentCount;
    hasArrearsChk.checked = !!s.hasArrears;
    arrearsAmtInput.value = s.arrearsAmount || '0';
    arrearsAmtInput.disabled = !s.hasArrears;
    notesInput.value      = s.notes || '';
    idFileNameSpan.textContent   = s.hasOriginalIdCopyFileName   || 'لم يُختر ملف';
    certFileNameSpan.textContent = s.hasOriginalCertificateFileName || 'لم يُختر ملف';
    editIdx = i;
    submitBtn.textContent = '💾 حفظ التعديل';
    if (formTitle) formTitle.textContent = '✏️ تعديل بيانات الطالب';
    // فتح النموذج لو كان مطوياً
    if (formCollapsed) toggleFormBtn?.click();
    studentForm.scrollIntoView({ behavior:'smooth', block:'start' });
    nameInput?.focus();
  }

  /* --- حذف --- */
  async function deleteStudent(i) {
    const res = await Swal.fire({
      icon:'warning', title:`حذف: ${students[i]?.name}`,
      text:'هذا الإجراء لا يمكن التراجع عنه.',
      showCancelButton:true, confirmButtonText:'حذف', cancelButtonText:'إلغاء',
      confirmButtonColor:'#f85149'
    });
    if (!res.isConfirmed) return;
    students.splice(i, 1);
    saveStorage(); renderTable();
  }

  /* --- تسديد قسط --- */
  async function payInstallment(i) {
    const s = students[i];
    let arr = Number(s.arrearsAmount) || 0;
    if (arr <= 0) {
      Swal.fire({ icon:'info', title:'لا متأخرات', text:'لا يوجد مبلغ للسداد.', timer:1500, showConfirmButton:false });
      return;
    }
    const { value: amount, isConfirmed } = await Swal.fire({
      title:'تسجيل سداد',
      input:'number', inputLabel:'المبلغ المسدد (ريال)',
      inputValue:500, inputAttributes:{ min:1, step:1 },
      showCancelButton:true, confirmButtonText:'تأكيد', cancelButtonText:'إلغاء',
      inputValidator: v => (!v || Number(v) <= 0) ? 'أدخل مبلغاً صحيحاً' : null
    });
    if (!isConfirmed) return;
    arr = Math.max(0, arr - Number(amount));
    s.arrearsAmount  = arr;
    s.paymentCount   = (Number(s.paymentCount) || 0) + 1;
    s.lastPayment    = new Date().toISOString().slice(0,10);
    s.hasArrears     = arr > 0;
    saveStorage(); renderTable();
    Swal.fire({ icon:'success', title:'تم التسجيل', text:`تم خصم ${Number(amount).toLocaleString('ar-SA')} ريال. المتبقي: ${arr.toLocaleString('ar-SA')} ريال.`, timer:2000, showConfirmButton:false });
  }

  /* --- مسح الكل --- */
  clearAllBtn?.addEventListener('click', async () => {
    const res = await Swal.fire({
      icon:'warning', title:'مسح جميع السجلات',
      text:'هذا الإجراء لا يمكن التراجع عنه!',
      showCancelButton:true, confirmButtonText:'نعم، امسح الكل', cancelButtonText:'إلغاء',
      confirmButtonColor:'#f85149'
    });
    if (!res.isConfirmed) return;
    students = []; nextRef = 1;
    saveStorage(); renderTable();
  });

  /* --- بحث وفلتر --- */
  searchInput?.addEventListener('input', renderTable);
  filterAllBtn?.addEventListener('click', () => { setFilter('all'); });
  filterArrBtn?.addEventListener('click', () => { setFilter('hasArrears'); });
  filterOvdBtn?.addEventListener('click', () => { setFilter('overdue'); });
  filterPaySel?.addEventListener('change', () => { filterState.pay = filterPaySel.value; renderTable(); });
  filterCertSel?.addEventListener('change', () => { filterState.cert = filterCertSel.value; renderTable(); });

  function setFilter(mode) {
    filterState.mode = mode;
    [filterAllBtn, filterArrBtn, filterOvdBtn].forEach(b => b?.classList.remove('active'));
    const map = { all: filterAllBtn, hasArrears: filterArrBtn, overdue: filterOvdBtn };
    map[mode]?.classList.add('active');
    renderTable();
  }

  /* --- فرز رؤوس الجدول --- */
  document.querySelectorAll('thead th[data-sort-key]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      else { sortState.key = key; sortState.dir = 'asc'; }
      renderTable();
    });
  });

  /* --- تصدير Excel --- */
  exportBtn?.addEventListener('click', () => exportExcel(students, 'students_archive.xlsx', 'الطلاب'));
  exportOverdueBtn?.addEventListener('click', () => {
    const ovd = students.filter(s => {
      const d = daysSince(s.lastPayment);
      return s.hasArrears && d !== null && d >= 30;
    });
    if (!ovd.length) return Swal.fire({ icon:'info', title:'لا متأخرين', text:'لا توجد سجلات متأخرة.' });
    exportExcel(ovd, 'students_overdue.xlsx', 'المتأخرين');
  });

  function exportExcel(data, filename, sheetName) {
    if (!data.length) return Swal.fire({ icon:'info', title:'لا بيانات', text:'لا توجد بيانات للتصدير.' });
    const header = ['#','الاسم','رقم الهوية','الجوال','جهة العمل',
      'اسم ملف الهوية','اسم ملف الشهادة','طريقة الدفع',
      'متأخرات','قيمة المتأخرات','آخر سداد','عدد مرات السداد','تاريخ الانضمام','الملاحظات'];
    const rows = data.map(s => [
      s.ref, s.name, s.nationalId, s.phone, s.employer,
      s.hasOriginalIdCopyFileName || '', s.hasOriginalCertificateFileName || '',
      s.paymentMethod, s.hasArrears ? 'نعم' : 'لا',
      s.hasArrears ? (Number(s.arrearsAmount) || 0) : 0,
      s.lastPayment || '', Number(s.paymentCount || 0),
      s.joinDate || '', s.notes || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    // عرض تلقائي للأعمدة
    ws['!cols'] = header.map((_, ci) => ({
      wch: Math.max(header[ci].length, ...rows.map(r => String(r[ci] || '').length)) + 2
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  /* --- استيراد Excel --- */
  importFile?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    // تحقق من امتداد الملف
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls'].includes(ext)) {
      Swal.fire({ icon:'error', title:'نوع خاطئ', text:'يرجى اختيار ملف Excel بامتداد .xlsx أو .xls فقط.' });
      importFile.value = '';
      return;
    }

    // تحقق من تحميل مكتبة XLSX
    if (typeof XLSX === 'undefined') {
      Swal.fire({ icon:'error', title:'خطأ', text:'مكتبة Excel لم تُحمَّل بعد. تأكد من اتصالك بالإنترنت وأعد تحميل الصفحة.' });
      importFile.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      Swal.fire({ icon:'error', title:'خطأ في القراءة', text:'تعذّر قراءة الملف. حاول مرة أخرى.' });
      importFile.value = '';
    };

    reader.onload = ev => {
      try {
        const data = ev.target.result;
        if (!data || data.byteLength === 0) {
          Swal.fire({ icon:'error', title:'ملف فارغ', text:'الملف المختار فارغ.' });
          return;
        }

        const wb = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true });

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          Swal.fire({ icon:'error', title:'خطأ', text:'الملف لا يحتوي على أوراق عمل.' });
          return;
        }

        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rows || rows.length < 2) {
          Swal.fire({ icon:'warning', title:'لا بيانات', text:'الملف لا يحتوي على بيانات (أقل من صفين).' });
          return;
        }

        // رأس الجدول
        const hdr = rows[0].map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, ' '));

        const fi = (cands) => {
          for (const c of cands) {
            const cl = c.toLowerCase().trim();
            // مطابقة تامة
            let idx = hdr.findIndex(h => h === cl);
            if (idx !== -1) return idx;
            // مطابقة بدون مسافات
            idx = hdr.findIndex(h => h.replace(/\s+/g,'') === cl.replace(/\s+/g,''));
            if (idx !== -1) return idx;
            // مطابقة جزئية (الكلمة الأولى)
            idx = hdr.findIndex(h => h.startsWith(cl) || cl.startsWith(h));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const iName    = fi(['الاسم','name','اسم الطالب']);
        const iNat     = fi(['رقم الهوية','الهوية','رقم هوية','nationalid','national id','#']);
        const iPhone   = fi(['الجوال','الهاتف','رقم الجوال','phone','mobile','رقم جوال']);
        const iEmp     = fi(['جهة العمل','الجهة','employer','company','العمل']);
        const iPay     = fi(['طريقة الدفع','الدفع','paymentmethod','payment method','payment']);
        const iHasArr  = fi(['متأخرات','عليه متأخرات','has arrears','arrears']);
        const iArrAmt  = fi(['قيمة المتأخرات','قيمة','arrears amount','amount']);
        const iLastPay = fi(['آخر سداد','اخر سداد','last payment','lastpayment']);
        const iPayCnt  = fi(['عدد مرات السداد','عدد مرات','مرات السداد','paymentcount','payment count']);
        const iJoin    = fi(['تاريخ الانضمام','الانضمام','joindate','join date','join']);
        const iNotes   = fi(['الملاحظات','ملاحظات','notes','remarks']);
        const iIdFile  = fi(['اسم ملف الهوية','اسم ملف نسخة الهوية','نسخة الهوية','id file','idfile']);
        const iCertFile= fi(['اسم ملف الشهادة','الشهادة','certificate file','certfile']);

        // تحويل تاريخ Excel الرقمي إلى نص
        function excelDateToStr(val) {
          if (!val) return '';
          if (val instanceof Date) return val.toISOString().slice(0, 10);
          if (typeof val === 'number' && val > 1000) {
            // رقم serial date من Excel
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            if (!isNaN(d)) return d.toISOString().slice(0, 10);
          }
          return String(val);
        }

        const dataRows = rows.slice(1).filter(r =>
          Array.isArray(r) && r.some(cell => cell !== '' && cell !== null && cell !== undefined)
        );

        if (dataRows.length === 0) {
          Swal.fire({ icon:'warning', title:'لا بيانات', text:'لم يتم العثور على صفوف بيانات في الملف.' });
          return;
        }

        const newStudents = dataRows.map(r => {
          const nat    = String(r[iNat] ?? '').replace(/\D/g, '').slice(0, 10);
          const phone  = normPhone(String(r[iPhone] ?? ''));
          const hasArr = iHasArr !== -1
            ? (String(r[iHasArr] ?? '').trim() === 'نعم' || String(r[iHasArr] ?? '').toLowerCase() === 'yes')
            : false;
          let pay = String(r[iPay] ?? 'شبكة').trim();
          if (pay === 'كاش' || pay === 'cash') pay = 'نقدي';
          if (!['شبكة','نقدي','تحويل'].includes(pay)) pay = 'شبكة';

          return {
            ref: nextRef++,
            name:     iName !== -1 ? String(r[iName] ?? '').trim() : '',
            nationalId: nat,
            phone,
            employer: iEmp  !== -1 ? String(r[iEmp]  ?? '').trim() : '',
            hasOriginalIdCopyFileName:      iIdFile   !== -1 ? String(r[iIdFile]   ?? '') : '',
            hasOriginalIdCopyData:          '',
            hasOriginalCertificateFileName: iCertFile !== -1 ? String(r[iCertFile] ?? '') : '',
            hasOriginalCertificateData:     '',
            paymentMethod: pay,
            hasArrears: hasArr,
            arrearsAmount: hasArr ? String(r[iArrAmt] ?? '0') : '0',
            lastPayment:  excelDateToStr(iLastPay !== -1 ? r[iLastPay] : ''),
            paymentCount: Number(iPayCnt !== -1 ? (r[iPayCnt] ?? 0) : 0),
            joinDate:     excelDateToStr(iJoin !== -1 ? r[iJoin] : ''),
            notes:        iNotes !== -1 ? String(r[iNotes] ?? '').trim() : '',
          };
        });

        students.push(...newStudents);
        saveStorage();
        renderTable();
        Swal.fire({
          icon: 'success',
          title: 'تم الاستيراد',
          text: `تم استيراد ${newStudents.length} سجل بنجاح.`,
        });

      } catch (err) {
        console.error('Import error:', err);
        Swal.fire({
          icon: 'error',
          title: 'خطأ في الاستيراد',
          text: `تعذّر قراءة الملف: ${err.message || 'خطأ غير معروف'}`,
        });
      } finally {
        importFile.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  });

  /* --- الرسم الأوّلي --- */
  setFilter('all');
  renderTable();

}); // DOMContentLoaded
