// Routes/dashboardRoute.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { con } from '../utils/db.js';
import { createNotification } from '../utils/notifications.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const SALT_ROUNDS = 10;

const uploadsDir = './uploads/materials';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

// ─────────────────────────────────────────────────────
// Middleware — students only
// ─────────────────────────────────────────────────────
const verifyUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ Status: false, Error: "Not authenticated" });

  jwt.verify(token, process.env.JWT_SECRET || "jwt_secret_key", (err, decoded) => {
    if (err || decoded.role !== "student") {
      return res.status(403).json({ Status: false, Error: "Not authorized (student only)" });
    }
    req.user = decoded;
    next();
  });
};

router.use(verifyUser);

// ─────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────

// GET — fetch current profile so the settings form can pre-populate
router.get('/students/profile', (req, res) => {
  const userId = req.user.id;
  con.query(
    `SELECT id, name, email, roll_number, class_grade, section, phone FROM students WHERE id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (rows.length === 0) return res.status(404).json({ Status: false, Error: "User not found" });
      res.json({ Status: true, Result: rows[0] });
    }
  );
});

router.put('/students/profile', async (req, res) => {
  const userId = req.user.id;
  const { name, email, roll_number, class_grade, section, phone, currentPassword, newPassword } = req.body;

  if (!name || !email) {
    return res.status(400).json({ Status: false, Error: "Name and email are required" });
  }

  try {
    let sql = 'UPDATE students SET name = ?, email = ?, roll_number = ?, class_grade = ?, section = ?, phone = ?';
    let params = [name.trim(), email.trim().toLowerCase(), roll_number || null, class_grade || null, section || null, phone || null];

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ Status: false, Error: "Current password required to set a new one" });
      }
      const user = await new Promise((resolve, reject) => {
        con.query("SELECT password FROM students WHERE id = ?", [userId], (err, rows) => {
          if (err || rows.length === 0) reject(new Error("User not found"));
          else resolve(rows[0]);
        });
      });
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(401).json({ Status: false, Error: "Current password incorrect" });
      const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
      sql += ', password = ?';
      params.push(hashed);
    }

    sql += ' WHERE id = ?';
    params.push(userId);

    const dbResult = await new Promise((resolve, reject) => {
      con.query(sql, params, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });

    if (dbResult.affectedRows === 0) {
      return res.status(404).json({ Status: false, Error: "User not found" });
    }

    createNotification(userId, 'Profile Updated', 'Your profile was updated successfully.', 'system');
    res.json({ Status: true, Message: "Profile updated successfully" });

  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ Status: false, Error: "Server error" });
  }
});

router.delete('/students/account', (req, res) => {
  const userId = req.user.id;
  con.query('DELETE FROM students WHERE id = ?', [userId], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "User not found" });
    res.clearCookie('token');
    res.json({ Status: true, Message: "Account deleted" });
  });
});

// ─────────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────────
router.get('/courses/all', (req, res) => {
  const userId = req.user.id;
  con.query(
    `SELECT id, course_code, course_name, color
     FROM courses WHERE student_id = ? AND status = 'active'
     ORDER BY course_name`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, Result: results });
    }
  );
});

router.post('/courses/add', (req, res) => {
  const userId = req.user.id;
  const { courseCode, courseName, color } = req.body;

  if (!courseCode || !courseName) {
    return res.status(400).json({ Status: false, Error: "Course code and name required" });
  }

  con.query(
    `INSERT INTO courses (student_id, course_code, course_name, color) VALUES (?, ?, ?, ?)`,
    [userId, courseCode.toUpperCase(), courseName.trim(), color || '#FFD700'],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ Status: false, Error: "Course code already exists" });
        }
        return res.status(500).json({ Status: false, Error: err.message });
      }
      createNotification(userId, 'Course Added', `${courseName} has been added to your courses.`, 'system');
      res.json({ Status: true, Result: { id: result.insertId } });
    }
  );
});

router.put('/courses/update/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { courseCode, courseName, color } = req.body;

  con.query(
    `UPDATE courses SET course_code = ?, course_name = ?, color = ?
     WHERE id = ? AND student_id = ?`,
    [courseCode.toUpperCase(), courseName.trim(), color, id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Course not found" });
      res.json({ Status: true, Message: "Course updated" });
    }
  );
});

router.delete('/courses/delete/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  con.query(
    `DELETE FROM courses WHERE id = ? AND student_id = ?`,
    [id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Course not found" });
      res.json({ Status: true, Message: "Course deleted" });
    }
  );
});

// ─────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────
router.post('/sessions/start', (req, res) => {
  const userId = req.user.id;
  const { courseId } = req.body;

  con.query(
    `INSERT INTO study_sessions (student_id, course_id, start_time, status) VALUES (?, ?, NOW(), 'active')`,
    [userId, courseId || null],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, SessionId: result.insertId, StartTime: new Date().toISOString() });
    }
  );
});

router.post('/sessions/end/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { notes = '' } = req.body;
  const userId = req.user.id;

  con.query(
    `SELECT start_time FROM study_sessions WHERE id = ? AND status = 'active'`,
    [sessionId],
    (err, rows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (rows.length === 0) return res.status(400).json({ Status: false, Error: "Session not found or already ended" });

      const durationMinutes = Math.max(1, Math.round((Date.now() - new Date(rows[0].start_time)) / 1000 / 60));

      con.query(
        `UPDATE study_sessions
         SET end_time = NOW(), duration_minutes = ?, notes = ?, status = 'completed'
         WHERE id = ?`,
        [durationMinutes, notes, sessionId],
        (err2) => {
          if (err2) return res.status(500).json({ Status: false, Error: err2.message });

          updateAchievements(userId);
          // NOTE: updateGoalProgress removed — current_progress no longer stored in DB
          // Goal progress is now computed live from study_sessions

          const hours = Math.floor(durationMinutes / 60);
          const mins  = durationMinutes % 60;
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          createNotification(
            userId,
            'Session Complete',
            `Great work! You just studied for ${timeStr}.`,
            'system'
          );

          // Check if daily goal was just reached and notify
          checkAndNotifyGoal(userId);

          res.json({ Status: true, DurationMinutes: durationMinutes });
        }
      );
    }
  );
});

router.get('/sessions/history', (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  con.query(
    `SELECT s.id, s.start_time, s.end_time, s.duration_minutes, s.course_id, c.course_code
     FROM study_sessions s
     LEFT JOIN courses c ON s.course_id = c.id
     WHERE s.student_id = ? AND s.status = 'completed'
     ORDER BY s.start_time DESC
     LIMIT ?`,
    [userId, limit],
    (err, results) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, Result: results });
    }
  );
});

router.get('/sessions/today', (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().split('T')[0];

  con.query(
    `SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes
     FROM study_sessions
     WHERE student_id = ? AND DATE(start_time) = CURDATE() AND status = 'completed'`,
    [userId],
    (err, minuteRows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      const minutes = minuteRows[0]?.total_minutes || 0;

      // Use the student's actual saved goal target — not hardcoded 120
      con.query(
        `SELECT target_minutes FROM study_goals
         WHERE student_id = ? AND type = 'daily' AND ? BETWEEN period_start AND period_end
         LIMIT 1`,
        [userId, today],
        (err2, goalRows) => {
          if (err2) return res.status(500).json({ Status: false, Error: err2.message });
          const target = goalRows.length > 0 ? goalRows[0].target_minutes : 120;
          res.json({
            Status: true,
            Data: {
              totalMinutes:  minutes,
              targetMinutes: target,
              percentage:    Math.min(100, Math.round((minutes / target) * 100)),
              formattedTime: `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`
            }
          });
        }
      );
    }
  );
});

router.get('/sessions/streaks', (req, res) => {
  const userId = req.user.id;

  con.query(
    `SELECT DATE(start_time) AS date, SUM(duration_minutes) AS minutes
     FROM study_sessions
     WHERE student_id = ?
       AND start_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       AND status = 'completed'
     GROUP BY DATE(start_time)
     ORDER BY date DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });

      const weekData = [];
      let currentStreak = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayShort = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const found = rows.find(r => new Date(r.date).toISOString().split('T')[0] === dateStr);
        const mins  = found ? found.minutes : 0;
        const hit   = mins >= 1;
        weekData.unshift({ date: dateStr, day: dayShort, minutes: mins, hit });
        if (i === 0 && hit) currentStreak = 1;
        else if (i > 0 && hit && currentStreak === i) currentStreak++;
      }

      res.json({ Status: true, Data: { currentStreak, weekData } });
    }
  );
});

