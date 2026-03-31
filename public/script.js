let config = { subjects: [], cancelMode: 'holiday' };
let attendanceData = { lastUpdated: {} };
let globalChart = null;

// --- 1. INITIALIZATION (FETCH FROM DATABASE) ---
async function init() {
    try {
        const response = await fetch('/api/load-data');
        const data = await response.json();

        if (data.subjects && data.subjects.length > 0) {
            // Transform database rows back into our app's format
            config.subjects = data.subjects;
            
            // Reconstruct attendanceData object from array of logs
            attendanceData = { lastUpdated: {} };
            data.attendance.forEach(log => {
                const dateStr = new Date(log.date).toISOString().split('T')[0];
                const key = `${dateStr}-${log.subject_name}`;
                attendanceData[key] = log.status;
            });

            renderDashboard();
        } else {
            showSetupWizard();
        }
    } catch (err) {
        console.error("Failed to load from DB:", err);
        // Fallback to Wizard if DB is empty or unreachable
        showSetupWizard();
    }
}

// --- 2. SETUP WIZARD ---
function showSetupWizard() {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="log-card wizard-card">
            <h2>🌸 Semester Setup</h2>
            <p>Your settings will now be saved to PostgreSQL.</p>
            <div id="subjectInputList"></div>
            <button onclick="addSubjectInput()" style="background: var(--pastel-pink); margin: 10px 0;">+ Add Subject</button>
            <button onclick="saveSetup()" style="background: var(--pastel-green); width: 100%; margin-top: 20px;">Save to Database</button>
        </div>
    `;
    addSubjectInput();
}

function addSubjectInput() {
    const list = document.getElementById('subjectInputList');
    const div = document.createElement('div');
    div.className = 'subject-entry';
    div.innerHTML = `
        <input type="text" placeholder="Subject Name" class="sub-name" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #ddd;">
        <div class="days-selection">
            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => `
                <label class="day-checkbox"><input type="checkbox" value="${i}"> ${day}</label>
            `).join('')}
        </div>
    `;
    list.appendChild(div);
}

// --- 3. SYNCING TO DATABASE (POST REQUEST) ---
async function saveSetup() {
    const entries = document.querySelectorAll('.subject-entry');
    config.subjects = [];
    entries.forEach(entry => {
        const name = entry.querySelector('.sub-name').value;
        const days = Array.from(entry.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        if (name) config.subjects.push({ name, days });
    });

    if (config.subjects.length > 0) {
        await syncWithDatabase();
        location.reload();
    } else {
        alert("Please add at least one subject!");
    }
}

async function syncWithDatabase() {
    try {
        const response = await fetch('/api/save-attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attendance: attendanceData,
                subjects: config.subjects
            })
        });
        const result = await response.json();
        console.log(result.message);
    } catch (err) {
        console.error("Sync failed:", err);
        alert("Could not save to Database. Check your server terminal.");
    }
}

// --- 4. DASHBOARD & INTERACTION ---
function renderDashboard() {
    updateGlobalStats();
    const dash = document.getElementById('mainDashboard');
    dash.innerHTML = '';

    config.subjects.forEach(sub => {
        const stats = calculateSubjectStats(sub.name);
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-header"><h3>${sub.name}</h3></div>
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
                    <select onchange="markStatus('${key}', this.value)">
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
    return { present, total, percent: total === 0 ? 100 : Math.round((present / total) * 100) };
}

async function markStatus(key, status) {
    attendanceData[key] = status;
    // Every time you change a status, we sync to the DB!
    await syncWithDatabase(); 
    renderDashboard();
}

function updateGlobalStats() {
    let tP = 0, tC = 0;
    config.subjects.forEach(s => { const st = calculateSubjectStats(s.name); tP += st.present; tC += st.total; });
    const percent = tC === 0 ? 100 : Math.round((tP / tC) * 100);
    document.getElementById('globalPercentageText').innerText = percent + "%";
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

function resetSetup() { 
    if(confirm("Permanently clear database?")) { 
        // We will implement a DELETE route later if needed
        localStorage.clear(); 
        location.reload(); 
    } 
}

init();