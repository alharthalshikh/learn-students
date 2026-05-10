/**
 * Admin Panel Logic - أكاديمية اجتهاد
 * إدارة المواد والدروس والاختبارات
 */

let allSubjects = {};
let currentEditSubjectId = null;
let currentEditUnitIdx = null;
let currentEditLessonIdx = null;
let quizQuestions = [];

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, msg, onConfirm) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    const btn = document.getElementById('confirmBtnYes');
    
    // إزالة المستمعين القدامى لضمان عدم التكرار
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.onclick = () => {
        onConfirm();
        closeConfirm();
    };
    overlay.style.display = 'flex';
}

function closeConfirm() {
    document.getElementById('confirmOverlay').style.display = 'none';
}

// ==================== AUTH & INIT ====================
AuthService.onAuthChanged(async (user) => {
    if (!user) { window.location.href = 'login.html'; return; }
    const userData = await AuthService.getUserData(user.uid);
    if (!userData || userData.role !== 'admin') {
        showToast('عذراً، هذه الصفحة مخصصة للمدراء فقط.', 'error');
        setTimeout(() => window.location.href = 'stageone.html', 2000);
    } else {
        await refreshAll();
    }
});

async function refreshAll() {
    allSubjects = await FireDB.getSubjects();
    updateStats();
    renderSubjectsTable();
    populateSubjectDropdowns();
    loadUsers();
}

// ==================== STATS ====================
async function updateStats() {
    const stats = await FireDB.getStats();
    document.getElementById('countSubjects').textContent = stats.subjects;
    document.getElementById('countLessons').textContent = stats.lessons;
    document.getElementById('countStudents').textContent = stats.students;
}

// ==================== NAV ====================
function switchSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById('section-' + section);
    if (el) el.classList.add('active');
    event.currentTarget.classList.add('active');

    const titles = {
        dashboard: ['نظرة عامة', 'مرحباً بك في لوحة تحكم أكاديمية اجتهاد'],
        subjects: ['المواد الدراسية', 'إدارة وتنظيم المواد'],
        lessons: ['إدارة الدروس', 'إضافة وتعديل المحتوى التعليمي'],
        quizzes: ['الاختبارات', 'إنشاء وإدارة الاختبارات'],
        students: ['إدارة المستخدمين', 'عرض وإدارة حسابات المستخدمين'],
        feedback: ['ملاحظات الطلاب', 'عرض اقتراحات وملاحظات الطلاب']
    };
    if (titles[section]) {
        document.getElementById('sectionTitle').textContent = titles[section][0];
        document.getElementById('sectionSub').textContent = titles[section][1];
    }
    if (section === 'lessons') populateSubjectDropdowns();
    if (section === 'feedback') loadFeedback();
}

// ==================== SUBJECTS CRUD ====================
function renderSubjectsTable() {
    const list = document.getElementById('subjectsList');
    list.innerHTML = '';
    for (let id in allSubjects) {
        const s = allSubjects[id];
        const unitCount = s.units ? s.units.length : 0;
        let lessonCount = 0;
        if (s.units) s.units.forEach(u => { if (u.lessons) lessonCount += u.lessons.length; });
        
        // التحقق إذا كان الأيقونة صورة مرفوعة (Base64) أو إيموجي
        const isImage = s.icon && s.icon.startsWith('data:image/');
        const iconHTML = isImage 
            ? `<img src="${s.icon}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">`
            : `<span style="font-size:28px;">${s.icon || '📘'}</span>`;

        list.innerHTML += `
            <tr>
                <td>${iconHTML}</td>
                <td><strong>${s.name}</strong></td>
                <td>${unitCount} وحدات</td>
                <td>${lessonCount} دروس</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="editSubject('${id}')" title="تعديل">✏️</button>
                        <button class="action-btn" onclick="manageUnits('${id}')" title="إدارة الوحدات">📂</button>
                        <button class="action-btn delete" onclick="deleteSubject('${id}')" title="حذف">🗑️</button>
                    </div>
                </td>
            </tr>`;
    }
}