// ─────────────────────────────────────────────────────
// REVISION SESSIONS
// ─────────────────────────────────────────────────────
router.get('/revisions/all', (req, res) => {
  const userId = req.user.id;
  con.query(
    `SELECT id, course_id, title, scheduled_date, duration, priority, status, created_at
     FROM revision_sessions
     WHERE student_id = ?
     ORDER BY scheduled_date ASC, priority DESC`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, Result: results });
    }
  );
});

router.post('/revisions/add', (req, res) => {
  const userId = req.user.id;
  const { courseId, title, scheduledDate, duration, priority } = req.body;

  if (!title || !scheduledDate) {
    return res.status(400).json({ Status: false, Error: "Title and scheduled date required" });
  }

  con.query(
    `INSERT INTO revision_sessions (student_id, course_id, title, scheduled_date, duration, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [userId, courseId || null, title.trim(), scheduledDate, duration || 60, priority || 'medium'],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      createNotification(userId, 'Revision Scheduled', `"${title}" has been added to your calendar.`, 'reminder');
      res.json({ Status: true, Result: { id: result.insertId } });
    }
  );
});

router.put('/revisions/update/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { courseId, title, scheduledDate, duration, priority } = req.body;

  con.query(
    `UPDATE revision_sessions
     SET course_id = ?, title = ?, scheduled_date = ?, duration = ?, priority = ?
     WHERE id = ? AND student_id = ?`,
    [courseId || null, title?.trim(), scheduledDate, duration, priority, id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Not found" });
      res.json({ Status: true, Message: "Revision updated" });
    }
  );
});

router.post('/revisions/complete/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  con.query(
    `UPDATE revision_sessions SET status = 'completed', completed_at = NOW()
     WHERE id = ? AND student_id = ?`,
    [id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Not found" });
      createNotification(userId, 'Revision Complete', 'Nice work completing a revision session!', 'system');
      res.json({ Status: true, Message: "Marked complete" });
    }
  );
});

router.delete('/revisions/delete/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  con.query(
    `DELETE FROM revision_sessions WHERE id = ? AND student_id = ?`,
    [id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Not found" });
      res.json({ Status: true, Message: "Deleted" });
    }
  );
});

// ─────────────────────────────────────────────────────
// STUDY MATERIALS
// ─────────────────────────────────────────────────────
router.get('/materials/all', (req, res) => {
  const userId = req.user.id;
  const { courseId } = req.query;

  let sql = `
    SELECT m.id, m.course_id, m.title, m.type, m.url, m.description, m.uploaded_at,
           c.course_code, c.course_name
    FROM study_materials m
    LEFT JOIN courses c ON m.course_id = c.id
    WHERE m.student_id = ?
  `;
  const params = [userId];
  if (courseId) { sql += ` AND m.course_id = ?`; params.push(courseId); }
  sql += ` ORDER BY m.uploaded_at DESC`;

  con.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Result: results });
  });
});

router.post('/materials/add', upload.single('file'), (req, res) => {
  const userId = req.user.id;
  const { courseId, title, type, url, description } = req.body;
  const finalUrl = req.file ? `/uploads/materials/${req.file.filename}` : url;

  if (!title || !type || !finalUrl) {
    return res.status(400).json({ Status: false, Error: "Title, type and URL/file are required" });
  }

  con.query(
    `INSERT INTO study_materials (course_id, student_id, title, type, url, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [courseId || null, userId, title.trim(), type, finalUrl, description || null],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      createNotification(userId, 'Material Uploaded', `"${title}" has been added to your materials.`, 'system');
      res.json({ Status: true, Result: { id: result.insertId } });
    }
  );
});

