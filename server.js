const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app       = express();
const PORT      = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Data helpers ──────────────────────────────────────────────────────────────
function load() {
  if (!fs.existsSync(DATA_FILE)) return { students: {}, logs: [] };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { students: {}, logs: [] }; }
}
function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Called by the ESP32 every time a card is tapped
app.post('/api/log', (req, res) => {
  const { uid, name, status } = req.body;
  if (!uid || !name || !status) {
    return res.status(400).json({ error: 'Missing fields: uid, name, status required' });
  }

  const data      = load();
  const timestamp = new Date().toISOString();

  // Update / insert student record
  data.students[uid] = { uid, name, status, lastSeen: timestamp };

  // Prepend log entry, keep last 500
  data.logs.unshift({ id: Date.now(), uid, name, status, timestamp });
  if (data.logs.length > 500) data.logs = data.logs.slice(0, 500);

  save(data);
  console.log(`[${new Date().toLocaleTimeString('en-GB')}] ${name} → ${status}`);
  res.json({ success: true, timestamp });
});

// All students with current status
app.get('/api/students', (req, res) => {
  const data = load();
  const list = Object.values(data.students).sort((a, b) => a.name.localeCompare(b.name));
  res.json(list);
});

// Recent log entries
app.get('/api/logs', (req, res) => {
  const data  = load();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(data.logs.slice(0, limit));
});

// Summary stats
app.get('/api/stats', (req, res) => {
  const data     = load();
  const students = Object.values(data.students);
  const out      = students.filter(s => s.status === 'OUT').length;
  const today    = new Date().toDateString();
  const todayTaps = data.logs.filter(l => new Date(l.timestamp).toDateString() === today).length;
  res.json({ out, in: students.length - out, total: students.length, today: todayTaps });
});

// CSV export — downloads a file with the full log
app.get('/api/export/csv', (req, res) => {
  const data = load();
  let csv    = 'Name,UID,Status,Timestamp\n';
  data.logs.forEach(l => {
    const ts = new Date(l.timestamp).toLocaleString('en-GB');
    csv += `"${l.name}","${l.uid}","${l.status}","${ts}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="roamlog-export.csv"');
  res.send(csv);
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ██████╗  ██████╗  █████╗ ███╗   ███╗██╗      ██████╗  ██████╗');
  console.log('  ██╔══██╗██╔═══██╗██╔══██╗████╗ ████║██║     ██╔═══██╗██╔════╝');
  console.log('  ██████╔╝██║   ██║███████║██╔████╔██║██║     ██║   ██║██║  ███╗');
  console.log('  ██╔══██╗██║   ██║██╔══██║██║╚██╔╝██║██║     ██║   ██║██║   ██║');
  console.log('  ██║  ██║╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗╚██████╔╝╚██████╔╝');
  console.log('  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚═════╝  ╚═════╝\n');
  console.log(`  🟢  Server running at  http://localhost:${PORT}`);
  console.log(`  📊  Dashboard at       http://localhost:${PORT}/dashboard.html`);
  console.log(`  🌐  Landing page at    http://localhost:${PORT}/\n`);
});
