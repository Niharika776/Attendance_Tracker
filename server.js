const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'banasthali_attendance_secret_key_2026';

app.use(express.json());

// ── Middleware: Verify JWT ────────────────────────────────────────────────────
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token)
        return res.status(401).json({ success: false, error: "Access denied. Please login." });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.username = decoded.username;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, error: "Invalid or expired token. Please login again." });
    }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, error: "Username and password required" });
    if (username.length < 3)
        return res.status(400).json({ success: false, error: "Username must be at least 3 characters" });
    if (password.length < 4)
        return res.status(400).json({ success: false, error: "Password must be at least 4 characters" });
    try {
        const existing = await db.findUserByUsername(username);
        if (existing)
            return res.status(400).json({ success: false, error: "Username already taken" });
        const newUser = await db.createUser({ username, password });
        const token = jwt.sign(
            { userId: newUser.id, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ success: true, token, username });
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
        if (!user)
            return res.status(401).json({ success: false, error: "Invalid username or password" });
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.json({ success: true, token, username: user.username });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ success: false, error: "Login failed" });
    }
});

// ── Protected Routes (JWT required) ──────────────────────────────────────────

app.get('/api/load-data', verifyToken, async (req, res) => {
    try {
        const subjects   = await db.getSubjects(req.userId);
        const attendance = await db.getAttendance(req.userId);
        const sem        = await db.getSemester(req.userId);
        res.json({
            subjects,
            attendance,
            semesterStart: sem ? sem.start : null,
            semesterEnd:   sem ? sem.end   : null
        });
    } catch (err) {
        console.error("Load error:", err.message);
        res.status(500).json({ error: "Load failed" });
    }
});

app.post('/api/save-attendance', verifyToken, async (req, res) => {
    const { subjects, attendance, semesterStart, semesterEnd } = req.body;
    try {
        if (subjects && subjects.length > 0)
            await db.updateUserSchedule(req.userId, subjects);
        if (semesterStart && semesterEnd)
            await db.saveSemester(req.userId, semesterStart, semesterEnd);
        if (attendance && Object.keys(attendance).length > 0)
            await db.syncAttendanceLogs(req.userId, attendance);
        res.json({ success: true });
    } catch (err) {
        console.error("Save error:", err.message);
        res.status(500).json({ error: "Sync failed" });
    }
});

app.delete('/api/delete-subject', verifyToken, async (req, res) => {
    const { subjectName } = req.body;
    if (!subjectName)
        return res.status(400).json({ error: "subjectName required" });
    try {
        await db.deleteSubject(req.userId, subjectName);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete error:", err.message);
        res.status(500).json({ error: "Delete failed" });
    }
});

// ── Pages ─────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));