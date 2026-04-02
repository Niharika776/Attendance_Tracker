let config = { subjects: [], semesterStart: null, semesterEnd: null };
let attendanceData = {};
let globalChart = null;

const token    = localStorage.getItem('attendance_token');
const username = localStorage.getItem('attendance_username') || 'User';

// ── Guard ─────────────────────────────────────────────────────────────────────
if (window.location.pathname !== '/dashboard') {
    // on login page — do nothing
} else {
    if (!token || token === 'null') {
        window.location.href = '/';
    } else {
        const nameEl = document.getElementById('usernameDisplay');
        if (nameEl) nameEl.textContent = `👤 ${username}`;
        init();
    }
}

// Helper: all fetch calls now send JWT in Authorization header
function authFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    try {
        const res = await authFetch('/api/load-data');

        // Token expired or invalid
        if (res.status === 401 || res.status === 403) {
            logout();
            return;
        }

        const data = await res.json();
        if (data.subjects && data.subjects.length > 0) {
            config.subjects      = data.subjects;
            config.semesterStart = data.semesterStart;
            config.semesterEnd   = data.semesterEnd;
            data.attendance.forEach(log => {
                const dateStr = new Date(log.date).toISOString().split('T')[0];
                attendanceData[`${dateStr}-${log.subject_name}`] = log.status;
            });
            renderDashboard();
            updateStatus('✅ Synced with database');
        } else {
            showSetupWizard();
        }
    } catch (err) {
        console.error('Init failed:', err);
        updateStatus('⚠️ Could not connect to server');
        showSetupWizard();
    }
}

