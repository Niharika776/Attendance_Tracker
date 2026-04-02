const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();

app.use(express.json());

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, error: "Username and password required" });
    try {
        const existing = await db.findUserByUsername(username);
        if (existing) return res.status(400).json({ success: false, error: "Username already taken" });
        const newUser = await db.createUser({ username, password });
        res.json({ success: true, userId: newUser.id });
    } catch (err) {
        console.error("Signup error:", err.message);
        res.status(500).json({ success: false, error: "Signup failed" });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, error: "Username and password required" });
    try {
        const user = await db.verifyUser(username, password);
        if (user) res.json({ success: true, userId: user.id });
        else res.status(401).json({ success: false, error: "Invalid credentials" });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ success: false, error: "Login failed" });
    }
});

app.get('/api/load-data', async (req, res) => {
    const userId = parseInt(req.query.userId);
    if (!userId || isNaN(userId))
        return res.json({ subjects: [], attendance: [], semesterStart: null, semesterEnd: null });
    try {
        const subjects = await db.getSubjects(userId);
        const attendance = await db.getAttendance(userId);
        const sem = await db.getSemester(userId);
        res.json({ subjects, attendance, semesterStart: sem?.start || null, semesterEnd: sem?.end || null });
    } catch (err) {
        console.error("Load error:", err.message);
        res.status(500).json({ error: "Load failed" });
    }
});

app.post('/api/save-attendance', async (req, res) => {
    const userId = parseInt(req.body.userId);
    if (!userId || isNaN(userId))
        return res.status(400).json({ error: "Invalid userId" });
    const { subjects, attendance, semesterStart, semesterEnd } = req.body;
    try {
        if (subjects && subjects.length > 0)
            await db.updateUserSchedule(userId, subjects);
        if (semesterStart && semesterEnd)
            await db.saveSemester(userId, semesterStart, semesterEnd);
        if (attendance && Object.keys(attendance).length > 0)
            await db.syncAttendanceLogs(userId, attendance);
        res.json({ success: true });
    } catch (err) {
        console.error("Save error:", err.message);
        res.status(500).json({ error: "Sync failed" });
    }
});

app.delete('/api/delete-subject', async (req, res) => {
    const userId = parseInt(req.body.userId);
    const { subjectName } = req.body;
    if (!userId || !subjectName)
        return res.status(400).json({ error: "userId and subjectName required" });
    try {
        await db.deleteSubject(userId, subjectName);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err.message);
        res.status(500).json({ error: "Delete failed" });
    }
});

// ⚠️ Static files - but NO default index.html
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));