router.put('/materials/update/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { courseId, title, type, url, description } = req.body;

  con.query(
    `UPDATE study_materials SET course_id = ?, title = ?, type = ?, url = ?, description = ?
     WHERE id = ? AND student_id = ?`,
    [courseId || null, title?.trim(), type, url, description, id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Not found" });
      res.json({ Status: true, Message: "Material updated" });
    }
  );
});

router.delete('/materials/delete/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  con.query(
    `DELETE FROM study_materials WHERE id = ? AND student_id = ?`,
    [id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Not found" });
      res.json({ Status: true, Message: "Deleted" });
    }
  );
});

// ─────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────
router.get('/notifications/all', (req, res) => {
  const userId = req.user.id;
  const { unreadOnly } = req.query;

  let sql = `SELECT id, title, message, type, is_read, created_at
             FROM notifications WHERE student_id = ?`;
  const params = [userId];
  if (unreadOnly === 'true') sql += ` AND is_read = 0`;
  sql += ` ORDER BY created_at DESC LIMIT 50`;

  con.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Result: results });
  });
});

router.post('/notifications/mark-read/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  con.query(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?`,
    [id, userId],
    (err) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, Message: "Marked as read" });
    }
  );
});

router.post('/notifications/mark-all-read', (req, res) => {
  const userId = req.user.id;
  con.query(
    `UPDATE notifications SET is_read = 1 WHERE student_id = ? AND is_read = 0`,
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, Message: "All marked as read", Count: result.affectedRows });
    }
  );
});

