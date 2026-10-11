import express, { Request, Response } from 'express';
import cors from 'cors';
import { db, queryRawAll, queryRawGet } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { calculateMatch, compareMatches, Candidate, Job, MatchResult } from './matching/engine.js';
import { runSqlDetective } from './sql-detective/run.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize / ensure DB is seeded upon launch
try {
  const candidateCount = queryRawGet<{ count: number }>('SELECT count(*) as count FROM candidates');
  if (!candidateCount || candidateCount.count === 0) {
    console.log('[Startup] Seeding database with initial candidates and jobs...');
    seedDatabase();
  }
} catch {
  console.log('[Startup] Table not found, seeding database...');
  seedDatabase();
}

/**
 * Root Landing Page: Interactive RecruiterBot & SQL Detective Dashboard
 * Displays Candidate, Job, and Match results tables exactly as shown in the PDF,
 * plus interactive forms for data insertion according to table columns.
 */
app.get('/', (_req: Request, res: Response) => {
  const candidates = queryRawAll<Candidate>('SELECT * FROM candidates ORDER BY id ASC');
  const jobs = queryRawAll<Job>('SELECT * FROM jobs ORDER BY id ASC');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RecruiterBot Dashboard — Section B</title>
      <style>
        :root {
          --bg: #090d16;
          --card: #131b2e;
          --card-border: #1e293b;
          --accent: #6366f1;
          --accent-hover: #4f46e5;
          --text: #f8fafc;
          --text-muted: #94a3b8;
          --success: #10b981;
          --badge: #334155;
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: var(--bg);
          color: var(--text);
          margin: 0;
          padding: 32px 16px;
          display: flex;
          justify-content: center;
        }
        .container { max-width: 1200px; width: 100%; }
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .logo {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        h1 { margin: 0; font-size: 24px; font-weight: 800; }
        .subtitle { color: var(--text-muted); font-size: 13px; margin-top: 4px; }
        .badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill {
          background: var(--card);
          border: 1px solid var(--card-border);
          color: #a5b4fc;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 9999px;
        }
        .tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--card-border);
          padding-bottom: 8px;
          overflow-x: auto;
        }
        .tab-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .tab-btn.active { background: var(--accent); color: #fff; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .card {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
          margin-bottom: 24px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .card-title { font-size: 18px; font-weight: 700; margin: 0; }
        .card-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
        .table-responsive {
          overflow-x: auto;
          border: 1px solid var(--card-border);
          border-radius: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        th {
          background: #0f172a;
          color: #94a3b8;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 12px 14px;
          border-bottom: 1px solid var(--card-border);
        }
        td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #e2e8f0;
          vertical-align: top;
        }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .tag {
          display: inline-block;
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 11px;
          margin: 2px 2px 2px 0;
        }
        .score-pill {
          font-family: monospace;
          font-weight: 800;
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 4px 8px;
          border-radius: 8px;
          display: inline-block;
        }
        select, input, textarea {
          background: #0f172a;
          border: 1px solid var(--card-border);
          color: #fff;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          width: 100%;
        }
        select:focus, input:focus, textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .btn {
          background: var(--accent);
          color: #fff;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn:hover { background: var(--accent-hover); }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 12px; font-weight: 700; color: #cbd5e1; }
        .json-box {
          background: #0a0f1d;
          border: 1px solid var(--card-border);
          padding: 14px;
          border-radius: 12px;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
          color: #38bdf8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <header>
          <div class="brand">
            <div class="logo">🤖</div>
            <div>
              <h1>RecruiterBot &amp; SQL Detective</h1>
              <div class="subtitle">Section B • Raw SQLite (Zero ORMs) • Multi-Factor Matching Engine</div>
            </div>
          </div>
          <div class="badges">
            <span class="pill">Candidates: ${candidates.length}</span>
            <span class="pill">Jobs: ${jobs.length}</span>
            <span class="pill">Port: ${PORT}</span>
            <span class="pill" style="border-color: #10b981; color: #34d399;">Raw SQL Only</span>
          </div>
        </header>

        <!-- Navigation Tabs -->
        <nav class="tabs" role="tablist">
          <button class="tab-btn active" onclick="switchTab('candidates')">📋 Candidates Table</button>
          <button class="tab-btn" onclick="switchTab('jobs')">💼 Jobs Table</button>
          <button class="tab-btn" onclick="switchTab('match-jobs')">🎯 Candidate Matching (Job)</button>
          <button class="tab-btn" onclick="switchTab('match-candidates')">🔄 Reverse Matching (Candidate)</button>
          <button class="tab-btn" onclick="switchTab('insert')">➕ Data Insertion</button>
          <button class="tab-btn" onclick="switchTab('sql')">🔍 SQL Detective Tables</button>
        </nav>

        <!-- TAB 1: Candidates Table (Matching PDF format) -->
        <div id="tab-candidates" class="tab-content active">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Seed Data: Candidates Table</h2>
                <div class="card-desc">Exact schema as given in Section B of the take-home brief</div>
              </div>
              <button class="btn" onclick="switchTab('insert')">+ Insert Candidate</button>
            </div>
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Skills</th>
                    <th>Experience (yrs)</th>
                    <th>Availability</th>
                    <th>Traits</th>
                    <th>Quirk</th>
                  </tr>
                </thead>
                <tbody>
                  ${candidates.map(c => `
                    <tr>
                      <td style="font-family: monospace; color: var(--text-muted);">${c.id}</td>
                      <td style="font-weight: 700; color: #fff;">${c.name}</td>
                      <td>${c.skills.split(',').map(s => `<span class="tag">${s.trim()}</span>`).join('')}</td>
                      <td style="text-align: center; font-weight: 700;">${c.experience_years}</td>
                      <td>
                        <span style="font-size: 11px; font-weight: 700; color: ${
                          c.availability === 'Immediate' ? '#34d399' : c.availability === '2 weeks' ? '#fbbf24' : '#94a3b8'
                        }">
                          ${c.availability}
                        </span>
                      </td>
                      <td style="color: #cbd5e1;">${c.traits}</td>
                      <td style="font-size: 12px; color: #94a3b8; font-style: italic;">"${c.quirk}"</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB 2: Jobs Table (Matching PDF format) -->
        <div id="tab-jobs" class="tab-content">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Seed Data: Jobs Table</h2>
                <div class="card-desc">Exact job openings as specified in Section B take-home brief</div>
              </div>
              <button class="btn" onclick="switchTab('insert')">+ Insert Job</button>
            </div>
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Required Skills</th>
                    <th>Min Experience</th>
                    <th>Culture Keywords</th>
                    <th>Tagline</th>
                  </tr>
                </thead>
                <tbody>
                  ${jobs.map(j => `
                    <tr>
                      <td style="font-family: monospace; color: var(--text-muted);">${j.id}</td>
                      <td style="font-weight: 700; color: #fff;">${j.title}</td>
                      <td>${j.required_skills.split(',').map(s => `<span class="tag">${s.trim()}</span>`).join('')}</td>
                      <td style="text-align: center; font-weight: 700;">${j.min_experience} yrs</td>
                      <td style="color: #cbd5e1;">${j.culture_keywords}</td>
                      <td style="font-size: 12px; color: #94a3b8; font-style: italic;">"${j.tagline}"</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB 3: Candidate Matching for a Job -->
        <div id="tab-match-jobs" class="tab-content">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Candidate Matching Results by Job</h2>
                <div class="card-desc">Ranks all candidates for the selected job with multi-factor scoring (GET /jobs/:id/matches)</div>
              </div>
              <div style="min-width: 250px;">
                <select id="job-select" onchange="loadJobMatches()">
                  ${jobs.map(j => `<option value="${j.id}">${j.id}. ${j.title}</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="job-matches-container">
              <p style="color: var(--text-muted);">Loading ranked matches...</p>
            </div>
          </div>
        </div>

        <!-- TAB 4: Reverse Matching (Jobs for Candidate) -->
        <div id="tab-match-candidates" class="tab-content">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Job Matching Results by Candidate</h2>
                <div class="card-desc">Reverse matching: Ranks all jobs for the selected candidate (GET /candidates/:id/matches)</div>
              </div>
              <div style="min-width: 250px;">
                <select id="candidate-select" onchange="loadCandidateMatches()">
                  ${candidates.map(c => `<option value="${c.id}">${c.id}. ${c.name} (${c.experience_years} yrs)</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="candidate-matches-container">
              <p style="color: var(--text-muted);">Loading ranked matches...</p>
            </div>
          </div>
        </div>

        <!-- TAB 5: Data Insertion According to Table Columns -->
        <div id="tab-insert" class="tab-content">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Data Insertion: Add Candidate</h2>
                <div class="card-desc">Insert a new candidate row according to the Candidates table columns via raw SQL (POST /candidates)</div>
              </div>
            </div>
            <form onsubmit="handleCandidateSubmit(event)">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Name *</label>
                  <input type="text" id="cand-name" placeholder="e.g. John Watson" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Skills (comma-separated) *</label>
                  <input type="text" id="cand-skills" placeholder="e.g. forensics, medicine, strategy" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Experience (yrs) *</label>
                  <input type="number" id="cand-exp" min="0" placeholder="e.g. 5" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Availability *</label>
                  <select id="cand-avail" required>
                    <option value="Immediate">Immediate</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="Not looking">Not looking</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Traits *</label>
                  <input type="text" id="cand-traits" placeholder="e.g. loyal, meticulous" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Quirk *</label>
                  <input type="text" id="cand-quirk" placeholder="e.g. Chronicler of unusual bugs" required />
                </div>
              </div>
              <button type="submit" class="btn">Insert Candidate into SQLite</button>
            </form>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Data Insertion: Add Job</h2>
                <div class="card-desc">Insert a new job opening according to the Jobs table columns via raw SQL (POST /jobs)</div>
              </div>
            </div>
            <form onsubmit="handleJobSubmit(event)">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Title *</label>
                  <input type="text" id="job-title" placeholder="e.g. Security Specialist" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Required Skills (comma-separated) *</label>
                  <input type="text" id="job-skills" placeholder="e.g. security, forensics" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Min Experience *</label>
                  <input type="number" id="job-exp" min="0" placeholder="e.g. 3" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Culture Keywords *</label>
                  <input type="text" id="job-culture" placeholder="e.g. vigilant, detail-oriented" required />
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                  <label class="form-label">Tagline *</label>
                  <input type="text" id="job-tagline" placeholder="e.g. Protect production from the impossible." required />
                </div>
              </div>
              <button type="submit" class="btn">Insert Job into SQLite</button>
            </form>
          </div>
        </div>

        <!-- TAB 6: SQL Detective Tables -->
        <div id="tab-sql" class="tab-content">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">The SQL Detective Challenge (Part 2)</h2>
                <div class="card-desc">Hand-written raw SQL queries from sql_detective.sql executed live against SQLite</div>
              </div>
              <button class="btn" onclick="loadSqlDetective()">Execute Queries Live</button>
            </div>
            <div id="sql-results-container">
              <p style="color: var(--text-muted);">Click "Execute Queries Live" or open to view results.</p>
            </div>
          </div>
        </div>
      </div>

      <script>
        function switchTab(tabId) {
          document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          
          const targetContent = document.getElementById('tab-' + tabId);
          if (targetContent) targetContent.classList.add('active');
          
          const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
          if (activeBtn) activeBtn.classList.add('active');

          if (tabId === 'match-jobs') loadJobMatches();
          if (tabId === 'match-candidates') loadCandidateMatches();
          if (tabId === 'sql') loadSqlDetective();
        }

        async function loadJobMatches() {
          const jobId = document.getElementById('job-select').value;
          const container = document.getElementById('job-matches-container');
          container.innerHTML = '<p style="color: var(--text-muted);">Computing multi-factor matching scores...</p>';
          
          try {
            const res = await fetch('/jobs/' + jobId + '/matches');
            const data = await res.json();
            
            let html = '<div class="table-responsive"><table><thead><tr>';
            html += '<th>Rank</th><th>Candidate Name</th><th>Match Score</th><th>Matched Skills</th><th>Exp Pts</th><th>Culture Pts</th><th>Avail Pts</th><th>Match Reason</th>';
            html += '</tr></thead><tbody>';
            
            data.matches.forEach((m, idx) => {
              html += '<tr>';
              html += '<td style="font-weight: 800; color: #a5b4fc;">#' + (idx + 1) + '</td>';
              html += '<td style="font-weight: 700; color: #fff;">' + m.candidateName + '</td>';
              html += '<td><span class="score-pill">' + m.score + '/100</span></td>';
              html += '<td>' + (m.matchingSkills.length > 0 ? m.matchingSkills.map(s => '<span class="tag">' + s + '</span>').join('') : '<span style="color: #64748b;">None</span>') + '</td>';
              html += '<td style="text-align: center;">' + m.scoreBreakdown.experienceScore + '/25</td>';
              html += '<td style="text-align: center;">' + m.scoreBreakdown.cultureScore + '/15</td>';
              html += '<td style="text-align: center;">' + m.scoreBreakdown.availabilityScore + '/10</td>';
              html += '<td style="font-size: 12px; color: #cbd5e1; max-width: 320px;">' + m.reason + '</td>';
              html += '</tr>';
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
          } catch (err) {
            container.innerHTML = '<p style="color: #f87171;">Failed to fetch matches: ' + err + '</p>';
          }
        }

        async function loadCandidateMatches() {
          const candId = document.getElementById('candidate-select').value;
          const container = document.getElementById('candidate-matches-container');
          container.innerHTML = '<p style="color: var(--text-muted);">Computing reverse matches...</p>';
          
          try {
            const res = await fetch('/candidates/' + candId + '/matches');
            const data = await res.json();
            
            let html = '<div class="table-responsive"><table><thead><tr>';
            html += '<th>Rank</th><th>Job Title</th><th>Match Score</th><th>Matched Skills</th><th>Exp Pts</th><th>Culture Pts</th><th>Avail Pts</th><th>Match Reason</th>';
            html += '</tr></thead><tbody>';
            
            data.matches.forEach((m, idx) => {
              html += '<tr>';
              html += '<td style="font-weight: 800; color: #a5b4fc;">#' + (idx + 1) + '</td>';
              html += '<td style="font-weight: 700; color: #fff;">' + m.jobTitle + '</td>';
              html += '<td><span class="score-pill">' + m.score + '/100</span></td>';
              html += '<td>' + (m.matchingSkills.length > 0 ? m.matchingSkills.map(s => '<span class="tag">' + s + '</span>').join('') : '<span style="color: #64748b;">None</span>') + '</td>';
              html += '<td style="text-align: center;">' + m.scoreBreakdown.experienceScore + '/25</td>';
              html += '<td style="text-align: center;">' + m.scoreBreakdown.cultureScore + '/15</td>';
              html += '<td style="text-align: center;">' + m.scoreBreakdown.availabilityScore + '/10</td>';
              html += '<td style="font-size: 12px; color: #cbd5e1; max-width: 320px;">' + m.reason + '</td>';
              html += '</tr>';
            });
            html += '</tbody></table></div>';
            container.innerHTML = html;
          } catch (err) {
            container.innerHTML = '<p style="color: #f87171;">Failed to fetch matches: ' + err + '</p>';
          }
        }

        async function handleCandidateSubmit(e) {
          e.preventDefault();
          const payload = {
            name: document.getElementById('cand-name').value,
            skills: document.getElementById('cand-skills').value,
            experience_years: parseInt(document.getElementById('cand-exp').value, 10),
            availability: document.getElementById('cand-avail').value,
            traits: document.getElementById('cand-traits').value,
            quirk: document.getElementById('cand-quirk').value
          };
          
          try {
            const res = await fetch('/candidates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            alert('Candidate inserted successfully via raw SQL!');
            window.location.reload();
          } catch (err) {
            alert('Error inserting candidate: ' + err);
          }
        }

        async function handleJobSubmit(e) {
          e.preventDefault();
          const payload = {
            title: document.getElementById('job-title').value,
            required_skills: document.getElementById('job-skills').value,
            min_experience: parseInt(document.getElementById('job-exp').value, 10),
            culture_keywords: document.getElementById('job-culture').value,
            tagline: document.getElementById('job-tagline').value
          };
          
          try {
            const res = await fetch('/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            alert('Job inserted successfully via raw SQL!');
            window.location.reload();
          } catch (err) {
            alert('Error inserting job: ' + err);
          }
        }

        async function loadSqlDetective() {
          const container = document.getElementById('sql-results-container');
          container.innerHTML = '<p style="color: var(--text-muted);">Executing analytical SQL queries against SQLite...</p>';
          
          try {
            const res = await fetch('/sql-detective/run');
            const data = await res.json();
            
            let html = '';
            data.results.forEach(q => {
              html += '<div style="margin-bottom: 24px;">';
              html += '<h3 style="color: #818cf8; font-size: 15px; margin-bottom: 4px;">' + q.question + '</h3>';
              html += '<pre style="background: #0a0f1d; padding: 10px; border-radius: 8px; font-size: 11px; color: #a5b4fc; border: 1px solid #1e293b;"><code>' + q.sql.trim() + '</code></pre>';
              
              if (q.rows && q.rows.length > 0) {
                const cols = Object.keys(q.rows[0]);
                html += '<div class="table-responsive"><table><thead><tr>';
                cols.forEach(col => { html += '<th>' + col + '</th>'; });
                html += '</tr></thead><tbody>';
                q.rows.forEach(row => {
                  html += '<tr>';
                  cols.forEach(col => {
                    html += '<td style="font-family: monospace;">' + (row[col] !== null ? row[col] : 'NULL') + '</td>';
                  });
                  html += '</tr>';
                });
                html += '</tbody></table></div>';
              }
              html += '</div>';
            });
            container.innerHTML = html;
          } catch (err) {
            container.innerHTML = '<p style="color: #f87171;">Failed to run SQL Detective: ' + err + '</p>';
          }
        }
      </script>
    </body>
    </html>
  `);
});

/**
 * Health check
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'RecruiterBot API', timestamp: new Date().toISOString() });
});

/**
 * POST /api/seed (or /seed) - Re-ingest initial dataset
 */
const handleSeed = (_req: Request, res: Response) => {
  try {
    seedDatabase();
    res.json({ message: 'Database successfully seeded with seed candidates and jobs.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed database', details: String(error) });
  }
};
app.post('/api/seed', handleSeed);
app.post('/seed', handleSeed);

/**
 * POST /api/candidates (or /candidates) - Data Insertion according to Candidates table columns
 */
const handleInsertCandidate = (req: Request, res: Response) => {
  try {
    const { name, skills, experience_years, availability, traits, quirk } = req.body;
    if (!name || !skills || experience_years === undefined || !availability || !traits || !quirk) {
      return res.status(400).json({
        error: 'Missing required columns according to Candidates table specification.',
        requiredColumns: ['name', 'skills', 'experience_years', 'availability', 'traits', 'quirk'],
      });
    }

    const exp = parseInt(String(experience_years), 10);
    if (isNaN(exp) || exp < 0) {
      return res.status(400).json({ error: 'experience_years must be a non-negative integer' });
    }

    const stmt = db.prepare(`
      INSERT INTO candidates (name, skills, experience_years, availability, traits, quirk)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, skills, exp, availability, traits, quirk);
    const newCandidate = queryRawGet<Candidate>('SELECT * FROM candidates WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Candidate successfully inserted according to table column schema.',
      candidate: newCandidate,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert candidate', details: String(error) });
  }
};
app.post('/api/candidates', handleInsertCandidate);
app.post('/candidates', handleInsertCandidate);

/**
 * POST /api/jobs (or /jobs) - Data Insertion according to Jobs table columns
 */
const handleInsertJob = (req: Request, res: Response) => {
  try {
    const { title, required_skills, min_experience, culture_keywords, tagline } = req.body;
    if (!title || !required_skills || min_experience === undefined || !culture_keywords || !tagline) {
      return res.status(400).json({
        error: 'Missing required columns according to Jobs table specification.',
        requiredColumns: ['title', 'required_skills', 'min_experience', 'culture_keywords', 'tagline'],
      });
    }

    const minExp = parseInt(String(min_experience), 10);
    if (isNaN(minExp) || minExp < 0) {
      return res.status(400).json({ error: 'min_experience must be a non-negative integer' });
    }

    const stmt = db.prepare(`
      INSERT INTO jobs (title, required_skills, min_experience, culture_keywords, tagline)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, required_skills, minExp, culture_keywords, tagline);
    const newJob = queryRawGet<Job>('SELECT * FROM jobs WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Job successfully inserted according to table column schema.',
      job: newJob,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert job', details: String(error) });
  }
};
app.post('/api/jobs', handleInsertJob);
app.post('/jobs', handleInsertJob);

/**
 * GET /api/jobs (or /jobs) - List all jobs
 */
const handleGetJobs = (_req: Request, res: Response) => {
  try {
    const jobs = queryRawAll<Job>('SELECT * FROM jobs ORDER BY id ASC');
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs', details: String(error) });
  }
};
app.get('/api/jobs', handleGetJobs);
app.get('/jobs', handleGetJobs);

/**
 * GET /api/jobs/:id (or /jobs/:id) - Get single job
 */
const handleGetJobById = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const job = queryRawGet<Job>('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!job) {
      return res.status(404).json({ error: `Job with ID ${req.params.id} not found.` });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job', details: String(error) });
  }
};
app.get('/api/jobs/:id', handleGetJobById);
app.get('/jobs/:id', handleGetJobById);

/**
 * GET /api/jobs/:id/matches (or /jobs/:id/matches)
 * Ranked candidates for a job with score and short reason
 */
const handleGetJobMatches = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const job = queryRawGet<Job>('SELECT * FROM jobs WHERE id = ?', [id]);
    if (!job) {
      return res.status(404).json({ error: `Job with ID ${req.params.id} not found.` });
    }

    const candidates = queryRawAll<Candidate>('SELECT * FROM candidates');
    const matches: MatchResult[] = candidates
      .map(candidate => calculateMatch(candidate, job))
      .sort(compareMatches);

    res.json({
      job: {
        id: job.id,
        title: job.title,
        required_skills: job.required_skills,
        min_experience: job.min_experience,
        culture_keywords: job.culture_keywords,
        tagline: job.tagline,
      },
      matchCount: matches.length,
      matches,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute job matches', details: String(error) });
  }
};
app.get('/api/jobs/:id/matches', handleGetJobMatches);
app.get('/jobs/:id/matches', handleGetJobMatches);

/**
 * GET /api/candidates (or /candidates) - List all candidates
 */
const handleGetCandidates = (_req: Request, res: Response) => {
  try {
    const candidates = queryRawAll<Candidate>('SELECT * FROM candidates ORDER BY id ASC');
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidates', details: String(error) });
  }
};
app.get('/api/candidates', handleGetCandidates);
app.get('/candidates', handleGetCandidates);

/**
 * GET /api/candidates/:id (or /candidates/:id) - Get single candidate
 */
const handleGetCandidateById = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const candidate = queryRawGet<Candidate>('SELECT * FROM candidates WHERE id = ?', [id]);
    if (!candidate) {
      return res.status(404).json({ error: `Candidate with ID ${req.params.id} not found.` });
    }
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidate', details: String(error) });
  }
};
app.get('/api/candidates/:id', handleGetCandidateById);
app.get('/candidates/:id', handleGetCandidateById);

/**
 * GET /api/candidates/:id/matches (or /candidates/:id/matches)
 * Ranked jobs for a candidate (reverse direction)
 */
const handleGetCandidateMatches = (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const candidate = queryRawGet<Candidate>('SELECT * FROM candidates WHERE id = ?', [id]);
    if (!candidate) {
      return res.status(404).json({ error: `Candidate with ID ${req.params.id} not found.` });
    }

    const jobs = queryRawAll<Job>('SELECT * FROM jobs');
    const matches: MatchResult[] = jobs
      .map(job => calculateMatch(candidate, job))
      .sort(compareMatches);

    res.json({
      candidate: {
        id: candidate.id,
        name: candidate.name,
        skills: candidate.skills,
        experience_years: candidate.experience_years,
        availability: candidate.availability,
        traits: candidate.traits,
        quirk: candidate.quirk,
      },
      matchCount: matches.length,
      matches,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute candidate matches', details: String(error) });
  }
};
app.get('/api/candidates/:id/matches', handleGetCandidateMatches);
app.get('/candidates/:id/matches', handleGetCandidateMatches);

/**
 * GET /api/sql-detective/run (or /sql-detective/run) - Run Part 2 SQL challenge
 */
const handleSqlDetectiveRun = (_req: Request, res: Response) => {
  try {
    const results = runSqlDetective();
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run SQL Detective queries', details: String(error) });
  }
};
app.get('/api/sql-detective/run', handleSqlDetectiveRun);
app.get('/sql-detective/run', handleSqlDetectiveRun);

// Start server
app.listen(PORT, () => {
  console.log(`[RecruiterBot] Server running at http://localhost:${PORT}`);
  console.log(`[RecruiterBot] Interactive Table Dashboard at http://localhost:${PORT}`);
  console.log(`[RecruiterBot] Available endpoints:`);
  console.log(`  - GET  /jobs`);
  console.log(`  - POST /jobs (Data insertion matching table columns)`);
  console.log(`  - GET  /jobs/:id/matches`);
  console.log(`  - GET  /candidates`);
  console.log(`  - POST /candidates (Data insertion matching table columns)`);
  console.log(`  - GET  /candidates/:id/matches`);
  console.log(`  - POST /seed`);
  console.log(`  - GET  /sql-detective/run`);
});
