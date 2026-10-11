import { queryRawAll, queryRawGet } from './db/database.js';
import { Candidate, Job, calculateMatch, compareMatches, MatchResult } from './matching/engine.js';
import { seedDatabase } from './db/seed.js';
import { renderTable, Column } from './utils/table-formatter.js';

// ANSI color helpers
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[97m';
const GRAY = '\x1b[90m';

// Ensure database is populated
try {
  const count = queryRawGet<{ count: number }>('SELECT count(*) as count FROM candidates');
  if (!count || count.count === 0) {
    seedDatabase();
  }
} catch {
  seedDatabase();
}

console.log('\n' + BOLD + MAGENTA + '=============================================================================================================================' + RESET);
console.log(BOLD + WHITE + '   RECRUITERFLOW SECTION B: SEED DATA — CANDIDATES TABLE (EXACT SCHEMA AS GIVEN IN PDF)' + RESET);
console.log(BOLD + MAGENTA + '=============================================================================================================================' + RESET + '\n');

// 1. Render Candidates Table
const rawCandidates = queryRawAll<Candidate>('SELECT * FROM candidates ORDER BY id ASC');

const candidateColumns: Column<Candidate>[] = [
  { header: 'ID', width: 4, align: 'center', value: c => `${c.id}` },
  { header: 'Name', width: 14, align: 'left', value: c => BOLD + WHITE + c.name + RESET },
  { header: 'Skills', width: 26, align: 'left', value: c => c.skills },
  { header: 'Exp(yrs)', width: 8, align: 'center', value: c => `${c.experience_years}` },
  {
    header: 'Availability',
    width: 12,
    align: 'center',
    value: c => {
      if (c.availability === 'Immediate') return GREEN + c.availability + RESET;
      if (c.availability === '2 weeks') return YELLOW + c.availability + RESET;
      return GRAY + c.availability + RESET;
    },
  },
  { header: 'Traits', width: 18, align: 'left', value: c => c.traits },
  { header: 'Quirk', width: 36, align: 'left', value: c => `"${c.quirk}"` },
];

console.log(renderTable(rawCandidates, candidateColumns));

console.log('\n' + BOLD + MAGENTA + '=============================================================================================================================' + RESET);
console.log(BOLD + WHITE + '   RECRUITERFLOW SECTION B: SEED DATA — JOBS TABLE (EXACT SCHEMA AS GIVEN IN PDF)' + RESET);
console.log(BOLD + MAGENTA + '=============================================================================================================================' + RESET + '\n');

// 2. Render Jobs Table
const rawJobs = queryRawAll<Job>('SELECT * FROM jobs ORDER BY id ASC');

const jobColumns: Column<Job>[] = [
  { header: 'ID', width: 4, align: 'center', value: j => `${j.id}` },
  { header: 'Title', width: 22, align: 'left', value: j => BOLD + WHITE + j.title + RESET },
  { header: 'Required Skills', width: 26, align: 'left', value: j => j.required_skills },
  { header: 'Min Exp', width: 8, align: 'center', value: j => `${j.min_experience} yrs` },
  { header: 'Culture Keywords', width: 20, align: 'left', value: j => j.culture_keywords },
  { header: 'Tagline', width: 36, align: 'left', value: j => `"${j.tagline}"` },
];

console.log(renderTable(rawJobs, jobColumns));

console.log('\n' + BOLD + MAGENTA + '=============================================================================================================================' + RESET);
console.log(BOLD + WHITE + '   RECRUITERFLOW SECTION B: MATCH RESULTS — RANKED CANDIDATES FOR "Backend Detective" (JOB #1)' + RESET);
console.log(BOLD + MAGENTA + '=============================================================================================================================' + RESET + '\n');

// 3. Render Match Results for Job #1
const job1 = queryRawGet<Job>('SELECT * FROM jobs WHERE id = 1');
if (job1) {
  const matches = rawCandidates
    .map(c => calculateMatch(c, job1))
    .sort(compareMatches);

  const matchColumns: Column<MatchResult>[] = [
    {
      header: 'Rank',
      width: 6,
      align: 'center',
      value: (_m, idx) => (idx === 0 ? BOLD + YELLOW + '#1' + RESET : `#${idx + 1}`),
    },
    { header: 'Candidate Name', width: 16, align: 'left', value: m => BOLD + WHITE + m.candidateName + RESET },
    {
      header: 'Score',
      width: 9,
      align: 'center',
      value: m => (m.score >= 80 ? BOLD + GREEN + `${m.score}/100` + RESET : `${m.score}/100`),
    },
    {
      header: 'Matched Skills',
      width: 22,
      align: 'left',
      value: m => (m.matchingSkills.length > 0 ? GREEN + m.matchingSkills.join(', ') + RESET : GRAY + 'None' + RESET),
    },
    {
      header: 'Score Breakdown',
      width: 22,
      align: 'left',
      value: m => `S:${m.scoreBreakdown.skillsScore}/50 E:${m.scoreBreakdown.experienceScore}/25 C:${m.scoreBreakdown.cultureScore}/15 A:${m.scoreBreakdown.availabilityScore}/10`,
    },
    { header: 'Reason & Explanation', width: 42, align: 'left', value: m => m.reason },
  ];

  console.log(renderTable(matches.slice(0, 5), matchColumns));
}

console.log('\n' + BOLD + MAGENTA + '=============================================================================================================================' + RESET);
console.log(BOLD + WHITE + '   RECRUITERFLOW SECTION B: REVERSE MATCH RESULTS — RANKED JOBS FOR "Michael S." (CANDIDATE #11)' + RESET);
console.log(BOLD + MAGENTA + '=============================================================================================================================' + RESET + '\n');

// 4. Render Reverse Match Results for Candidate (Michael S.)
const candidateMichael = queryRawGet<Candidate>("SELECT * FROM candidates WHERE name LIKE 'Michael%' LIMIT 1");
if (candidateMichael) {
  const jobMatches = rawJobs
    .map(j => calculateMatch(candidateMichael, j))
    .sort(compareMatches);

  const reverseColumns: Column<MatchResult>[] = [
    {
      header: 'Rank',
      width: 6,
      align: 'center',
      value: (_m, idx) => (idx === 0 ? BOLD + YELLOW + '#1' + RESET : `#${idx + 1}`),
    },
    { header: 'Job Title', width: 24, align: 'left', value: m => BOLD + WHITE + m.jobTitle + RESET },
    {
      header: 'Score',
      width: 9,
      align: 'center',
      value: m => (m.score >= 60 ? BOLD + GREEN + `${m.score}/100` + RESET : `${m.score}/100`),
    },
    {
      header: 'Matched Skills',
      width: 20,
      align: 'left',
      value: m => (m.matchingSkills.length > 0 ? GREEN + m.matchingSkills.join(', ') + RESET : GRAY + 'None' + RESET),
    },
    {
      header: 'Score Breakdown',
      width: 22,
      align: 'left',
      value: m => `S:${m.scoreBreakdown.skillsScore}/50 E:${m.scoreBreakdown.experienceScore}/25 C:${m.scoreBreakdown.cultureScore}/15 A:${m.scoreBreakdown.availabilityScore}/10`,
    },
    { header: 'Reason & Explanation', width: 40, align: 'left', value: m => m.reason },
  ];

  console.log(renderTable(jobMatches, reverseColumns));
}

console.log('\n');