router.delete('/notifications/delete/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  con.query(
    `DELETE FROM notifications WHERE id = ? AND student_id = ?`,
    [id, userId],
    (err) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      res.json({ Status: true, Message: "Deleted" });
    }
  );
});

// ─────────────────────────────────────────────────────
// ACHIEVEMENTS  ← Updated for single-row-per-student design
// Returns keys_earned (array) and progress_map (object)
// ─────────────────────────────────────────────────────
router.get('/achievements/all', (req, res) => {
  const userId = req.user.id;
  con.query(
    `SELECT id, keys_earned, progress_map, updated_at
     FROM achievements WHERE student_id = ?`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });

      if (results.length === 0) {
        // No row yet — student hasn't done anything
        return res.json({
          Status: true,
          Result: { keys_earned: [], progress_map: {} }
        });
      }

      const row = results[0];
      res.json({
        Status: true,
        Result: {
          id:           row.id,
          keys_earned:  row.keys_earned ? row.keys_earned.split(',').filter(Boolean) : [],
          progress_map: row.progress_map || {},
          updated_at:   row.updated_at
        }
      });
    }
  );
});

// ─────────────────────────────────────────────────────
// STUDY GOALS
// ─────────────────────────────────────────────────────
router.get('/goals/current', (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().split('T')[0];

  con.query(
    `SELECT COALESCE(SUM(duration_minutes), 0) AS actual_minutes
     FROM study_sessions
     WHERE student_id = ? AND DATE(start_time) = CURDATE() AND status = 'completed'`,
    [userId],
    (err, minuteRows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      const actualMinutes = minuteRows[0]?.actual_minutes || 0;

      con.query(
        `SELECT id, type, target_minutes, period_start, period_end
         FROM study_goals
         WHERE student_id = ? AND type = 'daily' AND ? BETWEEN period_start AND period_end
         LIMIT 1`,
        [userId, today],
        (err2, goalRows) => {
          if (err2) return res.status(500).json({ Status: false, Error: err2.message });

          if (goalRows.length === 0) {
            // No row for today — inherit the last target the student set, else default 120
            con.query(
              `SELECT target_minutes FROM study_goals
               WHERE student_id = ? AND type = 'daily'
               ORDER BY period_start DESC LIMIT 1`,
              [userId],
              (err3, lastGoal) => {
                if (err3) return res.status(500).json({ Status: false, Error: err3.message });
                const inheritedTarget = lastGoal.length > 0 ? lastGoal[0].target_minutes : 120;
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                con.query(
                  `INSERT INTO study_goals (student_id, type, target_minutes, period_start, period_end)
                   VALUES (?, 'daily', ?, ?, ?)`,
                  [userId, inheritedTarget, today, tomorrowStr],
                  (err4, insertResult) => {
                    if (err4) return res.status(500).json({ Status: false, Error: err4.message });
                    res.json({
                      Status: true,
                      Result: {
                        id: insertResult.insertId,
                        type: 'daily',
                        target_minutes: inheritedTarget,
                        current_progress: actualMinutes,
                        period_start: today,
                        period_end: tomorrowStr
                      }
                    });
                  }
                );
              }
            );
          } else {
            res.json({
              Status: true,
              Result: { ...goalRows[0], current_progress: actualMinutes }
            });
          }
        }
      );
    }
  );
});

