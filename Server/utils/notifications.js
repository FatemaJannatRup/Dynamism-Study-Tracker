// utils/notifications.js
import { con } from './db.js';

/**
 * Insert a notification row for a student.
 * Fire-and-forget — errors are logged but never crash the caller.
 *
 * @param {number} studentId
 * @param {string} title    — short heading shown in the bell panel
 * @param {string} message  — full text of the notification
 * @param {string} type     — 'system' | 'achievement' | 'goal' | 'reminder' | 'message'
 */
export function createNotification(studentId, title, message, type = 'system') {
  if (!studentId) return;
  con.query(
    `INSERT INTO notifications (student_id, title, message, type) VALUES (?, ?, ?, ?)`,
    [studentId, title, message, type],
    (err) => {
      if (err) console.error(`[notifications] Failed for student ${studentId}:`, err.message);
    }
  );
}