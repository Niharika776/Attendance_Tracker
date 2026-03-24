const dateList = document.getElementById('dateList');
let attendanceData = JSON.parse(localStorage.getItem('attendance')) || {};

// Generate last 14 days for the demo
function init() {
    for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const div = document.createElement('div');
        div.className = 'date-item';
        div.innerHTML = `
            <span>${dateStr}</span>
            <select onchange="updateStatus('${dateStr}', this.value)">
                <option value="Present" ${attendanceData[dateStr] === 'Present' ? 'selected' : ''}>Present</option>
                <option value="Absent" ${attendanceData[dateStr] === 'Absent' ? 'selected' : ''}>Absent</option>
            </select>
        `;
        dateList.appendChild(div);
    }
    updateChart();
}

function updateStatus(date, status) {
    attendanceData[date] = status;
}

function saveToLocal() {
    localStorage.setItem('attendance', JSON.stringify(attendanceData));
    updateChart();
    alert("Saved to LocalStorage!");
}

function updateChart() {
    const vals = Object.values(attendanceData);
    const present = vals.filter(v => v === 'Present').length;
    const total = vals.length || 1;
    document.getElementById('percentageText').innerText = ((present/total)*100).toFixed(1) + "%";
}

init();