// Set / update the daily goal target — updates today's row and persists for future days
router.put('/goals/target', (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().split('T')[0];
  const { targetMinutes } = req.body;

  const target = Math.round(Number(targetMinutes));
  if (!target || target < 1 || target > 1440) {
    return res.status(400).json({ Status: false, Error: "Target must be between 1 and 1440 minutes" });
  }

  // Update today's goal row if it exists
  con.query(
    `UPDATE study_goals SET target_minutes = ?
     WHERE student_id = ? AND type = 'daily' AND ? BETWEEN period_start AND period_end`,
    [target, userId, today],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });

      if (result.affectedRows === 0) {
        // No row yet — create it
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        con.query(
          `INSERT INTO study_goals (student_id, type, target_minutes, period_start, period_end)
           VALUES (?, 'daily', ?, ?, ?)
           ON DUPLICATE KEY UPDATE target_minutes = VALUES(target_minutes)`,
          [userId, target, today, tomorrowStr],
          (err2) => {
            if (err2) return res.status(500).json({ Status: false, Error: err2.message });
            res.json({ Status: true, Message: "Daily goal set", target_minutes: target });
          }
        );
      } else {
        res.json({ Status: true, Message: "Daily goal updated", target_minutes: target });
      }
    }
  );
});

router.put('/goals/update/:id', (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { targetMinutes } = req.body;

  if (!targetMinutes || targetMinutes < 1) {
    return res.status(400).json({ Status: false, Error: "targetMinutes must be at least 1" });
  }

  con.query(
    `UPDATE study_goals SET target_minutes = ? WHERE id = ? AND student_id = ?`,
    [targetMinutes, id, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Goal not found" });
      res.json({ Status: true, Message: "Goal updated" });
    }
  );
});

// ─────────────────────────────────────────────────────
// DATA ROOM
// ─────────────────────────────────────────────────────
router.get('/dataroom/stats', (req, res) => {
  const userId = req.user.id;

  con.query(
    `SELECT
       COALESCE(SUM(duration_minutes), 0)                                    AS total_minutes,
       COUNT(*)                                                               AS total_sessions,
       (SELECT COUNT(*) FROM courses WHERE student_id = ?)                   AS total_courses,
       COALESCE(SUM(CASE
         WHEN YEAR(start_time)  = YEAR(CURDATE())
          AND MONTH(start_time) = MONTH(CURDATE())
         THEN duration_minutes ELSE 0 END), 0)                               AS month_minutes
     FROM study_sessions
     WHERE student_id = ? AND status = 'completed'`,
    [userId, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      const { total_minutes, total_sessions, total_courses, month_minutes } = rows[0];
      res.json({
        Status: true,
        Data: {
          totalStudyTime:   `${Math.floor(total_minutes / 60)}h ${total_minutes % 60}m`,
          totalSessions:    total_sessions,
          totalCourses:     total_courses,
          thisMonthMinutes: month_minutes,
          totalMinutes:     total_minutes
        }
      });
    }
  );
});

