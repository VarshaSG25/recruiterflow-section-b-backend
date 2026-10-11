import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runSqlDetective() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Create an in-memory or dedicated SQLite DB for the hiring ops challenge
  const db = new DatabaseSync(':memory:');
  db.exec(schemaSql);

  const results: Record<string, unknown[]> = {};

  console.log('='.repeat(70));
  console.log('RECRUITERFLOW - THE SQL DETECTIVE CHALLENGE VERIFICATION');
  console.log('='.repeat(70));

  // Q1
  const q1 = `
    SELECT 
        jp.id AS job_posting_id,
        jp.title,
        jp.department,
        r.name AS recruiter_name,
        jp.opened_date
    FROM job_postings jp
    JOIN recruiters r ON jp.recruiter_id = r.id
    WHERE jp.status = 'open'
    ORDER BY jp.id ASC;
  `;
  results.q1 = db.prepare(q1).all();
  console.log('\n--- Question 1: Open Job Postings & Recruiter Owners ---');
  console.table(results.q1);

  // Q2
  const q2 = `
    SELECT 
        jp.id AS job_posting_id,
        jp.title,
        COUNT(DISTINCT CASE WHEN i.stage = 'Final' THEN i.applicant_id END) AS final_stage_applicant_count
    FROM job_postings jp
    LEFT JOIN interviews i ON jp.id = i.job_posting_id
    GROUP BY jp.id, jp.title
    ORDER BY jp.id ASC;
  `;
  results.q2 = db.prepare(q2).all();
  console.log('\n--- Question 2: Applicants Reaching Final Stage per Job Posting ---');
  console.table(results.q2);

  // Q3
  const q3 = `
    SELECT 
        MIN(a.full_name) AS person_name,
        LOWER(TRIM(a.email)) AS normalized_email,
        COUNT(DISTINCT i.job_posting_id) AS distinct_jobs_applied_count
    FROM applicants a
    JOIN interviews i ON a.id = i.applicant_id
    GROUP BY LOWER(TRIM(a.email))
    HAVING COUNT(DISTINCT i.job_posting_id) > 1
    ORDER BY distinct_jobs_applied_count DESC, person_name ASC;
  `;
  results.q3 = db.prepare(q3).all();
  console.log('\n--- Question 3: People Applying to More Than One Job Posting ---');
  console.table(results.q3);

  // Q4
  const q4 = `
    SELECT 
        r.id AS recruiter_id,
        r.name AS recruiter_name,
        COUNT(CASE WHEN i.outcome = 'passed' THEN 1 END) AS passed_final_interviews,
        COUNT(*) AS total_final_interviews,
        ROUND(1.0 * COUNT(CASE WHEN i.outcome = 'passed' THEN 1 END) / COUNT(*), 4) AS conversion_rate
    FROM recruiters r
    JOIN job_postings jp ON r.id = jp.recruiter_id
    JOIN interviews i ON jp.id = i.job_posting_id
    WHERE i.stage = 'Final'
    GROUP BY r.id, r.name
    HAVING COUNT(*) >= 3
    ORDER BY conversion_rate DESC;
  `;
  results.q4 = db.prepare(q4).all();
  console.log('\n--- Question 4: Recruiter Final Stage Conversion Rate (>= 3 interviews) ---');
  console.table(results.q4);

  // Q5
  const q5 = `
    WITH recruiter_placements AS (
        SELECT 
            jp.department,
            r.id AS recruiter_id,
            r.name AS recruiter_name,
            COUNT(*) AS successful_placements,
            DENSE_RANK() OVER (
                PARTITION BY jp.department 
                ORDER BY COUNT(*) DESC
            ) AS rank_in_department
        FROM recruiters r
        JOIN job_postings jp ON r.id = jp.recruiter_id
        JOIN interviews i ON jp.id = i.job_posting_id
        WHERE i.stage = 'Final' AND i.outcome = 'passed'
        GROUP BY jp.department, r.id, r.name
    )
    SELECT 
        department,
        recruiter_id,
        recruiter_name,
        successful_placements
    FROM recruiter_placements
    WHERE rank_in_department = 1
    ORDER BY department ASC;
  `;
  results.q5 = db.prepare(q5).all();
  console.log('\n--- Question 5 (Bonus): Top Recruiter per Department (Window Function) ---');
  console.table(results.q5);

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('run.ts')) {
  runSqlDetective();
}
