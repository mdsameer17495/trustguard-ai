require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { analyze, ORDER, ACTIONS } = require('./lib/rules');
const ai = require('./lib/ai');
const db = require('./lib/db');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false })); // inline-script SPA + Google Fonts; tighten with nonces before production
app.use(express.json({ limit: '50kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false }));

// Anonymous per-browser id. No login, no personal data.
const deviceId = req => { const d = req.get('x-device-id') || ''; return /^[\w-]{8,64}$/.test(d) ? d : null; };
const bad = (res, msg) => res.status(400).json({ error: msg });
let dbKind = 'memory';

app.get('/api/health', (req, res) => res.json({ ok: true, ai: ai.enabled(), db: dbKind }));

// Pipeline: input -> rule detection -> (optional) AI -> merge -> structured result
app.post('/api/analyze', async (req, res, next) => {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return bad(res, 'Please provide some text to analyze.');
    if (text.length > 5000) return bad(res, 'Text is too long. Please keep it under 5000 characters.');
    const rules = analyze(text);
    const aiRes = ai.enabled() ? await ai.analyzeAI(text, rules.warning_signs.map(s => s.label)) : null;
    let out = { ...rules, source: 'rules', safe_actions: ACTIONS };
    if (aiRes) {
      const have = new Set(rules.warning_signs.map(s => s.label.toLowerCase()));
      const extra = aiRes.warning_signs.filter(s => !have.has(s.label.toLowerCase())).slice(0, 3);
      out = {
        risk_level: ORDER[aiRes.risk_level] > ORDER[rules.risk] ? aiRes.risk_level : rules.risk, // AI can raise the rule floor, never lower it
        warning_signs: [...rules.warning_signs, ...extra],
        explanation: aiRes.explanation || rules.explanation,
        explanation_hi: aiRes.explanation_hi || rules.explanation_hi,
        safe_actions: ACTIONS, source: 'ai'
      };
    } else { out.risk_level = rules.risk; }
    delete out.risk;
    const id = deviceId(req);
    if (id) db.add(id, { type: String(req.body.type || 'Scam Scanner').slice(0, 30), risk: out.risk_level, signs: out.warning_signs.map(s => s.label), text }).catch(e => console.error('save failed', e.message));
    res.json(out);
  } catch (e) { next(e); }
});

app.post('/api/chat', async (req, res, next) => {
  try {
    const { message, lang, history } = req.body;
    if (typeof message !== 'string' || !message.trim()) return bad(res, 'Please type or speak a question.');
    const reply = ai.enabled() ? await ai.chatAI(message, lang, Array.isArray(history) ? history : []) : null;
    res.json({ reply }); // null -> client uses its built-in answers
  } catch (e) { next(e); }
});

// OCR: image is processed in memory and discarded. Nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, f, cb) => /^image\/(png|jpeg|webp)$/.test(f.mimetype) ? cb(null, true) : cb(new Error('UNSUPPORTED'))
});
let worker = null;
async function ocr(buf) {
  try {
    worker = worker || require('tesseract.js').createWorker('eng+hin');
    const { data } = await (await worker).recognize(buf);
    return data.text;
  } catch (e) { worker = null; throw e; }
}
app.post('/api/ocr', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return bad(res, 'Please upload a PNG, JPG or WebP screenshot.');
    const text = (await ocr(req.file.buffer)).trim().slice(0, 5000);
    res.json({ text });
  } catch (e) { next(e); }
});

app.get('/api/history', async (req, res, next) => {
  try { const id = deviceId(req); res.json(id ? await db.list(id) : []); } catch (e) { next(e); }
});
app.delete('/api/data', async (req, res, next) => {
  try { const id = deviceId(req); if (id) await db.clear(id); res.json({ deleted: true }); } catch (e) { next(e); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  if (err.message === 'UNSUPPORTED') return bad(res, 'Unsupported file. Please upload a PNG, JPG or WebP screenshot.');
  if (err.code === 'LIMIT_FILE_SIZE') return bad(res, 'File is too large. Maximum size is 5 MB.');
  console.error(err);
  res.status(500).json({ error: "We couldn't complete the analysis right now. Please try again." });
});

const PORT = process.env.PORT || 3000;
db.init(process.env.MONGODB_URI).then(k => { dbKind = k; app.listen(PORT, () => console.log(`TrustGuard AI on :${PORT} | db=${k} | ai=${ai.enabled() ? 'gemini' : 'rules-only'}`)); });
