// Lumen Peptides - Main Express Server Entrypoint
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Static Web Assets
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  🔬 LUMEN PEPTIDES E-COMMERCE PLATFORM`);
  console.log(`  ⚡ Bitcoin Lightning Network Engine Active`);
  console.log(`  🌐 Server running: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
