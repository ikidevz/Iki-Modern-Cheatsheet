# 15. Learning Management System (LMS)

## Scenario

An online learning platform: students enroll in courses made up of modules and lessons, submit assignments, and receive grades. The modeling focus here is **tracking progress and grading accurately across a nested content structure** (course → module → lesson).

## Entities & Relationships

| Entity | Description |
|---|---|
| Student | A learner |
| Course | A top-level learning offering |
| Module | A section within a course |
| Lesson | Individual content unit within a module |
| Enrollment | M:N between Student and Course, with progress state |
| Assignment | Gradable work tied to a lesson/module |
| Submission | A student's submitted work for an assignment |
| Grade | The recorded score for a submission |

```
Student N───N Course     (via Enrollment)
Course 1───N Module 1───N Lesson
Module 1───N Assignment
Student 1───N Submission N───1 Assignment
Submission 1───1 Grade
```

## Schema (PostgreSQL)

```sql
CREATE TABLE student (
    student_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE course (
    course_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    instructor_name VARCHAR(100)
);

CREATE TABLE module (
    module_id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE lesson (
    lesson_id BIGSERIAL PRIMARY KEY,
    module_id BIGINT NOT NULL REFERENCES module(module_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content_type VARCHAR(20) CHECK (content_type IN ('video','reading','quiz')),
    sort_order INT NOT NULL
);

CREATE TABLE enrollment (
    student_id BIGINT NOT NULL REFERENCES student(student_id),
    course_id BIGINT NOT NULL REFERENCES course(course_id),
    enrolled_at TIMESTAMP NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','completed','dropped')),
    PRIMARY KEY (student_id, course_id)
);

-- Tracks which lessons a student has completed
CREATE TABLE lesson_progress (
    student_id BIGINT NOT NULL REFERENCES student(student_id),
    lesson_id BIGINT NOT NULL REFERENCES lesson(lesson_id),
    completed_at TIMESTAMP,
    PRIMARY KEY (student_id, lesson_id)
);

CREATE TABLE assignment (
    assignment_id BIGSERIAL PRIMARY KEY,
    module_id BIGINT NOT NULL REFERENCES module(module_id),
    title VARCHAR(255) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL,
    due_date TIMESTAMP
);

CREATE TABLE submission (
    submission_id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES assignment(assignment_id),
    student_id BIGINT NOT NULL REFERENCES student(student_id),
    submitted_at TIMESTAMP NOT NULL DEFAULT now(),
    content_url VARCHAR(500),
    UNIQUE (assignment_id, student_id)   -- one submission per student per assignment (simplify: no resubmits)
);

CREATE TABLE grade (
    submission_id BIGINT PRIMARY KEY REFERENCES submission(submission_id),
    score NUMERIC(5,2) NOT NULL,
    feedback TEXT,
    graded_by VARCHAR(100),
    graded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_progress_student ON lesson_progress(student_id);
CREATE INDEX idx_submission_assignment ON submission(assignment_id);
```

## Sample Queries

**A student's course completion percentage:**
```sql
SELECT c.title,
       COUNT(lp.lesson_id) AS lessons_completed,
       (SELECT COUNT(*) FROM lesson l
        JOIN module m ON l.module_id = m.module_id
        WHERE m.course_id = c.course_id) AS total_lessons
FROM enrollment e
JOIN course c ON e.course_id = c.course_id
LEFT JOIN lesson_progress lp ON lp.student_id = e.student_id
    AND lp.lesson_id IN (
        SELECT l.lesson_id FROM lesson l
        JOIN module m ON l.module_id = m.module_id
        WHERE m.course_id = c.course_id
    )
    AND lp.completed_at IS NOT NULL
WHERE e.student_id = 20 AND c.course_id = 1
GROUP BY c.title, c.course_id;
```

**Gradebook for an assignment (all submissions and scores):**
```sql
SELECT st.name, s.submitted_at, g.score, g.feedback
FROM submission s
JOIN student st ON s.student_id = st.student_id
LEFT JOIN grade g ON s.submission_id = g.submission_id
WHERE s.assignment_id = 55
ORDER BY st.name;
```

**Students who haven't submitted an assignment past its due date:**
```sql
SELECT st.name, st.email
FROM enrollment e
JOIN student st ON e.student_id = st.student_id
JOIN assignment a ON a.assignment_id = 55
WHERE e.course_id = (SELECT course_id FROM module WHERE module_id = a.module_id)
  AND a.due_date < now()
  AND NOT EXISTS (
      SELECT 1 FROM submission s WHERE s.assignment_id = 55 AND s.student_id = e.student_id
  );
```

**Course content in order (module → lesson hierarchy):**
```sql
SELECT m.title AS module_title, l.title AS lesson_title, l.content_type
FROM module m
JOIN lesson l ON m.module_id = l.module_id
WHERE m.course_id = 1
ORDER BY m.sort_order, l.sort_order;
```

## Design Decisions & Trade-offs

- **`enrollment` is a junction table with status**, not just a boolean flag — courses need to distinguish active, completed, and dropped enrollments for accurate reporting (a "completion rate" metric is meaningless without knowing who dropped vs. who's still in progress).
- **`lesson_progress` is a separate tracking table rather than a flag on `lesson` itself** — progress is inherently per-student-per-lesson (M:N), so it can't live on the lesson row alone; this is the same pattern as `post_like` in the social network example (example 3): a junction table that tracks a relationship's state, not just its existence.
- **`sort_order` columns on `module` and `lesson`** explicitly control display order — relying on `created_at` or auto-increment ID for ordering breaks the moment an instructor needs to reorder content.
- **`grade` is a separate table from `submission`** (1:1) rather than columns on `submission` — this cleanly separates "what the student turned in" from "how it was evaluated," which matters if grading involves a different actor (instructor) and timeline (graded later) than submission itself.

## Common Pitfalls

- Storing course progress as a single "% complete" number on `enrollment` instead of tracking individual lesson completions — makes it impossible to show students *which* lessons they've finished, and recalculating on content changes (adding new lessons) becomes error-prone.
- Not enforcing `UNIQUE (assignment_id, student_id)` on submissions when the business rule is "one submission only" — allows accidental duplicate submissions to pile up.
- Flattening module/lesson into a single table with a "type" column and self-referencing parent — technically works (see cheatsheet file 6 hierarchy patterns) but loses the clarity of explicit, purpose-built tables when the two levels have genuinely different attributes (a lesson has `content_type`, a module doesn't).
- Hardcoding grading logic (pass/fail thresholds) in application code instead of storing `max_score` per assignment — makes percentage-based grading calculations inconsistent across assignments with different point values.

---
[← Previous: Event Ticketing](14-event-ticketing.md) | [Back to index](00-README.md) | [Next: Messaging / Chat System →](16-messaging-chat-system.md)
