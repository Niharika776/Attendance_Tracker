const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // Import the PostgreSQL driver 
const app = express();
const PORT = 3000;

// 1. DATABASE CONNECTION CONFIG
// Replace 'your_password' with the password you set during installation!
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'attendance_db',
    password: 'niharika11', 
    port: 5432,
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- DATABASE API ROUTES ---

// 2. SAVE DATA: Receives attendance from Frontend and saves to Postgres
app.post('/api/save-attendance', async (req, res) => {
    const { attendance, subjects } = req.body;
    try {
        // Sync subjects
        for (const sub of subjects) {
            await pool.query(
                'INSERT INTO subjects (name, class_days) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET class_days = $2',
                [sub.name, sub.days]
            );
        }

        // Sync attendance logs
        for (const [key, status] of Object.entries(attendance)) {
            if (key === 'lastUpdated') continue;

            // FIX: Correctly extract the date and subject name
            // If key is "2026-03-31-Maths", this gets "2026-03-31" and "Maths"
            const lastHyphenIndex = key.lastIndexOf('-');
            const dateStr = key.substring(0, lastHyphenIndex);
            const subName = key.substring(lastHyphenIndex + 1);
            
            if (!dateStr || !subName) continue;

            await pool.query(
                'INSERT INTO attendance_logs (date, subject_name, status) VALUES ($1, $2, $3) ON CONFLICT (date, subject_name) DO UPDATE SET status = $3',
                [dateStr, subName, status]
            );
        }
        res.json({ success: true, message: "Saved to PostgreSQL!" });
    } catch (err) {
        console.error("Database Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. LOAD DATA: Pulls everything from Postgres for the Frontend
app.get('/api/load-data', async (req, res) => {
    try {
        const subs = await pool.query('SELECT name, class_days as days FROM subjects');
        const logs = await pool.query('SELECT date, subject_name, status FROM attendance_logs');
        
        res.json({
            subjects: subs.rows,
            attendance: logs.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

// Default Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
    console.log(`✅ Server connected to DB and running at http://localhost:3000`);
});