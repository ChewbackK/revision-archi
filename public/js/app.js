// ============================================================
// DATA
// ============================================================
let QCM_DATA = null;
let FLASHCARD_DATA = null;
let COURS_DATA = null;
let PROGRESS = { sessions: [], questionStats: {} };

async function loadData() {
  const [q, f, c, p] = await Promise.all([
    fetch('/data/questions.json').then(r => r.json()),
    fetch('/data/flashcards.json').then(r => r.json()),
    fetch('/data/cours.json').then(r => r.json()),
    fetch('/api/progress').then(r => r.json()).catch(() => ({ sessions: [], questionStats: {} }))
  ]);
  QCM_DATA = q;
  FLASHCARD_DATA = f;
  COURS_DATA = c;
  PROGRESS = p;
}

async function saveSession(answers, mode, chapter, duration) {
  try {
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, mode, chapter, duration })
    });
    PROGRESS = await fetch('/api/progress').then(r => r.json());
  } catch (e) {
    console.warn('Save failed (no server?)', e);
  }
}

// ============================================================
// ROUTING
// ============================================================
let currentPage = 'home';

function qcmSessionActive() {
  return qcmState.questions.length > 0 && qcmState.current < qcmState.questions.length;
}

function navigate(page) {
  // Reload progress when visiting dashboard so stats are fresh
  if (page === 'dashboard') {
    fetch('/api/progress').then(r => r.json()).then(p => { PROGRESS = p; renderDashboard(); }).catch(() => renderDashboard());
  }

  if (qcmState.timerInterval) { clearInterval(qcmState.timerInterval); qcmState.timerInterval = null; }
  if (examCountdownInterval && page !== 'home') { clearInterval(examCountdownInterval); examCountdownInterval = null; }

  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
    if (b.dataset.page === 'qcm') {
      b.textContent = qcmSessionActive() && page !== 'qcm' ? '📝 QCM ●' : '📝 QCM';
    }
  });
  document.getElementById('app').innerHTML = '';

  switch (page) {
    case 'home':       renderHome(); break;
    case 'qcm':        qcmSessionActive() ? renderQuestion() : renderQCMSetup(); break;
    case 'flashcards': renderFlashcards(); break;
    case 'cours':      renderCours(); break;
    case 'dashboard':  break; // handled by fetch above
    case 'import':     renderImport(); break;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
  await loadData();
  // Update page title and logo from course data
  const courseTitle = QCM_DATA.title || QCM_DATA.courseId || 'Révision';
  document.title = courseTitle;
  document.getElementById('logo').textContent = courseTitle;
  navigate('home');
});

