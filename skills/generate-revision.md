---
name: generate-revision
description: Generate a complete revision app (QCM, flashcards, course summaries) from PDF course files. Uses a permanent server at ~/revision-app, generates JSON data files locally, and instructs the user to import them via the web UI.
---

# Skill: /generate-revision

You are generating revision data from university course PDFs.
The revision app is **permanent** — it runs once at `~/revision-app` via PM2.
You generate JSON files locally, then the user imports them via the web UI.

## Step 1 — Find the PDFs

Scan the current working directory for PDF files:
```
Glob("**/*.pdf")
```
List the found PDFs and identify each course chapter (usually named CM1, CM2, etc. or by topic). If no PDFs are found, ask the user where they are.

## Step 2 — Read the PDFs (hybrid approach)

For each PDF, use the following strategy to minimize token usage:

### 2a — Try pdftotext first

```bash
pdftotext -layout "file.pdf" -
```

Count the words in the output. To avoid false positives from cover pages or sparse intro slides, check the word count on **pages 2–4** specifically:

```bash
pdftotext -layout -f 2 -l 4 "file.pdf" - | wc -w
```

If pages 2–4 yield **≥ 150 words total** (≥ 50 words/page average), the PDF is text-rich → use the full pdftotext output directly.

```bash
pdftotext -layout "file.pdf" - | wc -w
```

Quick rule (based on total word count vs page count):
- **≥ 200 words/page average** → text-based PDF, use pdftotext output
- **< 200 words/page average** → image-heavy slides, fall back to visual reading (step 2b)

### 2b — Fallback: visual reading

If pdftotext output is sparse (slides with few text bullets, diagrams, screenshots), read the PDF with the Read tool in chunks of 20 pages. The visual content will be rendered — extract all visible content including diagrams, tables, and annotated screenshots.

### What to extract either way

