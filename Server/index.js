// index.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


import { authRouter }     from "./Routes/auth.js";
import { dashboardRouter } from "./Routes/dashboardRoute.js";
import { adminRouter }    from "./Routes/admin.js";
import { messagesRouter } from "./Routes/Messagesroute.js";
import path from "path";
const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: "API is running" }));

app.use('/uploads', express.static(path.resolve('./uploads'), {
  setHeaders: (res, filePath) => {
    console.log('Serving file →', filePath);  // ← add this line for debug

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');  
    }
   
  }
}));
app.use('/auth',     authRouter);
app.use('/admin',    adminRouter);
app.use('/msg',      messagesRouter);
app.use('/',         dashboardRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});