function showAddSubjectModal() {
    currentEditSubjectId = null;
    document.getElementById('modalTitle').textContent = 'إضافة مادة جديدة';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>اسم المادة</label>
            <input class="form-control" id="subjName" placeholder="مثال: الرياضيات">
        </div>
        <div class="form-group">
            <label>أيقونة المادة (اختياري)</label>
            <div style="display:flex; gap:10px; align-items:center;">
                <input type="file" id="subjFile" accept="image/*" style="display:none;" onchange="document.getElementById('fileName').textContent = this.files[0].name">
                <button class="btn-add" style="background:var(--bg-mid); border:1px solid var(--glass-border);" onclick="document.getElementById('subjFile').click()">📁 اختر صورة</button>
                <span id="fileName" style="font-size:12px; color:var(--text-secondary);">لم يتم اختيار ملف</span>
            </div>
            <p style="margin-top:10px; font-size:12px; color:var(--text-secondary);">أو أدخل إيموجي أو رابط صورة:</p>
            <input class="form-control" id="subjIcon" placeholder="📐 أو رابط صورة" dir="ltr">
        </div>`;
    document.getElementById('btnSave').onclick = saveSubject;
    openModal();
}

function editSubject(id) {
    currentEditSubjectId = id;
    const s = allSubjects[id];
    document.getElementById('modalTitle').textContent = 'تعديل المادة';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>اسم المادة</label>
            <input class="form-control" id="subjName" value="${s.name}">
        </div>
        <div class="form-group">
            <label>تغيير الأيقونة (اختياري)</label>
            <div style="display:flex; gap:10px; align-items:center;">
                <input type="file" id="subjFile" accept="image/*" style="display:none;" onchange="document.getElementById('fileName').textContent = this.files[0].name">
                <button class="btn-add" style="background:var(--bg-mid); border:1px solid var(--glass-border);" onclick="document.getElementById('subjFile').click()">📁 اختر صورة جديدة</button>
                <span id="fileName" style="font-size:12px; color:var(--text-secondary);">لا يوجد ملف مختار</span>
            </div>
            <p style="margin-top:10px; font-size:12px; color:var(--text-secondary);">أو عدل الرابط/الإيموجي الحالي:</p>
            <input class="form-control" id="subjIcon" value="${s.icon || ''}" dir="ltr">
        </div>`;
    document.getElementById('btnSave').onclick = saveSubject;
    openModal();
}

async function saveSubject() {
    const name = document.getElementById('subjName').value.trim();
    let icon = document.getElementById('subjIcon').value.trim() || '📘';
    const fileInput = document.getElementById('subjFile');
    
    if (!name) { showToast('يرجى إدخال اسم المادة', 'error'); return; }
    
    const btnSave = document.getElementById('btnSave');
    btnSave.textContent = '⏳ جاري المعالجة...';
    btnSave.disabled = true;

    try {
        // إذا اختار المستخدم ملفاً، نقوم بتحويله لنص (Base64)
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            
            // التأكد من أن حجم الصورة ليس ضخماً جداً (يفضل أقل من 1 ميجا)
            if (file.size > 1024 * 1024) {
                showToast('الصورة كبيرة جداً، يرجى اختيار صورة أقل من 1 ميجابايت', 'error');
                btnSave.textContent = '💾 حفظ';
                btnSave.disabled = false;
                return;
            }

            icon = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            console.log("Image converted to Base64!");
        }

        const id = currentEditSubjectId || name.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();
        const existing = allSubjects[id] || {};
        await FireDB.saveSubject(id, { ...existing, name, icon, units: existing.units || [] });
        
        closeModal();
        await refreshAll();
    } catch (error) {
        console.error("Error saving subject:", error);
        showToast('حدث خطأ أثناء حفظ البيانات.', 'error');
    } finally {
        btnSave.textContent = '💾 حفظ';
        btnSave.disabled = false;
    }
}

async function deleteSubject(id) {
    showConfirm('حذف المادة', `هل أنت متأكد من حذف مادة "${allSubjects[id]?.name}"؟ سيتم حذف جميع الوحدات والدروس المرتبطة بها.`, async () => {
        await FireDB.deleteSubject(id);
        await refreshAll();
        showToast('تم حذف المادة بنجاح', 'success');
    });
}

