// MongoDB via Mongoose, with an in-memory fallback so the app runs with zero setup.
// Privacy: only a short, number-masked snippet is stored, never full messages or images. Records expire after 30 days.
const mem = [];
let Scan = null;
async function init(uri) {
  if (!uri) return 'memory';
  try {
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const s = new mongoose.Schema({ deviceId: { type: String, index: true }, type: String, risk: String, signs: [String], snippet: String, createdAt: { type: Date, default: Date.now } });
    s.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
    Scan = mongoose.model('Scan', s);
    return 'mongodb';
  } catch (e) { console.error('MongoDB unavailable, using memory:', e.message); return 'memory'; }
}
const mask = t => String(t).replace(/\d{6,}/g, '••••').replace(/\s+/g, ' ').trim().slice(0, 90);
async function add(deviceId, rec) {
  const doc = { deviceId, type: rec.type, risk: rec.risk, signs: rec.signs, snippet: mask(rec.text), createdAt: new Date() };
  if (Scan) return Scan.create(doc);
  mem.unshift(doc); if (mem.length > 500) mem.pop();
}
async function list(deviceId) {
  if (Scan) return Scan.find({ deviceId }).sort({ createdAt: -1 }).limit(40).lean();
  return mem.filter(d => d.deviceId === deviceId).slice(0, 40);
}
async function clear(deviceId) {
  if (Scan) return Scan.deleteMany({ deviceId });
  for (let i = mem.length - 1; i >= 0; i--) if (mem[i].deviceId === deviceId) mem.splice(i, 1);
}
module.exports = { init, add, list, clear };
