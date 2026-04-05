
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { con } from '../utils/db.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// ─────────────────────────────────────────────────────
// LOGIN  (works for both admin & student)
// ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ loginStatus: false, Error: "Email and password required" });
  }

  try {
    // 1. Check admins first
    const adminResult = await new Promise((resolve, reject) => {
      con.query("SELECT * FROM admins WHERE email = ?", [email], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    if (adminResult.length > 0) {
      const admin = adminResult[0];
      const match = await bcrypt.compare(password, admin.password);
      if (!match) {
        return res.status(401).json({ loginStatus: false, Error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { role: "admin", id: admin.id, email: admin.email },
        process.env.JWT_SECRET || "jwt_secret_key",
        { expiresIn: '1d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      // FIX: token is now included in the response so the frontend can store it
      return res.json({
        loginStatus: true,
        role: "admin",
        token,
        user: { id: admin.id, name: admin.name || "Admin", email: admin.email }
      });
    }

    // 2. Check students
    const studentResult = await new Promise((resolve, reject) => {
      con.query(
        "SELECT * FROM students WHERE email = ? AND status = 'active'",
        [email],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });

    if (studentResult.length > 0) {
      const student = studentResult[0];
      const match = await bcrypt.compare(password, student.password);
      if (!match) {
        return res.status(401).json({ loginStatus: false, Error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { role: "student", id: student.id, email: student.email, name: student.name },
        process.env.JWT_SECRET || "jwt_secret_key",
        { expiresIn: '1d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      // FIX: token is now included in the response
      return res.json({
        loginStatus: true,
        role: "student",
        token,
        user: {
          id: student.id,
          name: student.name,
          email: student.email,
          roll_number: student.roll_number,
          class_grade: student.class_grade
        }
      });
    }

    return res.status(401).json({ loginStatus: false, Error: "Invalid credentials" });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ loginStatus: false, Error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────
// REGISTER  (students only)
// ─────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, roll_number, class_grade, section, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Name, email and password are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format" });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }

  try {
    // Check for duplicate email across both tables
    const checkResult = await new Promise((resolve, reject) => {
      con.query(
        `SELECT email FROM students WHERE email = ?
         UNION
         SELECT email FROM admins WHERE email = ?`,
        [email, email],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });

    if (checkResult.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const insertResult = await new Promise((resolve, reject) => {
      con.query(
        `INSERT INTO students (name, email, password, roll_number, class_grade, section, phone, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          name.trim(),
          email.trim().toLowerCase(),
          hashedPassword,
          roll_number || null,
          class_grade || null,
          section || null,
          phone || null
        ],
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful! Please log in.",
      studentId: insertResult.insertId
    });

  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }
    return res.status(500).json({ success: false, message: "Registration failed. Please try again." });
  }
});

// ─────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: "Logged out" });
});

// ─────────────────────────────────────────────────────
// VERIFY TOKEN  (used by AdminDashboard on mount)
// ─────────────────────────────────────────────────────
router.get('/verify', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ valid: false, message: "No token" });

  jwt.verify(token, process.env.JWT_SECRET || "jwt_secret_key", (err, decoded) => {
    if (err) return res.status(401).json({ valid: false, message: "Invalid or expired token" });
    return res.json({ valid: true, user: decoded });
  });
});

export { router as authRouter };