// ==================== UNITS MANAGEMENT ====================
function manageUnits(subjId) {
    currentEditSubjectId = subjId;
    const s = allSubjects[subjId];
    document.getElementById('modalTitle').textContent = `إدارة وحدات: ${s.name}`;
    let unitsHTML = '<div id="unitsList">';
    if (s.units && s.units.length > 0) {
        s.units.forEach((u, idx) => {
            const lessonCount = u.lessons ? u.lessons.length : 0;
            unitsHTML += `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg-mid); border-radius:8px; margin-bottom:8px;">
                    <div>
                        <strong>📘 ${u.name}</strong>
                        <span style="color:var(--text-secondary); font-size:12px; margin-right:8px;">(${lessonCount} دروس)</span>
                    </div>
                    <div class="action-btns">
                        <button class="action-btn edit" onclick="editUnitName('${subjId}',${idx})" title="تعديل">✏️</button>
                        <button class="action-btn delete" onclick="deleteUnit('${subjId}',${idx})" title="حذف">🗑️</button>
                    </div>
                </div>`;
        });
    } else {
        unitsHTML += '<p style="color:var(--text-secondary); text-align:center;">لا توجد وحدات. أضف وحدة جديدة.</p>';
    }
    unitsHTML += '</div>';
    unitsHTML += `
        <div style="margin-top:16px; display:flex; gap:8px;">
            <input class="form-control" id="newUnitName" placeholder="اسم الوحدة الجديدة" style="flex:1;">
            <button class="btn-add" onclick="addUnit('${subjId}')">➕ إضافة</button>
        </div>`;
    document.getElementById('modalBody').innerHTML = unitsHTML;
    document.getElementById('btnSave').style.display = 'none';
    openModal();
}

async function addUnit(subjId) {
    const name = document.getElementById('newUnitName').value.trim();
    if (!name) { showToast('يرجى إدخال اسم الوحدة', 'error'); return; }
    const s = allSubjects[subjId];
    if (!s.units) s.units = [];
    s.units.push({ name, lessons: [] });
    await FireDB.saveSubject(subjId, s);
    await refreshAll();
    manageUnits(subjId);
}

async function editUnitName(subjId, unitIdx) {
    const newName = prompt('أدخل الاسم الجديد للوحدة:', allSubjects[subjId].units[unitIdx].name);
    if (newName && newName.trim()) {
        allSubjects[subjId].units[unitIdx].name = newName.trim();
        await FireDB.saveSubject(subjId, allSubjects[subjId]);
        await refreshAll();
        manageUnits(subjId);
    }
}

async function deleteUnit(subjId, unitIdx) {
    const unitName = allSubjects[subjId].units[unitIdx].name;
    showConfirm('حذف الوحدة', `هل أنت متأكد من حذف وحدة "${unitName}" وجميع دروسها؟`, async () => {
        allSubjects[subjId].units.splice(unitIdx, 1);
        await FireDB.saveSubject(subjId, allSubjects[subjId]);
        await refreshAll();
        manageUnits(subjId);
        showToast('تم حذف الوحدة', 'success');
    });
}

// ==================== LESSONS MANAGEMENT ====================
function populateSubjectDropdowns() {
    const selectors = ['lessonSubjectSelect', 'quizSubjectSelect'];
    selectors.forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        sel.innerHTML = '<option value="">-- اختر المادة --</option>';
        for (let id in allSubjects) {
            const s = allSubjects[id];
            // إذا كانت الأيقونة صورة (Base64) لا نعرض النص المشفر في القائمة، نعرض فقط الاسم
            const displayIcon = (s.icon && s.icon.startsWith('data:image/')) ? '🖼️' : (s.icon || '📘');
            sel.innerHTML += `<option value="${id}">${displayIcon} ${s.name}</option>`;
        }
    });
}