// ─────────────────────────────────────────────────────
// ACHIEVEMENTS — internal helper (called after session ends)
//
// NEW DESIGN: One row per student in achievements table.
//   keys_earned = CSV of badge keys the student has earned
//   progress_map = JSON { key: progressInt }
//
// Flow:
//   1. Compute stats from study_sessions
//   2. UPSERT the achievements row (INSERT … ON DUPLICATE KEY UPDATE)
//   3. If a badge is newly unlocked, append its key to keys_earned
//      and fire a notification
// ─────────────────────────────────────────────────────
function updateAchievements(studentId) {
  con.query(
    `SELECT
       COUNT(*)                                         AS total_sessions,
       COALESCE(SUM(duration_minutes), 0)               AS total_minutes,
       COUNT(CASE WHEN HOUR(start_time) < 8  THEN 1 END) AS early_sessions,
       COUNT(CASE WHEN HOUR(start_time) >= 22 THEN 1 END) AS night_sessions
     FROM study_sessions
     WHERE student_id = ? AND status = 'completed'`,
    [studentId],
    (err, rows) => {
      if (err || rows.length === 0) return;

      const { total_sessions, total_minutes, early_sessions, night_sessions } = rows[0];
      const totalHours = Math.floor(total_minutes / 60);

      const checks = [
        { key: 'first_session', progress: total_sessions,  unlocked: total_sessions >= 1,  label: 'First Steps' },
        { key: 'early_bird',    progress: early_sessions,  unlocked: early_sessions >= 1,  label: 'Early Bird' },
        { key: 'night_owl',     progress: night_sessions,  unlocked: night_sessions >= 1,  label: 'Night Owl' },
        { key: 'century',       progress: totalHours,       unlocked: totalHours >= 100,    label: 'Century' },
        { key: 'master',        progress: total_sessions,  unlocked: total_sessions >= 50, label: 'Master Scholar' },
      ];

      // Fetch existing row for this student
      con.query(
        `SELECT keys_earned, progress_map FROM achievements WHERE student_id = ?`,
        [studentId],
        (err2, existing) => {
          if (err2) return;

          const currentKeys = existing.length > 0 && existing[0].keys_earned
            ? existing[0].keys_earned.split(',').filter(Boolean)
            : [];
          const currentProgress = existing.length > 0 && existing[0].progress_map
            ? existing[0].progress_map
            : {};

          // Update progress for all badges
          checks.forEach(({ key, progress }) => {
            currentProgress[key] = progress;
          });

          // Find newly unlocked badges (unlocked now but not in keys_earned yet)
          const newlyUnlocked = checks.filter(
            ({ key, unlocked }) => unlocked && !currentKeys.includes(key)
          );

          newlyUnlocked.forEach(({ key }) => currentKeys.push(key));

          const newKeysStr     = currentKeys.join(',');
          const newProgressStr = JSON.stringify(currentProgress);

          // Upsert the single achievements row
          con.query(
            `INSERT INTO achievements (student_id, keys_earned, progress_map)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
               keys_earned  = VALUES(keys_earned),
               progress_map = VALUES(progress_map)`,
            [studentId, newKeysStr, newProgressStr],
            (err3) => {
              if (err3) return;
              // Fire notifications for newly unlocked badges
              newlyUnlocked.forEach(({ label }) => {
                createNotification(
                  studentId,
                  'Achievement Unlocked!',
                  `You just earned the "${label}" badge!`,
                  'achievement'
                );
              });
            }
          );
        }
      );
    }
  );
}

// ─────────────────────────────────────────────────────
// GOAL NOTIFICATION helper
// current_progress is no longer stored — compute it live and notify
// ─────────────────────────────────────────────────────
function checkAndNotifyGoal(studentId) {
  const today = new Date().toISOString().split('T')[0];

  con.query(
    `SELECT g.id, g.target_minutes,
            COALESCE(SUM(s.duration_minutes), 0) AS current_progress
     FROM study_goals g
     LEFT JOIN study_sessions s
       ON s.student_id = g.student_id
      AND DATE(s.start_time) BETWEEN g.period_start AND g.period_end
      AND s.status = 'completed'
     WHERE g.student_id = ? AND g.type = 'daily' AND ? BETWEEN g.period_start AND g.period_end
     GROUP BY g.id, g.target_minutes
     LIMIT 1`,
    [studentId, today],
    (err, rows) => {
      if (err || rows.length === 0) return;
      const { target_minutes, current_progress } = rows[0];
      // Only notify if progress just crossed the threshold this session
      // (we can't know "previous" progress without storing it, so we notify every time
      //  current_progress >= target to keep it simple — idempotent notifications are fine)
      if (current_progress >= target_minutes) {
        createNotification(
          studentId,
          'Daily Goal Reached!',
          `You hit your ${target_minutes} minute study goal for today. Keep it up!`,
          'goal'
        );
      }
    }
  );
}

export { router as dashboardRouter, verifyUser };