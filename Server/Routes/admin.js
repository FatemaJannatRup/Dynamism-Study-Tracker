// Routes/admin.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { con } from '../utils/db.js';

const router = express.Router();


const verifyAdmin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    console.log('verifyAdmin message: Not authenticated');
    return res.status(401).json({ status: "error", message: "Not authenticated" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "jwt_secret_key", (err, decoded) => {
    if (err || decoded.role !== "admin") {
      console.log('verifyAdmin message: Not authorized (admin only)', err?.message);
      return res.status(403).json({ status: "error", message: "Not authorized (admin only)" });
    }
    req.user = decoded;
    console.log('verifyAdmin success:', { adminId: decoded.id });
    next();
  });
};

// ─────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────
router.get('/stats', verifyAdmin, (req, res) => {
  console.log('GET /admin/stats request');
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM students)                                   AS totalStudents,
      (SELECT COUNT(*) FROM study_sessions WHERE status = 'completed')  AS totalSessions,
      (SELECT COUNT(*) FROM courses)                                    AS totalCourses,
      (SELECT COALESCE(SUM(duration_minutes), 0)
         FROM study_sessions WHERE status = 'completed')                AS totalMinutes,
      (SELECT COUNT(DISTINCT student_id)
         FROM study_sessions WHERE DATE(start_time) = CURDATE())        AS activeStudentsToday
  `;
  con.query(sql, (err, rows) => {
    if (err) {
      console.error('[API] GET /admin/stats message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log('[API] GET /admin/stats success:', rows[0]);
    res.json({ status: "success", data: rows[0] });
  });
});

// ─────────────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────────────
router.get('/students', verifyAdmin, (req, res) => {
  console.log('[API] GET /admin/students request');
  const sql = `
    SELECT id, name, email, roll_number, class_grade, section, phone, status, created_at
    FROM students
    ORDER BY created_at DESC
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/students message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/students success: Found ${results.length} students`);
    res.json({ status: "success", data: results });
  });
});

router.put('/students/:id/status', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log(`[API] PUT /admin/students/${id}/status request:`, { status });
  
  const allowed = ['active', 'inactive', 'suspended'];
  if (!allowed.includes(status)) {
    console.log(`[API] PUT /admin/students/${id}/status message: Invalid status ${status}`);
    return res.status(400).json({ status: "error", message: "Invalid status value" });
  }
  con.query(`UPDATE students SET status = ? WHERE id = ?`, [status, id], (err, result) => {
    if (err) {
      console.error(`[API] PUT /admin/students/${id}/status message:`, err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    if (result.affectedRows === 0) {
      console.log(`[API] PUT /admin/students/${id}/status message: Student ${id} not found`);
      return res.status(404).json({ status: "error", message: "Student not found" });
    }
    console.log(`[API] PUT /admin/students/${id}/status success: Status updated to ${status}`);
    res.json({ status: "success", Message: `Status updated to ${status}` });
  });
});

router.delete('/students/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  console.log(`[API] DELETE /admin/students/${id} request`);
  
  con.query('DELETE FROM students WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error(`[API] DELETE /admin/students/${id} message:`, err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    if (result.affectedRows === 0) {
      console.log(`[API] DELETE /admin/students/${id} message: Student ${id} not found`);
      return res.status(404).json({ status: "error", message: "Student not found" });
    }
    console.log(`[API] DELETE /admin/students/${id} success: Student deleted`);
    res.json({ status: "success", Message: "Student and all related data deleted" });
  });
});

// ─────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────
router.get('/sessions', verifyAdmin, (req, res) => {
  console.log('[API] GET /admin/sessions request');
  const sql = `
    SELECT
      s.id, s.student_id, s.course_id, s.start_time, s.end_time,
      s.duration_minutes, s.notes, s.status,
      st.name AS student_name, st.email,
      c.course_code, c.course_name, c.color
    FROM study_sessions s
    LEFT JOIN students st ON s.student_id = st.id
    LEFT JOIN courses c   ON s.course_id  = c.id
    ORDER BY s.start_time DESC
    LIMIT 500
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/sessions message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/sessions success: Found ${results.length} sessions`);
    res.json({ status: "success", data: results });
  });
});

// ─────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────
router.get('/courses', verifyAdmin, (req, res) => {
  console.log(' GET /admin/courses request');
  const sql = `
    SELECT
      c.id, c.student_id, c.course_code, c.course_name, c.color, c.status, c.created_at,
      s.name AS student_name,
      (SELECT COUNT(*) FROM study_sessions ss WHERE ss.course_id = c.id) AS session_count
    FROM courses c
    LEFT JOIN students s ON c.student_id = s.id
    ORDER BY c.created_at DESC
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/courses message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/courses success: Found ${results.length} courses`);
    res.json({ status: "success", data: results });
  });
});

// ─────────────────────────────────────────────────────
// REVISION SESSIONS
// ─────────────────────────────────────────────────────
router.get('/revisions', verifyAdmin, (req, res) => {
  console.log(' GET /admin/revisions request');
  const sql = `
    SELECT
      r.id, r.student_id, r.course_id, r.title, r.scheduled_date,
      r.duration, r.priority, r.status, r.completed_at,
      s.name AS student_name,
      c.course_code, c.course_name
    FROM revision_sessions r
    LEFT JOIN students s ON r.student_id = s.id
    LEFT JOIN courses c  ON r.course_id  = c.id
    ORDER BY r.scheduled_date DESC
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/revisions message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/revisions success: Found ${results.length} revisions`);
    res.json({ status: "success", data: results });
  });
});

// ─────────────────────────────────────────────────────
// STUDY MATERIALS
// ─────────────────────────────────────────────────────
router.get('/materials', verifyAdmin, (req, res) => {
  console.log(' GET /admin/materials request');
  const sql = `
    SELECT
      m.id, m.student_id, m.course_id, m.title, m.type, m.url, m.description, m.uploaded_at,
      s.name AS student_name, s.email,
      c.course_code, c.course_name
    FROM study_materials m
    LEFT JOIN students s ON m.student_id = s.id
    LEFT JOIN courses c  ON m.course_id  = c.id
    ORDER BY m.uploaded_at DESC
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/materials message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/materials success: Found ${results.length} materials`);
    res.json({ status: "success", data: results });
  });
});

// ─────────────────────────────────────────────────────
// ACHIEVEMENTS  ← Updated for new single-row-per-student design
// Returns parsed progress_map and keys_earned array for each student
// ─────────────────────────────────────────────────────
router.get('/achievements', verifyAdmin, (req, res) => {
  console.log(' GET /admin/achievements request');
  const sql = `
    SELECT
      a.id,
      a.student_id,
      a.keys_earned,
      a.progress_map,
      a.updated_at,
      s.name AS student_name
    FROM achievements a
    LEFT JOIN students s ON a.student_id = s.id
    ORDER BY a.updated_at DESC
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/achievements message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }

    // Parse keys_earned into an array for convenience
    const formatted = results.map(row => ({
      ...row,
      keys_earned: row.keys_earned
        ? row.keys_earned.split(',').filter(Boolean)
        : [],
      progress_map: row.progress_map || {}
    }));

    console.log(` GET /admin/achievements success: Found ${formatted.length} achievement records`);
    res.json({ status: "success", data: formatted });
  });
});