function onSubjectSelectForLessons() {
    const subjId = document.getElementById('lessonSubjectSelect').value;
    const unitSel = document.getElementById('lessonUnitSelect');
    const container = document.getElementById('lessonsListContainer');
    unitSel.innerHTML = '<option value="">-- اختر الوحدة --</option>';
    container.innerHTML = '';
    if (!subjId || !allSubjects[subjId]) return;
    const s = allSubjects[subjId];
    if (s.units) {
        s.units.forEach((u, idx) => {
            unitSel.innerHTML += `<option value="${idx}">${u.name}</option>`;
        });
    }
}

function onUnitSelectForLessons() {
    const subjId = document.getElementById('lessonSubjectSelect').value;
    const unitIdx = document.getElementById('lessonUnitSelect').value;
    if (!subjId || unitIdx === '') return;
    renderLessonsList(subjId, parseInt(unitIdx));
}

function renderLessonsList(subjId, unitIdx) {
    const container = document.getElementById('lessonsListContainer');
    const unit = allSubjects[subjId]?.units?.[unitIdx];
    if (!unit) { container.innerHTML = ''; return; }
    let html = '';
    if (unit.lessons && unit.lessons.length > 0) {
        unit.lessons.forEach((lesson, lIdx) => {
            html += `
                <tr>
                    <td>${lIdx + 1}</td>
                    <td><strong>${lesson.title}</strong></td>
                    <td>${lesson.text ? '✅' : '❌'}</td>
                    <td>${lesson.video ? '✅' : '❌'}</td>
                    <td>${lesson.quiz && lesson.quiz.length > 0 ? lesson.quiz.length + ' أسئلة' : '❌'}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn edit" onclick="editLesson('${subjId}',${unitIdx},${lIdx})" title="تعديل">✏️</button>
                            <button class="action-btn delete" onclick="deleteLesson('${subjId}',${unitIdx},${lIdx})" title="حذف">🗑️</button>
                        </div>
                    </td>
                </tr>`;
        });
    } else {
        html = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">لا توجد دروس في هذه الوحدة</td></tr>';
    }
    container.innerHTML = html;
}

function showAddLessonModal() {
    const subjId = document.getElementById('lessonSubjectSelect').value;
    const unitIdx = document.getElementById('lessonUnitSelect').value;
    if (!subjId || unitIdx === '') { showToast('اختر المادة والوحدة أولاً', 'error'); return; }
    currentEditSubjectId = subjId;
    currentEditUnitIdx = parseInt(unitIdx);
    currentEditLessonIdx = null;
    document.getElementById('modalTitle').textContent = 'إضافة درس جديد';
    document.getElementById('modalBody').innerHTML = getLessonFormHTML();
    document.getElementById('btnSave').onclick = saveLesson;
    document.getElementById('btnSave').style.display = '';
    openModal();
}

function editLesson(subjId, unitIdx, lessonIdx) {
    currentEditSubjectId = subjId;
    currentEditUnitIdx = unitIdx;
    currentEditLessonIdx = lessonIdx;
    const lesson = allSubjects[subjId].units[unitIdx].lessons[lessonIdx];
    document.getElementById('modalTitle').textContent = 'تعديل الدرس';
    document.getElementById('modalBody').innerHTML = getLessonFormHTML(lesson);
    document.getElementById('btnSave').onclick = saveLesson;
    document.getElementById('btnSave').style.display = '';
    openModal();
}

function getLessonFormHTML(lesson = {}) {
    return `
        <div class="form-group">
            <label>عنوان الدرس *</label>
            <input class="form-control" id="lessonTitle" value="${lesson.title || ''}" placeholder="مثال: المعادلات الخطية">
        </div>
        <div class="form-group">
            <label>محتوى الدرس (النص الكامل) *</label>
            <textarea class="form-control" id="lessonText" rows="8" placeholder="اكتب محتوى الدرس هنا...">${lesson.text || ''}</textarea>
        </div>
        <div class="form-group">
            <label>رابط الفيديو (اختياري)</label>
            <input class="form-control" id="lessonVideo" value="${lesson.video || ''}" placeholder="https://youtube.com/embed/..." dir="ltr">
        </div>
        <div class="form-group">
            <label>ملخص الدرس</label>
            <textarea class="form-control" id="lessonSummary" rows="4" placeholder="ملخص مختصر لأهم النقاط...">${lesson.summary || ''}</textarea>
        </div>`;
}

