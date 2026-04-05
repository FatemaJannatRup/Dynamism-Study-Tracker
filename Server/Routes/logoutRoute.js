// Routes/logoutRoute.js
//
// NOTE: This file is kept for backwards compatibility only.
// The canonical logout endpoint is POST /auth/logout in auth.js.
// You do NOT need to import this file in index.js — auth.js already handles logout.
// If you have any old code calling GET /logout, it will still work via this file,
// but new code should use POST /auth/logout instead.

import express from "express";

const router = express.Router();

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: true, message: "Logged out" });
});

export { router as logoutRouter };