function updateStatus(msg) {
    const el = document.getElementById('statusMessage');
    if (el) el.textContent = msg;
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────
function showSetupWizard() {
    const container = document.querySelector('.container');
    const today = new Date().toISOString().split('T')[0];
    container.innerHTML = `
        <div class="wizard-card">
            <div class="wizard-header">
                <p class="org-label">Banasthali Vidyapith | IT Department</p>
                <h1>Semester Setup</h1>
                <p class="wizard-subtitle">Welcome, <strong>${username}</strong>! Set up your semester to get started.</p>
            </div>
            <div class="semester-range">
                <h3>📅 Semester Duration</h3>
                <div class="date-range-row">
                    <div class="date-field">
                        <label>Start Date</label>
                        <input type="date" id="semStart" value="${today}">
                    </div>
                    <div class="date-field">
                        <label>End Date</label>
                        <input type="date" id="semEnd">
                    </div>
                </div>
            </div>
            <div class="subjects-section">
                <h3>📚 Subjects</h3>
                <div id="subjectList"></div>
                <button class="btn-secondary" onclick="addInput()">+ Add Subject</button>
            </div>
            <div class="wizard-actions">
                <button class="btn-primary" onclick="saveSetup()">Launch Dashboard →</button>
            </div>
            <p style="text-align:right; margin-top:16px;">
                <span style="font-size:0.8rem; color:#aaa; cursor:pointer;" onclick="logout()">← Logout</span>
            </p>
        </div>`;
    addInput();
}

function addInput() {
    const list = document.getElementById('subjectList');
    const div = document.createElement('div');
    div.className = 'subject-entry';
    div.innerHTML = `
        <div class="entry-header">
            <input type="text" class="sub-name" placeholder="Subject Name (e.g. DBMS, OS, CN)">
            <button class="btn-remove" onclick="this.closest('.subject-entry').remove()">✕</button>
        </div>
        <div class="day-grid">
            ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `
                <label class="day-label">
                    <input type="checkbox" value="${i}">
                    <span>${d}</span>
                </label>
            `).join('')}
        </div>`;
    list.appendChild(div);
    requestAnimationFrame(() => div.classList.add('visible'));
}

async function saveSetup() {
    const semStart = document.getElementById('semStart').value;
    const semEnd   = document.getElementById('semEnd').value;
    if (!semStart || !semEnd) { alert('Please set both semester start and end dates.'); return; }
    if (semEnd <= semStart)   { alert('End date must be after start date.'); return; }

    const subjects = [];
    document.querySelectorAll('.subject-entry').forEach(el => {
        const name = el.querySelector('.sub-name').value.trim();
        const days = Array.from(el.querySelectorAll('input[type=checkbox]:checked')).map(cb => parseInt(cb.value));
        if (name) subjects.push({ name, days });
    });
    if (subjects.length === 0) { alert('Please add at least one subject.'); return; }

    const btn = document.querySelector('.btn-primary');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    const response = await authFetch('/api/save-attendance', {
        method: 'POST',
        body: JSON.stringify({ attendance: {}, subjects, semesterStart: semStart, semesterEnd: semEnd })
    });

    if (response.ok) {
        window.location.href = '/dashboard';
    } else {
        alert('Database error: failed to save. Check your server terminal.');
        btn.textContent = 'Launch Dashboard →';
        btn.disabled = false;
    }
}

// ── Sync ──────────────────────────────────────────────────────────────────────
async function sync() {
    try {
        const response = await authFetch('/api/save-attendance', {
            method: 'POST',
            body: JSON.stringify({
                attendance:    attendanceData,
                subjects:      config.subjects,
                semesterStart: config.semesterStart,
                semesterEnd:   config.semesterEnd
            })
        });
        if (response.status === 401 || response.status === 403) { logout(); return false; }
        if (response.ok) updateStatus('✅ Saved');
        else updateStatus('⚠️ Save failed');
        return response.ok;
    } catch (err) {
        updateStatus('⚠️ Offline — changes not saved');
        return false;
    }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
    const dash = document.getElementById('mainDashboard');
    if (!dash) return;

    let semesterBar = '';
    if (config.semesterStart && config.semesterEnd) {
        const start    = new Date(config.semesterStart).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        const end      = new Date(config.semesterEnd).toLocaleDateString('en-IN',   { day:'numeric', month:'short', year:'numeric' });
        const today    = new Date(); today.setHours(0,0,0,0);
        const daysLeft = Math.ceil((new Date(config.semesterEnd) - today) / (1000*60*60*24));
        const daysText = daysLeft > 0 ? `${daysLeft} days remaining` : 'Semester ended';
        const cls      = daysLeft <= 0 ? 'ended' : daysLeft <= 14 ? 'warning' : '';
        semesterBar = `
        <div class="semester-bar">
            <span>📅 <strong>${start}</strong> → <strong>${end}</strong></span>
            <span class="days-left ${cls}">${daysText}</span>
        </div>`;
    }

    dash.innerHTML = semesterBar + config.subjects.map(sub => {
        const stats       = calculateStats(sub.name);
        const color       = stats.percent >= 75 ? 'var(--pastel-green)' : 'var(--pastel-pink)';
        const statusLabel = stats.percent >= 75 ? '✓ Safe' : '⚠ Low';
        return `
        <div class="subject-card">
            <div class="subject-header">
                <h3>${sub.name}</h3>
                <button class="btn-delete" onclick="deleteSubject('${sub.name}')">🗑</button>
            </div>
            <div class="calendar-container">
                <div class="subject-status-lead" style="background:${color}">
                    <span class="value">${stats.percent}%</span>
                    <span class="label">${statusLabel}</span>
                    <span class="sub-label">${stats.present}/${stats.total} classes</span>
                </div>
                <div class="calendar-strip">${generateDates(sub)}</div>
            </div>
        </div>`;
    }).join('');

    updateGlobal();
}

function generateDates(sub) {
    let html = '';
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const semStart = config.semesterStart ? new Date(config.semesterStart) : null;
    const semEnd   = config.semesterEnd   ? new Date(config.semesterEnd)   : null;
    if (!semStart || !semEnd) return '<p style="color:#aaa;font-size:0.8rem;padding:10px;">No semester set.</p>';

    const today = new Date(); today.setHours(0,0,0,0);
    const effectiveEnd = semEnd < today ? semEnd : today;
    if (effectiveEnd < semStart) return '<p style="color:#aaa;font-size:0.8rem;padding:10px;">Semester has not started yet.</p>';

    const dates = [];
    for (let d = new Date(effectiveEnd); d >= semStart; d.setDate(d.getDate()-1)) {
        dates.push(new Date(d));
        if (dates.length >= 30) break;
    }

    for (const d of dates) {
        if (!sub.days.includes(d.getDay())) continue;
        const dateStr = d.toISOString().split('T')[0];
        const key     = `${dateStr}-${sub.name}`;
        const status  = attendanceData[key] || 'None';
        html += `
        <div class="date-chip ${status.toLowerCase()}">
            <span class="day-name">${dayNames[d.getDay()]}</span>
            <span class="date-num">${d.getDate()}</span>
            <select class="status-select" onchange="mark('${key}', this.value)">
                <option value="None"      ${status==='None'      ?'selected':''}>–</option>
                <option value="Present"   ${status==='Present'   ?'selected':''}>P</option>
                <option value="Absent"    ${status==='Absent'    ?'selected':''}>A</option>
                <option value="Cancelled" ${status==='Cancelled' ?'selected':''}>C</option>
            </select>
        </div>`;
    }
    return html || '<p style="color:#aaa;font-size:0.8rem;padding:10px;">No class days in semester range yet.</p>';
}

function calculateStats(subName) {
    const records = Object.keys(attendanceData).filter(k => k.substring(11) === subName).map(k => attendanceData[k]);
    const present = records.filter(v => v === 'Present').length;
    const total   = records.filter(v => v === 'Present' || v === 'Absent').length;
    return { percent: total === 0 ? 100 : Math.round((present/total)*100), present, total };
}

async function mark(key, val) {
    attendanceData[key] = val;
    renderDashboard();
    await sync();
}

async function deleteSubject(subName) {
    if (!confirm(`Delete "${subName}" and all its records?`)) return;
    config.subjects = config.subjects.filter(s => s.name !== subName);
    Object.keys(attendanceData).forEach(k => { if (k.substring(11) === subName) delete attendanceData[k]; });
    await authFetch('/api/delete-subject', {
        method: 'DELETE',
        body: JSON.stringify({ subjectName: subName })
    });
    await sync();
    renderDashboard();
}

function updateGlobal() {
    let tP = 0, tT = 0;
    config.subjects.forEach(s => { const st = calculateStats(s.name); tP += st.present; tT += st.total; });
    const percent = tT === 0 ? 100 : Math.round((tP/tT)*100);
    const el = document.getElementById('globalPercentageText');
    if (el) el.textContent = percent + '%';
    updateStatus(percent >= 75 ? '✅ Attendance looks good!' : '⚠️ Below 75% — take action!');
    renderChart(percent);
}

function renderChart(percent) {
    const canvas = document.getElementById('globalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (globalChart) globalChart.destroy();
    globalChart = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [percent, 100-percent], backgroundColor: [percent >= 75 ? '#a2d2ff' : '#ffafcc', '#eee'], borderWidth: 0, circumference: 180, rotation: 270 }] },
        options: { cutout: '78%', plugins: { tooltip: { enabled: false }, legend: { display: false } }, animation: { duration: 800 } }
    });
}

function logout() {
    localStorage.removeItem('attendance_token');
    localStorage.removeItem('attendance_username');
    window.location.href = '/';
}