// ============================================================
// HOME
// ============================================================
function renderHome() {
  const total = Object.keys(PROGRESS.questionStats).length;
  const sessions = PROGRESS.sessions.length;
  const lastScore = sessions > 0
    ? `${PROGRESS.sessions[0].correct}/${PROGRESS.sessions[0].total}`
    : 'Aucune';

  const examBadge = (() => {
    if (!QCM_DATA.examDate) return '';
    const exam = new Date(QCM_DATA.examDate);
    const dateStr = exam.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<div class="exam-badge">📅 ${dateStr} — <span id="exam-countdown">…</span></div>`;
  })();

  document.getElementById('app').innerHTML = `
    <div class="home-hero">
      <h1>${QCM_DATA.title || QCM_DATA.courseId || 'Révision'}</h1>
      ${QCM_DATA.subtitle ? `<p>${QCM_DATA.subtitle}</p>` : ''}
      ${examBadge}
    </div>

    <div class="home-grid">
      <div class="home-card" onclick="navigate('qcm')">
        <div class="icon">📝</div>
        <h3>QCM Adaptatif</h3>
        <p>Mode normal, chrono ou révision des erreurs</p>
      </div>
      <div class="home-card" onclick="navigate('flashcards')">
        <div class="icon">🃏</div>
        <h3>Flashcards</h3>
        <p>Concepts clés par chapitre</p>
      </div>
      <div class="home-card" onclick="navigate('cours')">
        <div class="icon">📖</div>
        <h3>Résumés cours</h3>
        <p>${Object.keys(QCM_DATA.chapters).join(', ')} condensés</p>
      </div>
      <div class="home-card" onclick="navigate('dashboard')">
        <div class="icon">📊</div>
        <h3>Statistiques</h3>
        <p>${sessions} session${sessions > 1 ? 's' : ''} · Dernier score : ${lastScore}</p>
      </div>
    </div>

    <div class="chapters-row">
      ${Object.entries(QCM_DATA.chapters).map(([id, ch]) => {
        const stats = getChapterStats(id);
        return `<div class="chapter-pill" style="background:${ch.color}22;border:1px solid ${ch.color}55;color:${ch.color}dd">
          <div style="font-weight:700">${id} — ${ch.title}</div>
          <div style="font-size:0.8rem;opacity:0.8;margin-top:0.25rem">${stats.seen}/${stats.total} questions vues · ${stats.pct}% réussi</div>
        </div>`;
      }).join('')}
    </div>
  `;

  if (QCM_DATA.examDate) startExamCountdown();
}

let examCountdownInterval = null;

function startExamCountdown() {
  if (examCountdownInterval) clearInterval(examCountdownInterval);
  const exam = new Date(QCM_DATA.examDate);

  function tick() {
    const el = document.getElementById('exam-countdown');
    if (!el) { clearInterval(examCountdownInterval); return; }
    const ms = exam - new Date();
    if (ms <= 0) {
      el.innerHTML = "<strong>c'est maintenant !</strong>";
      clearInterval(examCountdownInterval);
      return;
    }
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const parts = [];
    if (d > 0) parts.push(`<strong>${d}j</strong>`);
    parts.push(`<strong>${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}m${String(s).padStart(2,'0')}s</strong>`);
    el.innerHTML = parts.join(' ');
  }

  tick();
  examCountdownInterval = setInterval(tick, 1000);
}

function getChapterStats(chapter) {
  const all = QCM_DATA.questions.filter(q => q.chapter === chapter);
  const seen = all.filter(q => PROGRESS.questionStats[q.id]);
  const correct = seen.filter(q => {
    const s = PROGRESS.questionStats[q.id];
    return s && s.attempts > 0 && s.correct / s.attempts >= 0.5;
  });
  return {
    total: all.length,
    seen: seen.length,
    pct: seen.length > 0 ? Math.round((correct.length / seen.length) * 100) : 0
  };
}

// ============================================================
// QCM SETUP
// ============================================================
let qcmState = {
  chapter: 'all',
  mode: 'normal',
  count: 10,
  questions: [],
  current: 0,
  answers: [],
  startTime: 0,
  timerInterval: null,
  secondsLeft: 0,
  selectedConfidence: null
};

function renderQCMSetup() {
  document.getElementById('app').innerHTML = `
    <div class="qcm-setup">
      <h2>📝 QCM</h2>

      <div class="form-group">
        <label>Chapitre</label>
        <div class="btn-group" id="chapterGroup">
          ${[['all', '🎯 Tout'], ...Object.entries(QCM_DATA.chapters).map(([id, ch]) => [id, `${id} — ${ch.title}`])].map(([val, label]) =>
            `<button class="btn-toggle ${qcmState.chapter === val ? 'active' : ''}" data-val="${val}" onclick="selectChapter('${val}')">${label}</button>`
          ).join('')}
        </div>
      </div>

      <div class="form-group">
        <label>Mode</label>
        <div class="btn-group">
          <button class="btn-toggle ${qcmState.mode === 'normal' ? 'active' : ''}" onclick="selectMode('normal')">Normal</button>
          <button class="btn-toggle ${qcmState.mode === 'adaptive' ? 'active' : ''}" onclick="selectMode('adaptive')">🧠 Adaptatif</button>
          <button class="btn-toggle ${qcmState.mode === 'timed' ? 'active' : ''}" onclick="selectMode('timed')">⏱ Chrono (30s/q)</button>
          <button class="btn-toggle ${qcmState.mode === 'review' ? 'active' : ''}" onclick="selectMode('review')">🔄 Erreurs</button>
        </div>
      </div>

      <div class="form-group">
        <label>Nombre de questions</label>
        <div class="btn-group">
          ${[5, 10, 15, 20, 'Tout'].map(n => {
            const val = n === 'Tout' ? 999 : n;
            return `<button class="btn-toggle ${qcmState.count === val ? 'active' : ''}" onclick="selectCount(${val})">${n}</button>`;
          }).join('')}
        </div>
      </div>

      <div style="color:var(--text2);font-size:0.875rem;margin-top:-0.5rem">${{
        normal: "Questions dans l'ordre aléatoire.",
        adaptive: "Les questions que tu rates reviennent plus souvent.",
        timed: "30 secondes par question. Répondre avant la fin du chrono !",
        review: "Uniquement les questions avec moins de 60% de réussite."
      }[qcmState.mode]}</div>

      <button class="btn-primary" onclick="startQCM()">Commencer →</button>
    </div>
  `;
}

function selectChapter(v) { qcmState.chapter = v; renderQCMSetup(); }
function selectMode(v)    { qcmState.mode = v;    renderQCMSetup(); }
function selectCount(v)   { qcmState.count = v;   renderQCMSetup(); }


function selectQuestionsForSession() {
  let pool = [...QCM_DATA.questions];

  if (qcmState.chapter !== 'all') {
    pool = pool.filter(q => q.chapter === qcmState.chapter);
  }

  if (qcmState.mode === 'review') {
    pool = pool.filter(q => {
      const s = PROGRESS.questionStats[q.id];
      if (!s || s.attempts === 0) return false; // jamais tentée ≠ erreur
      return (s.correct / s.attempts) < 0.6;
    });
    if (pool.length === 0) {
      alert('Aucune erreur à réviser ! Tu as réussi toutes les questions tentées à plus de 60%. Lance une session normale pour en découvrir de nouvelles.');
      return [];
    }
  }

  if (qcmState.mode === 'adaptive') {
    pool = pool.map(q => {
      const s = PROGRESS.questionStats[q.id];
      let weight = 1;
      if (!s || s.attempts === 0) {
        weight = 1.5; // unseen questions get slight boost
      } else {
        const rate = s.correct / s.attempts;
        weight = Math.max(0.1, 2 - rate * 2); // worse rate → higher weight
      }
      return { ...q, weight };
    });
    // Weighted random selection
    pool = weightedShuffle(pool);
  } else {
    pool = shuffle(pool);
  }

  const count = qcmState.count === 999 ? pool.length : Math.min(qcmState.count, pool.length);
  return pool.slice(0, count);
}

function weightedShuffle(items) {
  const result = [];
  const arr = [...items];
  while (arr.length > 0) {
    const totalWeight = arr.reduce((s, i) => s + (i.weight || 1), 0);
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let i = 0; i < arr.length; i++) {
      rand -= arr[i].weight || 1;
      if (rand <= 0) { idx = i; break; }
    }
    result.push(arr.splice(idx, 1)[0]);
  }
  return result;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startQCM() {
  const questions = selectQuestionsForSession();
  if (questions.length === 0) return;

  qcmState.questions = questions;
  qcmState.current = 0;
  qcmState.answers = [];
  qcmState.startTime = Date.now();
  qcmState.selectedConfidence = null;

  if (qcmState.timerInterval) clearInterval(qcmState.timerInterval);

  renderQuestion();
}

// ============================================================
// QCM QUESTION
// ============================================================
function renderQuestion() {
  const q = qcmState.questions[qcmState.current];
  const idx = qcmState.current;
  const total = qcmState.questions.length;
  const pct = Math.round((idx / total) * 100);
  const isTimed = qcmState.mode === 'timed';

  // Shuffle options, keep track of where the correct answer ended up
  const optionsWithIdx = q.options.map((text, i) => ({ text, originalIdx: i }));
  const shuffled = shuffle(optionsWithIdx);
  qcmState.shuffledOptions = shuffled;
  qcmState.shuffledCorrectIdx = shuffled.findIndex(o => o.originalIdx === q.correct);

  document.getElementById('app').innerHTML = `
    <div class="qcm-header">
      <div style="color:var(--text2);font-size:0.875rem">${idx + 1} / ${total}</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>
      ${isTimed ? `<div class="timer" id="timer">30</div>` : ''}
    </div>

    <div class="q-meta">
      ${chapterBadge(q.chapter)}
      <span class="badge badge-theme">${q.theme}</span>
    </div>

    <div class="question-card">
      <div class="question-text">${escapeHtml(q.question)}</div>
      <div class="options-list" id="options">
        ${shuffled.map((opt, i) => `
          <button class="option-btn" onclick="selectAnswer(${i})" data-idx="${i}">
            <span class="option-letter">${'ABCD'[i]}</span>
            <span>${escapeHtml(opt.text)}</span>
          </button>
        `).join('')}
      </div>
      <div id="feedback"></div>
    </div>
  `;

  if (isTimed) {
    qcmState.secondsLeft = 30;
    updateTimer();
    qcmState.timerInterval = setInterval(() => {
      qcmState.secondsLeft--;
      updateTimer();
      if (qcmState.secondsLeft <= 0) {
        clearInterval(qcmState.timerInterval);
        selectAnswer(-1); // timeout = wrong
      }
    }, 1000);
  }
}

function updateTimer() {
  const el = document.getElementById('timer');
  if (!el) return;
  el.textContent = qcmState.secondsLeft;
  el.classList.toggle('urgent', qcmState.secondsLeft <= 10);
}

function selectAnswer(chosenIdx) {
  if (qcmState.timerInterval) clearInterval(qcmState.timerInterval);

  const q = qcmState.questions[qcmState.current];
  const correctIdx = qcmState.shuffledCorrectIdx;
  const isCorrect = chosenIdx === correctIdx;
  qcmState.selectedConfidence = null;

  // Disable all buttons
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIdx) btn.classList.add('correct');
    else if (i === chosenIdx && !isCorrect) btn.classList.add('selected-wrong');
  });

  // Show feedback
  const feedback = document.getElementById('feedback');
  feedback.innerHTML = `
    <div class="explanation-box">
      ${chosenIdx === -1 ? '<strong>⏱ Temps écoulé !</strong><br>' : ''}
      <strong>${isCorrect ? '✓ Correct !' : '✗ Incorrect.'}</strong><br>
      ${escapeHtml(q.explanation)}
    </div>
    <div class="confidence-row">
      <label>Je savais :</label>
      <button class="conf-btn knew" onclick="setConfidence('knew')">✓ Je savais</button>
      <button class="conf-btn guessed" onclick="setConfidence('guessed')">~ J'ai deviné</button>
      <button class="conf-btn missed" onclick="setConfidence('missed')">✗ Je ne savais pas</button>
    </div>
    <div class="next-btn-row">
      <button class="btn-primary" onclick="nextQuestion()">
        ${qcmState.current + 1 < qcmState.questions.length ? 'Suivant →' : 'Voir les résultats'}
      </button>
    </div>
  `;

  // Record answer (confidence added later)
  qcmState.answers.push({
    id: q.id,
    chapter: q.chapter,
    question: q.question,
    chosen: chosenIdx,
    correct: isCorrect,
    correctAnswer: q.options[q.correct],
    chosenAnswer: chosenIdx >= 0 ? qcmState.shuffledOptions[chosenIdx].text : 'Timeout',
    confidence: null
  });
}

function setConfidence(val) {
  qcmState.selectedConfidence = val;
  // Update the last answer
  const last = qcmState.answers[qcmState.answers.length - 1];
  if (last) last.confidence = val;
  // Visual feedback
  document.querySelectorAll('.conf-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.conf-btn.${val}`);
  if (btn) btn.classList.add('active');
}

function nextQuestion() {
  qcmState.current++;
  if (qcmState.current >= qcmState.questions.length) {
    finishQCM();
  } else {
    renderQuestion();
  }
}

// ============================================================
// QCM RESULTS
// ============================================================
async function finishQCM() {
  const duration = Math.round((Date.now() - qcmState.startTime) / 1000);
  await saveSession(qcmState.answers, qcmState.mode, qcmState.chapter, duration);
  qcmState.questions = []; // session terminée, plus de reprise possible

  const correct = qcmState.answers.filter(a => a.correct).length;
  const total = qcmState.answers.length;
  const pct = Math.round((correct / total) * 100);

  const scoreClass = pct >= 80 ? 'great' : pct >= 50 ? 'ok' : 'bad';
  const scoreEmoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

  const wrongAnswers = qcmState.answers.filter(a => !a.correct);

  document.getElementById('app').innerHTML = `
    <div class="results-card">
      <h2>${scoreEmoji} Résultats</h2>
      <div class="score-big ${scoreClass}">${pct}%</div>

      <div class="results-stats">
        <div class="stat-box">
          <div class="value" style="color:var(--green)">${correct}</div>
          <div class="label">Bonnes réponses</div>
        </div>
        <div class="stat-box">
          <div class="value" style="color:var(--red)">${total - correct}</div>
          <div class="label">Mauvaises réponses</div>
        </div>
        <div class="stat-box">
          <div class="value">${formatDuration(duration)}</div>
          <div class="label">Durée</div>
        </div>
      </div>

      ${wrongAnswers.length > 0 ? `
        <div class="review-list">
          <h3>Questions ratées (${wrongAnswers.length})</h3>
          ${wrongAnswers.map(a => `
            <div class="review-item wrong">
              <div class="ri-q">${a.question}</div>
              <div class="ri-a">
                <span class="ri-wrong">✗ Ta réponse : ${a.chosenAnswer}</span><br>
                <span class="ri-correct">✓ Bonne réponse : ${a.correctAnswer}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : '<div style="color:var(--green);text-align:center;padding:1rem">🎉 Parfait ! Toutes les réponses correctes !</div>'}

      <div class="results-actions">
        <button class="btn-primary" onclick="startQCM()">Rejouer (même config)</button>
        <button class="btn-secondary" onclick="renderQCMSetup()">Nouvelle session</button>
        <button class="btn-secondary" onclick="navigate('dashboard')">Voir les stats</button>
      </div>
    </div>
  `;
}

function formatDuration(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? String(s % 60).padStart(2, '0') + 's' : ''}`;
}

// ============================================================
// FLASHCARDS
// ============================================================
let fcState = {
  chapter: 'all',
  cards: [],
  current: 0,
  flipped: false,
  seen: new Set()
};

function renderFlashcards() {
  fcState.chapter = fcState.chapter || 'all';
  fcState.cards = filterFC();
  fcState.current = 0;
  fcState.flipped = false;
  fcState.seen = new Set();
  renderFCUI();
}

function filterFC() {
  if (fcState.chapter === 'all') return shuffle([...FLASHCARD_DATA]);
  return shuffle(FLASHCARD_DATA.filter(f => f.chapter === fcState.chapter));
}

function renderFCUI() {
  const card = fcState.cards[fcState.current];
  const total = fcState.cards.length;
  fcState.seen.add(fcState.current);

  document.getElementById('app').innerHTML = `
    <div class="section-title">🃏 Flashcards</div>

    <div class="fc-controls">
      ${[['all', 'Tout'], ...Object.keys(QCM_DATA.chapters).map(id => [id, id])].map(([v, l]) =>
        `<button class="btn-toggle ${fcState.chapter === v ? 'active' : ''}" onclick="changeFCChapter('${v}')">${l}</button>`
      ).join('')}
      <span class="fc-progress">${fcState.current + 1} / ${total}</span>
    </div>

    <div class="q-meta" style="margin-bottom:1rem">
      ${chapterBadge(card.chapter)}
      <span class="badge badge-theme">${card.theme}</span>
    </div>

    <div class="flashcard-wrap" onclick="flipCard()">
      <div class="flashcard ${fcState.flipped ? 'flipped' : ''}" id="fc-card">
        <div class="card-face card-front">
          <div class="card-label">Terme / Concept</div>
          <div class="card-content">${escapeHtml(card.front)}</div>
          <div class="card-hint">Clique pour voir la définition</div>
        </div>
        <div class="card-face card-back">
          <div class="card-label">Définition / Explication</div>
          <div class="card-content">${escapeHtml(card.back)}</div>
        </div>
      </div>
    </div>

    <div class="fc-nav">
      <button class="fc-nav-btn" onclick="prevFC()" ${fcState.current === 0 ? 'disabled' : ''}>←</button>
      <div class="fc-dot-row">
        ${fcState.cards.map((_, i) => {
          let cls = '';
          if (i === fcState.current) cls = 'current';
          else if (fcState.seen.has(i)) cls = 'seen';
          return `<div class="fc-dot ${cls}"></div>`;
        }).join('')}
      </div>
      <button class="fc-nav-btn" onclick="nextFC()" ${fcState.current === total - 1 ? 'disabled' : ''}>→</button>
    </div>

    <div style="text-align:center;margin-top:1.5rem">
      <button class="btn-secondary" onclick="shuffleFCAll()">🔀 Mélanger</button>
    </div>
  `;
}

function flipCard() {
  fcState.flipped = !fcState.flipped;
  const card = document.getElementById('fc-card');
  if (card) card.classList.toggle('flipped', fcState.flipped);
}

function nextFC() {
  if (fcState.current < fcState.cards.length - 1) {
    fcState.current++;
    fcState.flipped = false;
    renderFCUI();
  }
}

function prevFC() {
  if (fcState.current > 0) {
    fcState.current--;
    fcState.flipped = false;
    renderFCUI();
  }
}

function changeFCChapter(ch) {
  fcState.chapter = ch;
  fcState.cards = filterFC();
  fcState.current = 0;
  fcState.flipped = false;
  fcState.seen = new Set();
  renderFCUI();
}

function shuffleFCAll() {
  fcState.cards = shuffle(fcState.cards);
  fcState.current = 0;
  fcState.flipped = false;
  fcState.seen = new Set();
  renderFCUI();
}

function chapterBadge(chapter) {
  const ch = QCM_DATA.chapters[chapter];
  const color = ch ? ch.color : '#6b7280';
  return `<span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${escapeHtml(chapter)}</span>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// COURS
// ============================================================
let coursState = { chapter: null, openSections: new Set() };

function renderCours() {
  const chapter = COURS_DATA.find(c => c.id === coursState.chapter) || COURS_DATA[0];

  document.getElementById('app').innerHTML = `
    <div class="cours-layout">
      <nav class="cours-nav">
        ${COURS_DATA.map(ch => `
          <div class="cours-nav-item ${coursState.chapter === ch.id ? 'active' : ''}"
               onclick="selectCoursChapter('${ch.id}')"
               style="${coursState.chapter === ch.id ? `border-left-color:${ch.color}` : 'color:var(--text2)'}">
            ${ch.id} — ${ch.title}
          </div>
        `).join('')}
      </nav>
      <div class="cours-content-area">
        <div class="cours-chapter-title" style="border-bottom-color:${chapter.color}">${chapter.title}</div>
        ${chapter.sections.map((sec, i) => {
          const key = `${chapter.id}_${i}`;
          const isOpen = coursState.openSections.has(key);
          return `
            <div class="cours-section">
              <div class="cours-section-header" onclick="toggleSection('${key}')">
                <span>${sec.title}</span>
                <span class="chevron ${isOpen ? 'open' : ''}">▶</span>
              </div>
              <div class="cours-section-body ${isOpen ? 'open' : ''}">
                ${renderMarkdown(sec.content)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function selectCoursChapter(id) {
  coursState.chapter = id;
  coursState.openSections = new Set();
  renderCours();
}

function toggleSection(key) {
  if (coursState.openSections.has(key)) {
    coursState.openSections.delete(key);
  } else {
    coursState.openSections.add(key);
  }
  // Re-render only the section body
  const section = document.querySelector(`[onclick="toggleSection('${key}')"]`);
  if (section) {
    const parent = section.parentElement;
    const chevron = section.querySelector('.chevron');
    const body = parent.querySelector('.cours-section-body');
    const isOpen = coursState.openSections.has(key);
    if (chevron) chevron.classList.toggle('open', isOpen);
    if (body) body.classList.toggle('open', isOpen);
  }
}

function renderMarkdown(text) {
  // Handle table first
  if (text.includes('|---')) {
    return renderMarkdownWithTable(text);
  }

  let html = text
    .split('\n\n')
    .map(block => {
      if (block.trim().startsWith('**') && block.trim().endsWith('**') && !block.includes('\n')) {
        return `<p><strong>${block.trim().slice(2, -2)}</strong></p>`;
      }
      if (block.includes('\n- ') || block.startsWith('- ')) {
        const lines = block.split('\n');
        let out = '';
        let inList = false;
        for (const line of lines) {
          if (line.startsWith('- ') || line.startsWith('  - ')) {
            const indent = line.startsWith('  - ');
            const content = inlineMarkdown(line.replace(/^  ?- /, ''));
            if (!inList) { out += '<ul>'; inList = true; }
            if (indent) out += `<ul><li>${content}</li></ul>`;
            else out += `<li>${content}</li>`;
          } else {
            if (inList) { out += '</ul>'; inList = false; }
            if (line.trim()) out += `<p>${inlineMarkdown(line)}</p>`;
          }
        }
        if (inList) out += '</ul>';
        return out;
      }
      const lines = block.split('\n').filter(l => l.trim());
      return lines.map(l => `<p>${inlineMarkdown(l)}</p>`).join('');
    })
    .join('');

  return html;
}

function renderMarkdownWithTable(text) {
  const blocks = text.split('\n\n');
  return blocks.map(block => {
    if (!block.includes('|---')) {
      return renderMarkdown(block);
    }
    const rows = block.split('\n').filter(r => r.trim() && !r.match(/^\|[-|\s]+\|$/));
    let html = '<table class="md-table"><thead>';
    rows.forEach((row, ri) => {
      const cells = row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
      if (ri === 0) {
        html += '<tr>' + cells.map(c => `<th>${inlineMarkdown(c.trim())}</th>`).join('') + '</tr></thead><tbody>';
      } else {
        html += '<tr>' + cells.map(c => `<td>${inlineMarkdown(c.trim())}</td>`).join('') + '</tr>';
      }
    });
    html += '</tbody></table>';
    return html;
  }).join('');
}

function inlineMarkdown(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const stats = PROGRESS.questionStats;
  const sessions = PROGRESS.sessions;
  const allQ = QCM_DATA.questions;

  const totalAttempts = Object.values(stats).reduce((s, v) => s + v.attempts, 0);
  const totalCorrect = Object.values(stats).reduce((s, v) => s + v.correct, 0);
  const globalPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const uniqueSeen = Object.keys(stats).length;

  document.getElementById('app').innerHTML = `
    <div class="section-title">📊 Statistiques</div>

    <div class="dashboard-grid">
      <div class="dash-card">
        <div class="value">${sessions.length}</div>
        <div class="label">Sessions totales</div>
      </div>
      <div class="dash-card">
        <div class="value">${uniqueSeen} / ${allQ.length}</div>
        <div class="label">Questions vues</div>
      </div>
      <div class="dash-card">
        <div class="value">${globalPct}%</div>
        <div class="label">Taux de réussite global</div>
      </div>
      <div class="dash-card">
        <div class="value">${totalAttempts}</div>
        <div class="label">Réponses données</div>
      </div>
    </div>

    <div class="chapter-stats">
      ${Object.keys(QCM_DATA.chapters).map(ch => {
        const chQ = allQ.filter(q => q.chapter === ch);
        const chStats = chQ.map(q => stats[q.id]).filter(Boolean);
        const chAttempts = chStats.reduce((s, v) => s + v.attempts, 0);
        const chCorrect = chStats.reduce((s, v) => s + v.correct, 0);
        const chPct = chAttempts > 0 ? Math.round((chCorrect / chAttempts) * 100) : 0;
        const chColor = QCM_DATA.chapters[ch].color;
        const barColor = chPct >= 80 ? 'var(--green)' : chPct >= 50 ? 'var(--yellow)' : chPct > 0 ? 'var(--red)' : 'var(--border)';
        return `
          <div class="chapter-stat-card" style="border-top-color:${chColor}">
            <div class="ch-stat-header">${ch} — ${QCM_DATA.chapters[ch].title}</div>
            <div class="ch-stat-bar-wrap">
              <div class="ch-stat-bar" style="width:${chPct}%;background:${barColor}"></div>
            </div>
            <div class="ch-stat-meta">
              ${chPct}% de réussite · ${chStats.length}/${chQ.length} questions vues
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="sessions-list">
      <h3>Historique des sessions (${sessions.length})</h3>
      ${sessions.length === 0 ? `
        <div class="empty-state">
          <div class="icon">📈</div>
          <p>Pas encore de session. Lance ton premier QCM !</p>
        </div>
      ` : sessions.slice(0, 15).map(s => {
        const pct = Math.round((s.correct / s.total) * 100);
        const cls = pct >= 80 ? 'great' : pct >= 50 ? 'ok' : 'bad';
        const date = new Date(s.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const modeLabel = { normal: 'Normal', adaptive: 'Adaptatif', timed: 'Chrono', review: 'Erreurs' }[s.mode] || s.mode;
        return `
          <div class="session-item">
            <div class="session-score ${cls}">${s.correct}/${s.total}</div>
            <div class="session-meta">
              ${pct}% · ${s.chapter === 'all' ? 'Tout' : s.chapter} · ${modeLabel} · ${formatDuration(s.duration)}
            </div>
            <div style="color:var(--text2);font-size:0.8rem">${date}</div>
          </div>
        `;
      }).join('')}
    </div>

    ${sessions.length > 0 ? `
      <button class="reset-btn" onclick="resetProgress()">🗑 Réinitialiser les statistiques</button>
    ` : ''}
  `;
}

async function resetProgress() {
  if (!confirm('Réinitialiser toutes les statistiques ? Cette action est irréversible.')) return;
  try {
    await fetch('/api/progress', { method: 'DELETE' });
    PROGRESS = { sessions: [], questionStats: {} };
  } catch (e) {
    PROGRESS = { sessions: [], questionStats: {} };
  }
  renderDashboard();
}

// ============================================================
// IMPORT
// ============================================================
const importFiles = { questions: null, flashcards: null, cours: null };

function renderImport() {
  document.getElementById('app').innerHTML = `
    <div class="import-page">
      <div class="section-title">📥 Importer un cours</div>
      <p class="import-subtitle">Sélectionne les 3 fichiers JSON générés par Claude pour charger un nouveau cours.</p>

      <div class="import-grid">
        <label class="import-slot" id="slot-questions">
          <input type="file" accept=".json" style="display:none" onchange="handleImportFile(event,'questions')">
          <span class="import-icon">📝</span>
          <span class="import-label">questions.json</span>
          <span class="import-status" id="status-questions">Aucun fichier</span>
        </label>
        <label class="import-slot" id="slot-flashcards">
          <input type="file" accept=".json" style="display:none" onchange="handleImportFile(event,'flashcards')">
          <span class="import-icon">🃏</span>
          <span class="import-label">flashcards.json</span>
          <span class="import-status" id="status-flashcards">Aucun fichier</span>
        </label>
        <label class="import-slot" id="slot-cours">
          <input type="file" accept=".json" style="display:none" onchange="handleImportFile(event,'cours')">
          <span class="import-icon">📖</span>
          <span class="import-label">cours.json</span>
          <span class="import-status" id="status-cours">Aucun fichier</span>
        </label>
      </div>

      <button class="import-btn" id="import-submit" disabled onclick="submitImport()">
        Importer le cours
      </button>
      <div id="import-result"></div>
    </div>
  `;
  importFiles.questions = null;
  importFiles.flashcards = null;
  importFiles.cours = null;
}

function handleImportFile(event, key) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      importFiles[key] = JSON.parse(e.target.result);
      document.getElementById(`status-${key}`).textContent = '✓ ' + file.name;
      document.getElementById(`slot-${key}`).classList.add('loaded');
    } catch {
      document.getElementById(`status-${key}`).textContent = '✗ JSON invalide';
    }
    const allLoaded = importFiles.questions && importFiles.flashcards && importFiles.cours;
    document.getElementById('import-submit').disabled = !allLoaded;
  };
  reader.readAsText(file);
}

async function submitImport() {
  const btn = document.getElementById('import-submit');
  const result = document.getElementById('import-result');
  btn.disabled = true;
  btn.textContent = 'Import en cours…';
  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: importFiles.questions,
        flashcards: importFiles.flashcards,
        cours: importFiles.cours
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    const statsNote = data.returning ? '📊 Statistiques restaurées' : '📊 Nouveau cours — stats vierges';
    result.innerHTML = `<div class="import-success">
      ✅ ${data.courseId} — ${data.stats.questions} questions · ${data.stats.flashcards} flashcards · ${data.stats.chapters} chapitres
      <br><small>${statsNote} · Rechargement dans 2s…</small>
    </div>`;
    setTimeout(() => location.reload(), 2000);
  } catch (e) {
    result.innerHTML = `<div class="import-error">✗ ${e.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Importer le cours';
  }
}
