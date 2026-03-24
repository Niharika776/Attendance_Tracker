let config = JSON.parse(localStorage.getItem('attendanceConfig')) || { subjects: [], cancelMode: 'holiday' };
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || { lastUpdated: {} }; // Added lastUpdated tracker
let globalChart = null;

function init() {
    if (config.subjects.length === 0) {
        showSetupWizard();
    } else {
        renderDashboard();
    }
}

// --- SETUP WIZARD ---
function showSetupWizard() {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="log-card wizard-card">
            <h2>🌸 Semester Setup</h2>
            <p>Define your subjects and their weekly schedules.</p>
            <div style="margin: 20px 0;">
                <label>Cancelled classes count as: 
                    <select id="cancelMode" style="padding: 8px; border-radius: 8px;">
                        <option value="holiday">Holiday (Neutral)</option>
                        <option value="absent">Absent (Decreases %)</option>
                    </select>
                </label>
            </div>
            <div id="subjectInputList"></div>
            <button onclick="addSubjectInput()" style="background: var(--pastel-pink); margin-top: 10px;">+ Add Subject</button>
            <button onclick="saveSetup()" style="background: var(--pastel-green); width: 100%; margin-top: 20px; font-size: 1.1rem;">Launch Dashboard</button>
        </div>
    `;
    addSubjectInput();
}

function addSubjectInput() {
    const list = document.getElementById('subjectInputList');
    const div = document.createElement('div');
    div.className = 'subject-entry';
    div.innerHTML = `
        <input type="text" placeholder="Subject Name (e.g. DBMS)" class="sub-name" style="width:100%; padding:12px; margin-bottom:12px; border-radius:10px; border:1px solid #ddd;">
        <div class="days-selection">
            <p style="font-size: 0.8rem; font-weight: bold; margin-bottom: 5px; color: #888;">Select Class Days:</p>
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => `
                <label class="day-checkbox">
                    <input type="checkbox" value="${i}"> ${day}
                </label>
            `).join('')}
        </div>
    `;
    list.appendChild(div);
}

function saveSetup() {
    const entries = document.querySelectorAll('.subject-entry');
    config.cancelMode = document.getElementById('cancelMode').value;
    config.subjects = [];
    entries.forEach(entry => {
        const name = entry.querySelector('.sub-name').value;
        const days = Array.from(entry.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        if (name) config.subjects.push({ name, days });
    });
    if (config.subjects.length > 0) {
        localStorage.setItem('attendanceConfig', JSON.stringify(config));
        location.reload();
    } else {
        alert("Please add at least one subject name!");
    }
}

// --- DASHBOARD RENDERING ---
function renderDashboard() {
    updateGlobalStats();
    const dash = document.getElementById('mainDashboard');
    dash.innerHTML = '';

    config.subjects.forEach(sub => {
        const stats = calculateSubjectStats(sub.name);
        const lastMod = (attendanceData.lastUpdated && attendanceData.lastUpdated[sub.name]) ? attendanceData.lastUpdated[sub.name] : 'Never';
        
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-header"><h3>${sub.name}</h3></div>
            <span class="last-updated">Last Logged: ${lastMod}</span>
            <div class="calendar-container">
                <div class="subject-status-lead" style="background: ${stats.percent >= 75 ? 'var(--pastel-green)' : 'var(--pastel-pink)'}">
                    <span class="label">Current</span>
                    <span class="value">${stats.percent}%</span>
                    <small>${stats.present}/${stats.total}</small>
                </div>
                <div class="calendar-strip">${generateDateStrip(sub)}</div>
            </div>
        `;
        dash.appendChild(card);
    });
}

function generateDateStrip(sub) {
    let html = '';
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const key = `${dateStr}-${sub.name}`;
        const status = attendanceData[key] || 'None';
        const isClassDay = sub.days.includes(d.getDay());

        if (isClassDay) {
            html += `
                <div class="date-chip ${status.toLowerCase()}">
                    <span class="day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span class="date-num">${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <select onchange="markStatus('${key}', '${sub.name}', this.value)">
                        <option value="None" ${status === 'None' ? 'selected' : ''}>-</option>
                        <option value="Present" ${status === 'Present' ? 'selected' : ''}>P</option>
                        <option value="Absent" ${status === 'Absent' ? 'selected' : ''}>A</option>
                        <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>C</option>
                    </select>
                </div>`;
        } else {
            html += `<div class="date-chip no-class">
                <span class="day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span class="date-num">${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}</span>
                <div style="font-size:0.6rem; color:#ccc; margin-top:10px; font-weight:bold;">OFF</div>
            </div>`;
        }
    }
    return html;
}

function calculateSubjectStats(subjectName) {
    const records = Object.keys(attendanceData).filter(k => k.endsWith(subjectName)).map(k => attendanceData[k]);
    const present = records.filter(v => v === 'Present').length;
    let total = records.filter(v => v === 'Present' || v === 'Absent').length;
    if (config.cancelMode === 'absent') total += records.filter(v => v === 'Cancelled').length;
    return { present, total, percent: total === 0 ? 100 : Math.round((present / total) * 100) };
}

function markStatus(key, subjectName, status) {
    attendanceData[key] = status;
    
    // Update the timestamp for this specific subject
    if (!attendanceData.lastUpdated) attendanceData.lastUpdated = {};
    const now = new Date();
    attendanceData.lastUpdated[subjectName] = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    renderDashboard();
}

function updateGlobalStats() {
    let tP = 0, tC = 0;
    config.subjects.forEach(s => { const st = calculateSubjectStats(s.name); tP += st.present; tC += st.total; });
    const percent = tC === 0 ? 100 : Math.round((tP / tC) * 100);
    document.getElementById('globalPercentageText').innerText = percent + "%";
    const msg = document.getElementById('statusMessage');
    msg.innerText = percent >= 75 ? "Eligible for Exams! ✨" : "Low Attendance! ⚠️";
    msg.style.color = percent >= 75 ? "#77dd77" : "#ff6961";
    renderGlobalChart(percent);
}

function renderGlobalChart(percent) {
    const ctx = document.getElementById('globalChart').getContext('2d');
    if (globalChart) globalChart.destroy();
    globalChart = new Chart(ctx, {
        type: 'doughnut', data: { datasets: [{ data: [percent, 100 - percent], backgroundColor: ['#a2d2ff', '#eee'], borderWidth: 0, circumference: 180, rotation: 270 }] },
        options: { cutout: '85%', responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }
    });
}

function resetSetup() { if(confirm("This will clear all subjects and attendance. Continue?")) { localStorage.clear(); location.reload(); } }

init();