const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4242;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VALID_ID = /^[a-z0-9_]+$/i;
const VALID_MODES = ['normal', 'adaptive', 'timed', 'review'];
const VALID_CONF = ['knew', 'guessed', 'missed', 'unknown'];

function readData() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Migrate old flat format to per-course format
    if (!raw.courses) {
      const courseId = raw.courseId || 'default';
      return {
        current: courseId,
        courses: { [courseId]: { sessions: raw.sessions || [], questionStats: raw.questionStats || {} } },
        lastUpdated: raw.lastUpdated || ''
      };
    }
    return raw;
  } catch {
    return { current: null, courses: {}, lastUpdated: '' };
  }
}

function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('writeData failed:', e.message);
  }
}

function currentCourse(data) {
  const id = data.current;
  if (!id || !data.courses[id]) {
    data.courses[id || 'default'] = { sessions: [], questionStats: {} };
    data.current = id || 'default';
  }
  return data.courses[data.current];
}

// GET progress — returns current course stats
app.get('/api/progress', (req, res) => {
  const data = readData();
  const course = currentCourse(data);
  res.json({ ...course, courseId: data.current });
});

// POST session result
app.post('/api/session', (req, res) => {
  const { answers, mode, chapter, duration } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array' });
  }

  const data = readData();
  const course = currentCourse(data);

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
  course.sessions.unshift(session);
  if (course.sessions.length > 50) course.sessions = course.sessions.slice(0, 50);

  for (const answer of answers) {
    if (!VALID_ID.test(answer.id)) continue;
    if (!course.questionStats[answer.id]) {
      course.questionStats[answer.id] = { attempts: 0, correct: 0, confidences: [], lastSeen: '' };
    }
    const stat = course.questionStats[answer.id];
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

// DELETE progress — reset current course only
app.delete('/api/progress', (req, res) => {
  const data = readData();
  if (data.current && data.courses[data.current]) {
    data.courses[data.current] = { sessions: [], questionStats: {} };
  }
  writeData(data);
  res.json({ ok: true });
});

// POST import course data — saves current stats, switches to new course
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

  // Derive course ID from questions.json (courseId field or chapter keys)
  const courseId = typeof questions.courseId === 'string' && questions.courseId.trim()
    ? questions.courseId.trim()
    : Object.keys(questions.chapters).sort().join('_');

  const dataDir = path.join(__dirname, 'public', 'data');
  try {
    fs.writeFileSync(path.join(dataDir, 'questions.json'), JSON.stringify(questions, null, 2));
    fs.writeFileSync(path.join(dataDir, 'flashcards.json'), JSON.stringify(flashcards, null, 2));
    fs.writeFileSync(path.join(dataDir, 'cours.json'), JSON.stringify(cours, null, 2));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to write data files: ' + e.message });
  }

  // Switch to new course, restoring existing stats if any
  const data = readData();
  data.current = courseId;
  if (!data.courses[courseId]) {
    data.courses[courseId] = { sessions: [], questionStats: {} };
  }
  writeData(data);

  const isReturning = data.courses[courseId].sessions.length > 0;

  res.json({
    ok: true,
    courseId,
    returning: isReturning,
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