Take notes on:
- Chapter structure and themes
- Key concepts and definitions
- Processes and mechanisms (how things work)
- Attacks / risks / vulnerabilities if applicable
- Best practices and recommendations
- Any tables, comparisons, or numbered lists
- **If visual**: describe diagrams and their key takeaways — represent them as ASCII art or a structured table when relevant (don't skip them — they often contain the most important information)

## Step 3 — Ensure the permanent app exists

Check if `~/revision-app` exists. If not, clone and install it once:

```bash
if [ ! -d "$HOME/revision-app" ]; then
  # Try SSH first, fall back to HTTPS
  git clone git@github.com:ChewbackK/revision-archi.git ~/revision-app \
    || git clone https://github.com/ChewbackK/revision-archi.git ~/revision-app
  cd ~/revision-app && npm install
fi
```

Do **not** create a new clone per course. This app is shared for all courses.

## Step 4 — Generate questions.json

Create `questions.json` in the **current directory** (the course folder) following this exact schema:

Before generating, get the course ID from the folder name:
```bash
basename "$PWD"
```
Use the output as the `courseId` value (e.g. `"R4B10"`).

Ask the user (optional):
- **Course display title** — e.g. "R4.B.10 — Développement web" (shown as page title and hero heading). Default: courseId.
- **Exam date** — ISO format `"2026-04-15T08:00:00"` if known, for the countdown. Omit if unknown.

```json
{
  "courseId": "R4B10",
  "title": "R4.B.10 — Développement web",
  "subtitle": "BUT2 Informatique",
  "examDate": "2026-04-15T08:00:00",
  "chapters": {
    "CM1": { "title": "...", "color": "#7c3aed" },
    "CM2": { "title": "...", "color": "#0891b2" }
  },
  "questions": [
    {
      "id": "cm1_001",
      "chapter": "CM1",
      "theme": "Topic name",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Full explanation of why the answer is correct and why the others are wrong."
    }
  ]
}
```

**Quality rules for questions:**
- Minimum 15 questions per chapter (aim for 20)
- Questions must test UNDERSTANDING, not memorization of trivia
- Each question must have exactly 4 options (A/B/C/D) or 2 (true/false)
- `correct` is the 0-based index of the correct option
- The explanation must be pedagogically useful — explain the concept, not just confirm the answer
- **CRITICAL: Option lengths MUST be balanced** — All 4 options (correct and distractors) MUST be of roughly the exact same length. The correct answer must NOT be noticeably longer, more detailed, or more precise than the others. If the correct answer is a long sentence, the distractors must also be long, well-argued sentences. The student must not be able to guess the correct answer visually.
- **Distractor quality** — Wrong options must be in the same semantic register as the correct answer: same level of abstraction, same domain vocabulary. Never use obviously absurd or off-topic distractors.
- Cover all major themes from the chapter
- Mix difficulty levels: conceptual, application, comparison
- **Include at least 2 comparison questions per chapter** ("quelle est la différence entre X et Y ?", "lequel de ces protocoles fait X ?")
- Assign a `color` per chapter using a distinct hex color from this palette:
  - CM1: `#7c3aed`, CM2: `#0891b2`, CM3: `#059669`, CM4: `#d97706`, CM5: `#dc2626`, CM6: `#0d9488`

## Step 5 — Generate flashcards.json

Create `flashcards.json` in the **current directory** as a JSON array:

```json
[
  {
    "id": "fc_cm1_01",
    "chapter": "CM1",
    "theme": "Topic name",
    "front": "Term or concept (short)",
    "back": "Full definition, explanation, or how it works. Can use newlines for lists.\n• Point 1\n• Point 2"
  }
]
```

**Rules:**
- 5–8 flashcards per chapter
- Front = the term, acronym, or concept name
- Back = clear explanation with context. **Include a concrete example whenever possible** (ex: "Par exemple, ARP spoofing exploite ce mécanisme en…")
- Prioritize concepts that are tricky, often confused, or central to the exam

## Step 6 — Generate cours.json

Create `cours.json` in the **current directory** as a JSON array of chapters:

```json
[
  {
    "id": "CM1",
    "title": "Chapter full title",
    "color": "#7c3aed",
    "sections": [
      {
        "title": "Section title",
        "content": "Markdown-like content (see formatting rules below)"
      }
    ]
  }
]
```

**Content formatting rules:**
- Use `**bold**` for key terms and important concepts
- Use `- bullet` for lists, `  - sub-bullet` for nested lists
- Use `` `code` `` for commands, file names, protocol names
- Use `\n\n` to separate paragraphs
- Tables: `| Col1 | Col2 |\n|---|---|\n| val | val |` (the parser handles this)
- **Diagrams and schemas**: if the source PDF contains a key diagram, represent it as an ASCII diagram or a structured comparison table in the content — do not skip it
- 4–7 sections per chapter, each covering a coherent sub-topic
- Aim for condensed but complete summaries — not copy-paste of slides

## Step 7 — Ensure the server is running

Check if PM2 is installed, then check if the revision app is already running:

```bash
# Install PM2 globally if not present
command -v pm2 || npm install -g pm2

pm2 list | grep revision-app
```

If not running, start it:

```bash
cd ~/revision-app && pm2 start npm --name "revision-app" -- start
pm2 save
```

If port 4242 is already used by another process, change the port in `~/revision-app/server.js` before starting.

## Step 8 — Tell the user to import

Tell the user:
- The 3 files have been generated in the current directory: `questions.json`, `flashcards.json`, `cours.json`
- The revision app is running at **http://localhost:4242**
- Go to the **Importer** section of the app and upload the 3 files
- Provide a summary: how many questions, flashcards, and course sections were generated per chapter
- Mention any chapters that had less content (so they can add more PDFs)

## Step 9 — Commit the data files

Only commit if the current directory is a git repository:

```bash
if git -C . rev-parse --git-dir > /dev/null 2>&1; then
  git add questions.json flashcards.json cours.json
  git commit -m "Add revision data: <course name> — <N> questions, <N> flashcards"
else
  echo "Not a git repo — skipping commit."
fi
```

## Important notes

- **Never invent facts** — only use content from the PDFs. If a section has little content, say so explicitly.
- **Language** — generate everything in the same language as the PDFs (usually French for university courses).
- **data.json** is gitignored — do not commit it (it's user progress data).
- The 3 generated JSON files (`questions.json`, `flashcards.json`, `cours.json`) stay in the **course folder**, not in the app. The app receives them via the import UI.
