const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'attendance_db',
    password: 'niharika11',
    port: 5432,
});

module.exports = {
    findUserByUsername: async (username) => {
        const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return res.rows[0];
    },

    createUser: async ({ username, password }) => {
        const res = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
            [username, password]
        );
        return res.rows[0];
    },

    verifyUser: async (username, password) => {
        const res = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );
        return res.rows[0];
    },

    getSemester: async (userId) => {
        const res = await pool.query('SELECT start_date, end_date FROM semester WHERE user_id = $1', [userId]);
        if (res.rows[0]) return { start: res.rows[0].start_date, end: res.rows[0].end_date };
        return null;
    },

    saveSemester: async (userId, start, end) => {
        await pool.query(`
            INSERT INTO semester (user_id, start_date, end_date)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET start_date = $2, end_date = $3`,
            [userId, start, end]
        );
    },

    getSubjects: async (userId) => {
        const res = await pool.query('SELECT name, days FROM subjects WHERE user_id = $1', [userId]);
        return res.rows.map(row => ({
            name: row.name,
            days: Array.isArray(row.days) ? row.days.map(Number) : JSON.parse(row.days)
        }));
    },

    getAttendance: async (userId) => {
        const res = await pool.query(
            'SELECT subject_name, date, status FROM attendance_logs WHERE user_id = $1',
            [userId]
        );
        return res.rows;
    },

    updateUserSchedule: async (userId, subjects) => {
        await pool.query('DELETE FROM subjects WHERE user_id = $1', [userId]);
        for (const sub of subjects) {
            await pool.query(
                'INSERT INTO subjects (user_id, name, days) VALUES ($1, $2, $3)',
                [userId, sub.name, JSON.stringify(sub.days)]
            );
        }
    },

    deleteSubject: async (userId, subjectName) => {
        await pool.query('DELETE FROM subjects WHERE user_id = $1 AND name = $2', [userId, subjectName]);
        await pool.query('DELETE FROM attendance_logs WHERE user_id = $1 AND subject_name = $2', [userId, subjectName]);
    },

    syncAttendanceLogs: async (userId, attendanceData) => {
        for (const [key, status] of Object.entries(attendanceData)) {
            if (!key || key.length < 12) continue;
            const date = key.substring(0, 10);
            const subjectName = key.substring(11);
            if (!subjectName || !date) continue;
            await pool.query(`
                INSERT INTO attendance_logs (user_id, subject_name, date, status)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, subject_name, date)
                DO UPDATE SET status = EXCLUDED.status`,
                [userId, subjectName, date, status]
            );
        }
    }
};