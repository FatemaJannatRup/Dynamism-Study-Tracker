// Routes/messagesRoute.js
import express from 'express';
import jwt from 'jsonwebtoken';
import { con } from '../utils/db.js';
import { createNotification } from '../utils/notifications.js';

const router = express.Router();

const verifyStudent = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ Status: false, Error: "Not authenticated" });
  jwt.verify(token, process.env.JWT_SECRET || "jwt_secret_key", (err, decoded) => {
    if (err || decoded.role !== "student") return res.status(403).json({ Status: false, Error: "Students only" });
    req.user = decoded;
    next();
  });
};

const verifyAdmin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ Status: false, Error: "Not authenticated" });
  jwt.verify(token, process.env.JWT_SECRET || "jwt_secret_key", (err, decoded) => {
    if (err || decoded.role !== "admin") return res.status(403).json({ Status: false, Error: "Admin only" });
    req.user = decoded;
    next();
  });
};

const verifyAny = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ Status: false, Error: "Not authenticated" });
  jwt.verify(token, process.env.JWT_SECRET || "jwt_secret_key", (err, decoded) => {
    if (err) return res.status(403).json({ Status: false, Error: "Invalid token" });
    req.user = decoded;
    next();
  });
};

// ─────────────────────────────────────────────────────
// FRIENDSHIPS
// ─────────────────────────────────────────────────────

router.get('/friends/search', verifyStudent, (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ Status: false, Error: "Query too short" });
  }
  const sql = `
    SELECT id, name, email, class_grade, section
    FROM students
    WHERE (name LIKE ? OR email LIKE ?)
      AND id != ?
      AND status = 'active'
    LIMIT 10
  `;
  con.query(sql, [`%${q}%`, `%${q}%`, userId], (err, results) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Result: results });
  });
});

router.get('/friends/list', verifyStudent, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT
      f.id AS friendship_id,
      f.status,
      f.requester_id,
      f.addressee_id,
      f.created_at,
      CASE WHEN f.requester_id = ? THEN s2.id    ELSE s1.id    END AS friend_id,
      CASE WHEN f.requester_id = ? THEN s2.name  ELSE s1.name  END AS friend_name,
      CASE WHEN f.requester_id = ? THEN s2.email ELSE s1.email END AS friend_email,
      CASE WHEN f.requester_id = ? THEN s2.class_grade ELSE s1.class_grade END AS friend_class
    FROM friendships f
    JOIN students s1 ON f.requester_id = s1.id
    JOIN students s2 ON f.addressee_id = s2.id
    WHERE (f.requester_id = ? OR f.addressee_id = ?)
      AND f.status != 'blocked'
    ORDER BY f.updated_at DESC
  `;
  con.query(sql, [userId, userId, userId, userId, userId, userId], (err, results) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Result: results });
  });
});

router.post('/friends/request', verifyStudent, (req, res) => {
  const requesterId = req.user.id;
  const { addresseeId } = req.body;
  if (!addresseeId) return res.status(400).json({ Status: false, Error: "addresseeId required" });
  if (requesterId === parseInt(addresseeId)) return res.status(400).json({ Status: false, Error: "Cannot add yourself" });

  const checkSql = `
    SELECT id, status FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
  `;
  con.query(checkSql, [requesterId, addresseeId, addresseeId, requesterId], (err, rows) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    if (rows.length > 0) {
      const existing = rows[0];
      if (existing.status === 'accepted') return res.status(400).json({ Status: false, Error: "Already friends" });
      if (existing.status === 'pending')  return res.status(400).json({ Status: false, Error: "Request already sent" });
    }

    con.query(
      `INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')`,
      [requesterId, addresseeId],
      (err2) => {
        if (err2) return res.status(500).json({ Status: false, Error: err2.message });
        con.query(`SELECT name FROM students WHERE id = ?`, [requesterId], (err3, nameRows) => {
          if (!err3 && nameRows.length > 0) {
            createNotification(
              addresseeId,
              'New Friend Request',
              `${nameRows[0].name} sent you a friend request!`,
              'system'
            );
          }
        });
        res.json({ Status: true, Message: "Friend request sent" });
      }
    );
  });
});

