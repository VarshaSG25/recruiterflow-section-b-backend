-- =====================================================================
-- RecruiterFlow Backend Developer Assignment
-- Part 2: The SQL Detective Challenge
-- Candidate: Full Stack Intern Applicant
-- =====================================================================

-- Question 1
-- List all currently open job postings, along with the name of the recruiter who owns each one.
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


-- Question 2
-- For each job posting, how many applicants reached the Final interview stage?
SELECT 
    jp.id AS job_posting_id,
    jp.title,
    COUNT(DISTINCT CASE WHEN i.stage = 'Final' THEN i.applicant_id END) AS final_stage_applicant_count
FROM job_postings jp
LEFT JOIN interviews i ON jp.id = i.job_posting_id
GROUP BY jp.id, jp.title
ORDER BY jp.id ASC;


-- Question 3
-- Find every person who effectively applied to more than one job posting. Careful — the data isn't as clean as it looks.
-- Investigation note: The dataset has case duplication (e.g. 'ananya.rao@mail.com' and 'Ananya.Rao@mail.com'
-- representing the same physical candidate with separate applicant IDs applying across multiple jobs).
-- We normalize emails by LOWER(TRIM(email)) to deduplicate applicants into real individuals,
-- then count distinct job postings they have interviews/applications for.
SELECT 
    MIN(a.full_name) AS person_name,
    LOWER(TRIM(a.email)) AS normalized_email,
    COUNT(DISTINCT i.job_posting_id) AS distinct_jobs_applied_count
FROM applicants a
JOIN interviews i ON a.id = i.applicant_id
GROUP BY LOWER(TRIM(a.email))
HAVING COUNT(DISTINCT i.job_posting_id) > 1
ORDER BY distinct_jobs_applied_count DESC, person_name ASC;


-- Question 4
-- For each recruiter, compute their Final-stage conversion rate (passed ÷ total Final-stage interviews),
-- but only include recruiters with at least 3 Final-stage interviews.
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


-- Question 5
-- (Bonus) Using a window function, find the recruiter with the most successful placements
-- (passed at Final stage) per department.
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
