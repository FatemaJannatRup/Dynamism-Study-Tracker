import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { normalizeApiResponse } from "./utils/apiResponse.js";

import { authRouter }      from "./Routes/auth.js";
import { dashboardRouter } from "./Routes/dashboardRoute.js";
import { adminRouter }     from "./Routes/admin.js";
import { messagesRouter }  from "./Routes/Messagesroute.js";
import path from "path";

const app = express();

// ─────────────────────────────────────────────────────
// Core middleware — ORDER MATTERS
// ─────────────────────────────────────────────────────
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Response normalizer middleware
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(normalizeApiResponse(body));
  next();
});

// ─────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: "API is running" }));

// ─────────────────────────────────────────────────────
// Static file serving
// ─────────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve('./uploads'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

// ─────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────
app.use('/auth',  authRouter);
app.use('/admin', adminRouter);
app.use('/msg',   messagesRouter);
app.use('/',      dashboardRouter);

// ─────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});