router.post('/friends/accept/:friendshipId', verifyStudent, (req, res) => {
  const userId = req.user.id;
  const { friendshipId } = req.params;
  con.query(
    `UPDATE friendships SET status = 'accepted', updated_at = NOW()
     WHERE id = ? AND addressee_id = ? AND status = 'pending'`,
    [friendshipId, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Request not found" });

      con.query(`SELECT requester_id FROM friendships WHERE id = ?`, [friendshipId], (err2, rows) => {
        if (!err2 && rows.length > 0) {
          con.query(`SELECT name FROM students WHERE id = ?`, [userId], (err3, nameRows) => {
            if (!err3 && nameRows.length > 0) {
              createNotification(
                rows[0].requester_id,
                'Friend Request Accepted',
                `${nameRows[0].name} accepted your friend request!`,
                'system'
              );
            }
          });
        }
      });

      res.json({ Status: true, Message: "Friend request accepted" });
    }
  );
});

router.delete('/friends/:friendshipId', verifyStudent, (req, res) => {
  const userId = req.user.id;
  const { friendshipId } = req.params;
  con.query(
    `DELETE FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`,
    [friendshipId, userId, userId],
    (err, result) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Not found" });
      res.json({ Status: true, Message: "Removed" });
    }
  );
});

// ─────────────────────────────────────────────────────
// CONVERSATIONS & MESSAGES
//
// NOTE: last_message and last_message_at have been removed from
// the conversations table (3NF fix — they were derived values).
// All queries below now compute them from the messages table
// using a subquery, or reference the v_conversations view.
// ─────────────────────────────────────────────────────

// Get or create a student-to-student conversation
router.post('/conversations/student', verifyStudent, (req, res) => {
  const userId = req.user.id;
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ Status: false, Error: "friendId required" });

  const friendCheck = `
    SELECT id FROM friendships
    WHERE status = 'accepted'
      AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
  `;
  con.query(friendCheck, [userId, friendId, friendId, userId], (err, rows) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    if (rows.length === 0) return res.status(403).json({ Status: false, Error: "Not friends" });

    const findSql = `
      SELECT id FROM conversations
      WHERE type = 'student_student'
        AND ((student_id = ? AND friend_id = ?) OR (student_id = ? AND friend_id = ?))
      LIMIT 1
    `;
    con.query(findSql, [userId, friendId, friendId, userId], (err2, existing) => {
      if (err2) return res.status(500).json({ Status: false, Error: err2.message });

      if (existing.length > 0) {
        return res.json({ Status: true, ConversationId: existing[0].id });
      }

      con.query(
        `INSERT INTO conversations (type, student_id, friend_id) VALUES ('student_student', ?, ?)`,
        [userId, friendId],
        (err3, result) => {
          if (err3) return res.status(500).json({ Status: false, Error: err3.message });
          res.json({ Status: true, ConversationId: result.insertId });
        }
      );
    });
  });
});

// Get or create a student-to-admin conversation
router.post('/conversations/admin', verifyStudent, (req, res) => {
  const userId = req.user.id;

  con.query(
    `SELECT id FROM conversations WHERE type = 'student_admin' AND student_id = ? LIMIT 1`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ Status: false, Error: err.message });
      if (rows.length > 0) return res.json({ Status: true, ConversationId: rows[0].id });

      con.query(
        `INSERT INTO conversations (type, student_id) VALUES ('student_admin', ?)`,
        [userId],
        (err2, result) => {
          if (err2) return res.status(500).json({ Status: false, Error: err2.message });
          res.json({ Status: true, ConversationId: result.insertId });
        }
      );
    }
  );
});

