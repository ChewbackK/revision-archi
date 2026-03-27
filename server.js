const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4242;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { sessions: [], questionStats: {}, lastUpdated: '' };
  }
}

function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET progress
app.get('/api/progress', (req, res) => {
  res.json(readData());
});

// POST session result
app.post('/api/session', (req, res) => {
  const data = readData();
  const { answers, mode, chapter, duration } = req.body;

  // Save session summary
  const session = {
    date: new Date().toISOString(),
    mode: mode || 'normal',
    chapter: chapter || 'all',
    duration: duration || 0,
    total: answers.length,
    correct: answers.filter(a => a.correct).length,
    answers: answers.map(a => ({
      id: a.id,
      correct: a.correct,
      confidence: a.confidence || 'unknown'
    }))
  };
  data.sessions.unshift(session);
  if (data.sessions.length > 50) data.sessions = data.sessions.slice(0, 50);

  // Update per-question stats
  for (const answer of answers) {
    if (!data.questionStats[answer.id]) {
      data.questionStats[answer.id] = { attempts: 0, correct: 0, confidences: [], lastSeen: '' };
    }
    const stat = data.questionStats[answer.id];
    stat.attempts++;
    if (answer.correct) stat.correct++;
    if (answer.confidence) stat.confidences.push(answer.confidence);
    if (stat.confidences.length > 10) stat.confidences = stat.confidences.slice(-10);
    stat.lastSeen = new Date().toISOString();
  }

  writeData(data);
  res.json({ ok: true });
});

// DELETE all progress
app.delete('/api/progress', (req, res) => {
  writeData({ sessions: [], questionStats: {}, lastUpdated: '' });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Serveur de révision démarré : http://localhost:${PORT}`);
});
