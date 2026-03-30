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

const VALID_ID = /^[a-z0-9_]+$/i;
const VALID_MODES = ['normal', 'adaptive', 'timed', 'review'];
const VALID_CONF = ['knew', 'guessed', 'missed', 'unknown'];

function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('writeData failed:', e.message);
  }
}

// GET progress
app.get('/api/progress', (req, res) => {
  res.json(readData());
});

// POST session result
app.post('/api/session', (req, res) => {
  const { answers, mode, chapter, duration } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array' });
  }

  const data = readData();

  const session = {
    date: new Date().toISOString(),
    mode: VALID_MODES.includes(mode) ? mode : 'normal',
    chapter: typeof chapter === 'string' ? chapter.slice(0, 20) : 'all',
    duration: Math.min(Math.max(0, parseInt(duration) || 0), 86400),
    total: answers.length,
    correct: answers.filter(a => a.correct).length,
    answers: answers
      .filter(a => VALID_ID.test(a.id))
      .map(a => ({
        id: a.id,
        correct: Boolean(a.correct),
        confidence: VALID_CONF.includes(a.confidence) ? a.confidence : 'unknown'
      }))
  };
  data.sessions.unshift(session);
  if (data.sessions.length > 50) data.sessions = data.sessions.slice(0, 50);

  for (const answer of answers) {
    if (!VALID_ID.test(answer.id)) continue; // rejette __proto__ etc.
    if (!data.questionStats[answer.id]) {
      data.questionStats[answer.id] = { attempts: 0, correct: 0, confidences: [], lastSeen: '' };
    }
    const stat = data.questionStats[answer.id];
    stat.attempts++;
    if (answer.correct) stat.correct++;
    const conf = VALID_CONF.includes(answer.confidence) ? answer.confidence : null;
    if (conf) stat.confidences.push(conf);
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

// POST import course data
app.post('/api/import', (req, res) => {
  const { questions, flashcards, cours } = req.body;

  if (!questions || !flashcards || !cours) {
    return res.status(400).json({ error: 'Missing questions, flashcards, or cours' });
  }
  if (!questions.chapters || !Array.isArray(questions.questions)) {
    return res.status(400).json({ error: 'Invalid questions.json format' });
  }
  if (!Array.isArray(flashcards)) {
    return res.status(400).json({ error: 'Invalid flashcards.json format (expected array)' });
  }
  if (!Array.isArray(cours)) {
    return res.status(400).json({ error: 'Invalid cours.json format (expected array)' });
  }

  const dataDir = path.join(__dirname, 'public', 'data');
  try {
    fs.writeFileSync(path.join(dataDir, 'questions.json'), JSON.stringify(questions, null, 2));
    fs.writeFileSync(path.join(dataDir, 'flashcards.json'), JSON.stringify(flashcards, null, 2));
    fs.writeFileSync(path.join(dataDir, 'cours.json'), JSON.stringify(cours, null, 2));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to write data files: ' + e.message });
  }

  res.json({
    ok: true,
    stats: {
      questions: questions.questions.length,
      flashcards: flashcards.length,
      chapters: Object.keys(questions.chapters).length
    }
  });
});

app.listen(PORT, () => {
  console.log(`Serveur de révision démarré : http://localhost:${PORT}`);
});