// List all conversations for a student
// last_message and last_message_at are now computed from messages table
router.get('/conversations/list', verifyStudent, (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT
      c.id,
      c.type,
      CASE
        WHEN c.type = 'student_admin' THEN 'Developer Support'
        WHEN c.student_id = ? THEN s2.name
        ELSE s1.name
      END AS other_name,
      CASE
        WHEN c.type = 'student_admin' THEN NULL
        WHEN c.student_id = ? THEN s2.id
        ELSE s1.id
      END AS other_id,
      (SELECT content    FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id
          AND m.is_read = 0
          AND NOT (m.sender_type = 'student' AND m.sender_id = ?)
      ) AS unread_count
    FROM conversations c
    LEFT JOIN students s1 ON c.student_id = s1.id
    LEFT JOIN students s2 ON c.friend_id  = s2.id
    WHERE c.student_id = ? OR c.friend_id = ?
    ORDER BY last_message_at DESC
  `;
  con.query(sql, [userId, userId, userId, userId, userId], (err, results) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Result: results });
  });
});

// Get messages in a conversation
router.get('/conversations/:id/messages', verifyAny, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const accessSql = userRole === 'admin'
    ? `SELECT id FROM conversations WHERE id = ? AND (admin_id = ? OR type = 'student_admin')`
    : `SELECT id FROM conversations WHERE id = ? AND (student_id = ? OR friend_id = ?)`;
  const accessParams = userRole === 'admin' ? [id, userId] : [id, userId, userId];

  con.query(accessSql, accessParams, (err, rows) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    if (rows.length === 0) return res.status(403).json({ Status: false, Error: "Access denied" });

    const sql = `
      SELECT
        m.id, m.sender_type, m.sender_id, m.content, m.is_read, m.created_at,
        CASE WHEN m.sender_type = 'student' THEN s.name ELSE a.name END AS sender_name
      FROM messages m
      LEFT JOIN students s ON m.sender_type = 'student' AND m.sender_id = s.id
      LEFT JOIN admins   a ON m.sender_type = 'admin'   AND m.sender_id = a.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
      LIMIT 100
    `;
    con.query(sql, [id], (err2, messages) => {
      if (err2) return res.status(500).json({ Status: false, Error: err2.message });

      const markSql = userRole === 'admin'
        ? `UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_type = 'student' AND is_read = 0`
        : `UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND NOT (sender_type = 'student' AND sender_id = ?) AND is_read = 0`;
      const markParams = userRole === 'admin' ? [id] : [id, userId];
      con.query(markSql, markParams);

      res.json({ Status: true, Result: messages });
    });
  });
});

// Send a message
// NOTE: No longer updates last_message / last_message_at on conversations
// (those columns were dropped — computed from messages table instead)
router.post('/conversations/:id/messages', verifyAny, (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  if (!content || !content.trim()) return res.status(400).json({ Status: false, Error: "Message cannot be empty" });

  const accessSql = userRole === 'admin'
    ? `SELECT * FROM conversations WHERE id = ? AND (admin_id = ? OR type = 'student_admin')`
    : `SELECT * FROM conversations WHERE id = ? AND (student_id = ? OR friend_id = ?)`;
  const accessParams = userRole === 'admin' ? [id, userId] : [id, userId, userId];

  con.query(accessSql, accessParams, (err, rows) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    if (rows.length === 0) return res.status(403).json({ Status: false, Error: "Access denied" });

    const convo   = rows[0];
    const trimmed = content.trim();

    con.query(
      `INSERT INTO messages (conversation_id, sender_type, sender_id, content) VALUES (?, ?, ?, ?)`,
      [id, userRole, userId, trimmed],
      (err2, result) => {
        if (err2) return res.status(500).json({ Status: false, Error: err2.message });

        // Notify recipients
        if (userRole === 'admin') {
          createNotification(
            convo.student_id,
            'Developer Support',
            `You have a new reply from the developers.`,
            'message'
          );
        } else {
          if (convo.type === 'student_admin') {
            con.query(`SELECT id FROM admins`, (err3, admins) => {
              if (!err3) {
                con.query(`SELECT name FROM students WHERE id = ?`, [userId], (err4, nameRows) => {
                  const studentName = nameRows?.[0]?.name || 'A student';
                  admins.forEach(admin => {
                    createNotification(
                      admin.id,
                      'New Support Message',
                      `${studentName} sent a message in support chat.`,
                      'message'
                    );
                  });
                });
              }
            });
          } else {
            const recipientId = convo.student_id === userId ? convo.friend_id : convo.student_id;
            con.query(`SELECT name FROM students WHERE id = ?`, [userId], (err3, nameRows) => {
              const senderName = nameRows?.[0]?.name || 'Your friend';
              createNotification(
                recipientId,
                'New Message',
                `${senderName} sent you a message.`,
                'message'
              );
            });
          }
        }

        res.json({ Status: true, MessageId: result.insertId });
      }
    );
  });
});

// Admin: list all support conversations
// last_message / last_message_at computed from messages table
router.get('/admin/conversations', verifyAdmin, (req, res) => {
  const sql = `
    SELECT
      c.id,
      s.id AS student_id,
      s.name AS student_name,
      s.email AS student_email,
      (SELECT content    FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_type = 'student' AND m.is_read = 0
      ) AS unread_count
    FROM conversations c
    JOIN students s ON c.student_id = s.id
    WHERE c.type = 'student_admin'
    ORDER BY last_message_at DESC
  `;
  con.query(sql, (err, results) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Result: results });
  });
});

// Total unread count for a student (bell badge)
router.get('/messages/unread-count', verifyStudent, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT COUNT(*) AS total FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE (c.student_id = ? OR c.friend_id = ?)
      AND m.is_read = 0
      AND NOT (m.sender_type = 'student' AND m.sender_id = ?)
  `;
  con.query(sql, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ Status: false, Error: err.message });
    res.json({ Status: true, Count: rows[0].total });
  });
});

export { router as messagesRouter };