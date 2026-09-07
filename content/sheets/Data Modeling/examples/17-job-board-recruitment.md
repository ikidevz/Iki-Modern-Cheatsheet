# 17. Job Board / Recruitment

## Scenario

A recruitment platform where companies post jobs, candidates apply, and each application moves through a hiring pipeline (applied → screening → interview → offer → hired/rejected). The modeling focus: **tracking an application's progress through stages over time**, not just its current state.

## Entities & Relationships

| Entity | Description |
|---|---|
| Company | An employer posting jobs |
| Job_Posting | A specific open role |
| Candidate | A person applying for jobs |
| Application | A candidate's application to a specific job posting |
| Application_Stage_History | Audit trail of every pipeline stage an application has passed through |
| Interview | A scheduled interview tied to an application |

```
Company 1───N Job_Posting 1───N Application N───1 Candidate
Application 1───N Application_Stage_History
Application 1───N Interview
```

## Schema (PostgreSQL)

```sql
CREATE TABLE company (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE job_posting (
    job_posting_id BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES company(company_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('draft','open','closed','filled')),
    posted_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE candidate (
    candidate_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    resume_url VARCHAR(500)
);

CREATE TABLE application (
    application_id BIGSERIAL PRIMARY KEY,
    job_posting_id BIGINT NOT NULL REFERENCES job_posting(job_posting_id),
    candidate_id BIGINT NOT NULL REFERENCES candidate(candidate_id),
    current_stage VARCHAR(20) NOT NULL DEFAULT 'applied'
        CHECK (current_stage IN ('applied','screening','interview','offer','hired','rejected')),
    applied_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (job_posting_id, candidate_id)   -- one application per candidate per job
);

-- Full pipeline audit trail — 'current_stage' alone can't answer "how long were they in screening?"
CREATE TABLE application_stage_history (
    history_id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES application(application_id),
    stage VARCHAR(20) NOT NULL,
    entered_at TIMESTAMP NOT NULL DEFAULT now(),
    moved_by VARCHAR(100)              -- recruiter/system that made the change
);

CREATE TABLE interview (
    interview_id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES application(application_id),
    scheduled_at TIMESTAMP NOT NULL,
    interviewer_name VARCHAR(100),
    interview_type VARCHAR(30) CHECK (interview_type IN ('phone_screen','technical','onsite','final')),
    outcome VARCHAR(20) CHECK (outcome IN ('pending','pass','fail'))
);

CREATE INDEX idx_application_job ON application(job_posting_id, current_stage);
CREATE INDEX idx_stage_history_application ON application_stage_history(application_id, entered_at);
```

## Sample Queries

**Pipeline overview for a job posting (count of candidates per stage):**
```sql
SELECT current_stage, COUNT(*) AS candidate_count
FROM application
WHERE job_posting_id = 100
GROUP BY current_stage;
```

**Move an application to the next stage (update + log):**
```sql
BEGIN;
UPDATE application SET current_stage = 'interview' WHERE application_id = 5001;
INSERT INTO application_stage_history (application_id, stage, moved_by)
VALUES (5001, 'interview', 'recruiter_jane');
COMMIT;
```

**Average time candidates spend in each stage (using the history table):**
```sql
SELECT stage,
       AVG(next_entered_at - entered_at) AS avg_duration
FROM (
    SELECT stage, entered_at,
           LEAD(entered_at) OVER (PARTITION BY application_id ORDER BY entered_at) AS next_entered_at
    FROM application_stage_history
) sub
WHERE next_entered_at IS NOT NULL
GROUP BY stage;
```

**Upcoming interviews for a recruiter's dashboard:**
```sql
SELECT c.name AS candidate, jp.title AS job_title, i.scheduled_at, i.interview_type
FROM interview i
JOIN application a ON i.application_id = a.application_id
JOIN candidate c ON a.candidate_id = c.candidate_id
JOIN job_posting jp ON a.job_posting_id = jp.job_posting_id
WHERE i.scheduled_at > now()
ORDER BY i.scheduled_at ASC;
```

## Design Decisions & Trade-offs

- **`application.current_stage` gives fast access to "where is this candidate right now"**, while `application_stage_history` preserves the full journey — the same current-state-plus-audit-trail pattern used in the ride-sharing trip example (13) and the subscription billing example (7). Recruiting analytics (time-to-hire, stage bottlenecks) are impossible without the history table.
- **`UNIQUE (job_posting_id, candidate_id)`** enforces the real-world rule that a candidate applies once per job posting — reapplying would need an explicit business decision (allow a new application after N months, update the existing one, etc.) rather than silently allowing duplicates.
- **`interview` is a separate entity from `application_stage_history`** because interviews carry rich attributes (interviewer, type, outcome, scheduling) that don't belong in a generic stage-transition log — a good example of not overloading one audit table with responsibilities that deserve their own entity (see cheatsheet file 10, "God Table" anti-pattern).
- **Stage values are constrained via `CHECK`**, appropriate for a small, stable, well-known pipeline. If different companies needed fully custom pipeline stages (e.g., "Take-home test" as a company-specific stage), a `pipeline_stage` lookup table scoped per company would replace the fixed `CHECK` list.

## Common Pitfalls

- Tracking only `current_stage` with no history — makes it impossible to answer common recruiting-ops questions like "which stage has the highest drop-off rate" or "how long does our interview process actually take."
- Not enforcing one-application-per-candidate-per-job, allowing accidental duplicate applications to clutter pipeline views and skew reporting.
- Hardcoding pipeline stages as an inflexible fixed list when the business actually needs per-company customizable pipelines — worth clarifying this requirement early, since it changes the schema significantly (fixed `CHECK` list vs. a proper `pipeline_stage` table).
- Deleting rejected applications instead of keeping them with a `rejected` stage — loses valuable historical data for reporting and re-engagement ("candidate pool" searches for future openings).

---
[← Previous: Messaging / Chat System](16-messaging-chat-system.md) | [Back to index](00-README.md) | [Next: Polymorphic Associations →](18-polymorphic-associations.md)
