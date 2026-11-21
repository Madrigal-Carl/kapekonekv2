import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

const app = express();

app.use(helmet());
// shortcut: CORS/env/error middleware are wired in M1 (config/env.js); this is the M0 boot check only.
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

export default app;