// ─────────────────────────────────────────────────────
// STUDY GOALS
// ─────────────────────────────────────────────────────
router.get('/goals', verifyAdmin, (req, res) => {
  console.log(' GET /admin/goals request');
  const sql = `
    SELECT
      g.id, g.student_id, g.type, g.target_minutes, g.period_start, g.period_end, g.created_at,
      s.name AS student_name,
      COALESCE((
        SELECT SUM(ss.duration_minutes)
        FROM study_sessions ss
        WHERE ss.student_id = g.student_id
          AND DATE(ss.start_time) BETWEEN g.period_start AND g.period_end
          AND ss.status = 'completed'
      ), 0) AS current_progress
    FROM study_goals g
    LEFT JOIN students s ON g.student_id = s.id
    ORDER BY g.period_start DESC
    LIMIT 500
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/goals message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/goals success: Found ${results.length} goals`);
    res.json({ status: "success", data: results });
  });
});

// ─────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────
router.get('/notifications', verifyAdmin, (req, res) => {
  console.log(' GET /admin/notifications request');
  const sql = `
    SELECT
      n.id, n.student_id, n.title, n.message, n.type, n.is_read, n.created_at,
      s.name AS student_name
    FROM notifications n
    LEFT JOIN students s ON n.student_id = s.id
    ORDER BY n.created_at DESC
    LIMIT 200
  `;
  con.query(sql, (err, results) => {
    if (err) {
      console.error(' GET /admin/notifications message:', err.message);
      return res.status(500).json({ status: "error", message: err.message });
    }
    console.log(` GET /admin/notifications success: Found ${results.length} notifications`);
    res.json({ status: "success", data: results });
  });
});

export { router as adminRouter };