async function saveLesson() {
    const title = document.getElementById('lessonTitle').value.trim();
    const text = document.getElementById('lessonText').value.trim();
    const video = document.getElementById('lessonVideo').value.trim();
    const summary = document.getElementById('lessonSummary').value.trim();
    if (!title || !text) { showToast('يرجى إدخال عنوان ومحتوى الدرس', 'error'); return; }

    const s = allSubjects[currentEditSubjectId];
    const unit = s.units[currentEditUnitIdx];
    if (!unit.lessons) unit.lessons = [];

    if (currentEditLessonIdx !== null) {
        const existing = unit.lessons[currentEditLessonIdx];
        existing.title = title;
        existing.text = text;
        existing.video = video;
        existing.summary = summary;
    } else {
        const lessonId = currentEditSubjectId + '_u' + currentEditUnitIdx + '_l' + Date.now();
        unit.lessons.push({ id: lessonId, title, text, video, summary, quiz: [] });
    }

    await FireDB.saveSubject(currentEditSubjectId, s);
    closeModal();
    await refreshAll();
    renderLessonsList(currentEditSubjectId, currentEditUnitIdx);
}

async function deleteLesson(subjId, unitIdx, lessonIdx) {
    const lesson = allSubjects[subjId].units[unitIdx].lessons[lessonIdx];
    showConfirm('حذف الدرس', `هل أنت متأكد من حذف درس "${lesson.title}"؟`, async () => {
        allSubjects[subjId].units[unitIdx].lessons.splice(lessonIdx, 1);
        await FireDB.saveSubject(subjId, allSubjects[subjId]);
        await refreshAll();
        renderLessonsList(subjId, unitIdx);
        showToast('تم حذف الدرس بنجاح', 'success');
    });
}

// ==================== QUIZ BUILDER ====================
function onSubjectSelectForQuiz() {
    const subjId = document.getElementById('quizSubjectSelect').value;
    const unitSel = document.getElementById('quizUnitSelect');
    const lessonSel = document.getElementById('quizLessonSelect');
    unitSel.innerHTML = '<option value="">-- اختر الوحدة --</option>';
    lessonSel.innerHTML = '<option value="">-- اختر الدرس --</option>';
    document.getElementById('quizBuilderArea').innerHTML = '';
    if (!subjId || !allSubjects[subjId]) return;
    allSubjects[subjId].units?.forEach((u, idx) => {
        unitSel.innerHTML += `<option value="${idx}">${u.name}</option>`;
    });
}

function onUnitSelectForQuiz() {
    const subjId = document.getElementById('quizSubjectSelect').value;
    const unitIdx = document.getElementById('quizUnitSelect').value;
    const lessonSel = document.getElementById('quizLessonSelect');
    lessonSel.innerHTML = '<option value="">-- اختر الدرس --</option>';
    if (!subjId || unitIdx === '') return;
    const unit = allSubjects[subjId].units[parseInt(unitIdx)];
    unit?.lessons?.forEach((l, idx) => {
        const hasQuiz = l.quiz && l.quiz.length > 0 ? ` (${l.quiz.length} أسئلة)` : '';
        lessonSel.innerHTML += `<option value="${idx}">${l.title}${hasQuiz}</option>`;
    });
}

function onLessonSelectForQuiz() {
    const subjId = document.getElementById('quizSubjectSelect').value;
    const unitIdx = parseInt(document.getElementById('quizUnitSelect').value);
    const lessonIdx = parseInt(document.getElementById('quizLessonSelect').value);
    if (isNaN(lessonIdx)) { document.getElementById('quizBuilderArea').innerHTML = ''; return; }
    const lesson = allSubjects[subjId].units[unitIdx].lessons[lessonIdx];
    quizQuestions = lesson.quiz ? [...lesson.quiz] : [];
    currentEditSubjectId = subjId;
    currentEditUnitIdx = unitIdx;
    currentEditLessonIdx = lessonIdx;
    renderQuizBuilder();
}

function renderQuizBuilder() {
    let html = '<div style="margin-bottom:16px;">';
    if (quizQuestions.length === 0) {
        html += '<p style="text-align:center; color:var(--text-secondary);">لا توجد أسئلة. أضف سؤالاً جديداً.</p>';
    }
    quizQuestions.forEach((q, idx) => {
        html += `
            <div class="quiz-q-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong>السؤال ${idx + 1}</strong>
                    <button class="action-btn delete" onclick="removeQuizQuestion(${idx})">🗑️</button>
                </div>
                <p style="margin-bottom:8px;">${q.q}</p>
                <div class="quiz-options-preview">
                    ${q.options.map((opt, oi) => `<div class="qopt ${oi === q.correct ? 'correct' : ''}">${opt} ${oi === q.correct ? '✅' : ''}</div>`).join('')}
                </div>
            </div>`;
    });
    html += '</div>';
    html += `
        <button class="btn-add" onclick="showAddQuestionModal()" style="width:100%;">➕ إضافة سؤال جديد</button>
        <button class="btn-add" onclick="saveQuiz()" style="width:100%; margin-top:8px; background:var(--teal);">💾 حفظ الاختبار</button>`;
    document.getElementById('quizBuilderArea').innerHTML = html;
}

function showAddQuestionModal() {
    document.getElementById('modalTitle').textContent = 'إضافة سؤال';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>نص السؤال *</label>
            <input class="form-control" id="questionText" placeholder="اكتب السؤال هنا...">
        </div>
        <div class="form-group">
            <label>الإجابة الأولى</label>
            <input class="form-control" id="opt0" placeholder="الخيار الأول">
        </div>
        <div class="form-group">
            <label>الإجابة الثانية</label>
            <input class="form-control" id="opt1" placeholder="الخيار الثاني">
        </div>
        <div class="form-group">
            <label>الإجابة الثالثة</label>
            <input class="form-control" id="opt2" placeholder="الخيار الثالث">
        </div>
        <div class="form-group">
            <label>الإجابة الرابعة</label>
            <input class="form-control" id="opt3" placeholder="الخيار الرابع">
        </div>
        <div class="form-group">
            <label>الإجابة الصحيحة</label>
            <select class="form-control" id="correctAnswer">
                <option value="0">الإجابة الأولى</option>
                <option value="1">الإجابة الثانية</option>
                <option value="2">الإجابة الثالثة</option>
                <option value="3">الإجابة الرابعة</option>
            </select>
        </div>`;
    document.getElementById('btnSave').onclick = addQuizQuestion;
    document.getElementById('btnSave').style.display = '';
    openModal();
}

function addQuizQuestion() {
    const q = document.getElementById('questionText').value.trim();
    const options = [
        document.getElementById('opt0').value.trim(),
        document.getElementById('opt1').value.trim(),
        document.getElementById('opt2').value.trim(),
        document.getElementById('opt3').value.trim()
    ];
    const correct = parseInt(document.getElementById('correctAnswer').value);
    if (!q || options.some(o => !o)) { showToast('يرجى ملء جميع الحقول', 'error'); return; }
    quizQuestions.push({ q, options, correct });
    closeModal();
    renderQuizBuilder();
}

function removeQuizQuestion(idx) {
    showConfirm('حذف السؤال', 'هل أنت متأكد من حذف هذا السؤال من الاختبار؟', () => {
        quizQuestions.splice(idx, 1);
        renderQuizBuilder();
        showToast('تم إزالة السؤال', 'info');
    });
}

async function saveQuiz() {
    if (quizQuestions.length === 0) { alert('أضف سؤالاً واحداً على الأقل'); return; }
    const s = allSubjects[currentEditSubjectId];
    s.units[currentEditUnitIdx].lessons[currentEditLessonIdx].quiz = [...quizQuestions];
    await FireDB.saveSubject(currentEditSubjectId, s);
    showToast('تم حفظ الاختبار بنجاح! (' + quizQuestions.length + ' أسئلة)', 'success');
    await refreshAll();
}

// ==================== USERS ====================
async function loadUsers() {
    try {
        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
        const list = document.getElementById('usersAdminList');
        if (!list) return;
        list.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            const roleBadge = user.role === 'admin' ? 'badge-blue' : 'badge-teal';
            const roleText = user.role === 'admin' ? 'مدير' : 'طالب';
            list.innerHTML += `
                <tr>
                    <td>${user.name || 'بدون اسم'}</td>
                    <td>${user.email}</td>
                    <td><span class="badge ${roleBadge}">${roleText}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn" title="تغيير الرتبة" onclick="toggleUserRole('${doc.id}','${user.role}')">🔄</button>
                            <button class="action-btn delete" title="حذف" onclick="deleteUser('${doc.id}')">🗑️</button>
                        </div>
                    </td>
                </tr>`;
        });
    } catch (e) { console.error("Error loading users:", e); }
}

async function toggleUserRole(uid, currentRole) {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    showConfirm('تغيير الرتبة', `هل تريد حقاً تغيير رتبة المستخدم إلى ${newRole === 'admin' ? 'مدير' : 'طالب'}؟`, async () => {
        await db.collection('users').doc(uid).update({ role: newRole });
        loadUsers();
        showToast('تم تحديث الرتبة بنجاح', 'success');
    });
}

async function deleteUser(uid) {
    showConfirm('حذف مستخدم', 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟ لا يمكن التراجع عن هذا الفعل.', async () => {
        await db.collection('users').doc(uid).delete();
        loadUsers();
        showToast('تم حذف المستخدم', 'success');
    });
}

// ==================== MODAL ====================
function openModal() {
    document.getElementById('modalOverlay').style.display = 'flex';
}
function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('btnSave').style.display = '';
}

// ==================== EXPORT ====================
function exportData() {
    const data = JSON.stringify(allSubjects, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'academy_data.json'; a.click();
}

// ==================== LOGOUT ====================
async function logout() {
    showConfirm('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة التحكم؟', async () => {
        await AuthService.logout();
        window.location.href = 'login.html';
    });
}

// ==================== FEEDBACK ====================
async function loadFeedback() {
    try {
        const snapshot = await db.collection('feedback').orderBy('createdAt', 'desc').get();
        const list = document.getElementById('feedbackList');
        const empty = document.getElementById('feedbackEmpty');
        if (!list) return;
        list.innerHTML = '';

        if (snapshot.empty) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        snapshot.forEach(doc => {
            const f = doc.data();
            const date = f.createdAt ? new Date(f.createdAt.toDate()).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'غير محدد';
            const readBadge = f.read ? '<span style="color:var(--teal); font-size:11px;">✅ تمت المراجعة</span>' : '<span style="color:#f59e0b; font-size:11px;">⚠️ جديدة</span>';

            list.innerHTML += `
                <div style="background:var(--bg-mid); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:16px; margin-bottom:12px; ${!f.read ? 'border-right:3px solid #f59e0b;' : ''}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <strong style="color:var(--text-primary);">🧑‍🎓 ${f.studentName || 'طالب'}</strong>
                            <span style="font-size:11px; color:var(--text-secondary); margin-right:8px;">• ${date}</span>
                        </div>
                        ${readBadge}
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">ملاحظة على درس: <span style="color:var(--blue-glow);">${f.lessonTitle || 'غير محدد'}</span></div>
                    <p style="background:var(--bg-card); padding:12px; border-radius:8px; font-size:14px; line-height:1.8; color:var(--text-primary);">${f.message}</p>
                    ${!f.read ? `<button onclick="markFeedbackRead('${doc.id}')" style="margin-top:8px; padding:6px 16px; border-radius:8px; background:var(--teal); border:none; color:white; font-weight:700; cursor:pointer; font-size:12px;">✅ تم الاطلاع</button>` : ''}
                </div>
            `;
        });
    } catch (e) {
        console.error('خطأ في تحميل الملاحظات:', e);
    }
}

async function markFeedbackRead(docId) {
    await db.collection('feedback').doc(docId).update({ read: true });
    loadFeedback();
}
