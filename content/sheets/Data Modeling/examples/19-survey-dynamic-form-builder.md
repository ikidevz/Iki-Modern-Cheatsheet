# 19. Survey / Dynamic Form Builder

## Scenario

Users build custom surveys with arbitrary question types (text, multiple choice, rating scale), and respondents submit answers. The core challenge: **the schema doesn't know in advance what questions will exist** — a direct real-world test of the EAV-vs-JSONB trade-off flagged as an anti-pattern risk in the cheatsheet (file 10).

## Entities & Relationships

| Entity | Description |
|---|---|
| Survey | A collection of questions |
| Question | A single question within a survey, with a type |
| Question_Option | Predefined choices for multiple-choice/checkbox questions |
| Response | One respondent's full submission to a survey |
| Answer | One respondent's answer to one question |

```
Survey 1───N Question 1───N Question_Option
Survey 1───N Response 1───N Answer N───1 Question
```

## Approach A: Structured Relational Schema (Type-Specific Columns)

```sql
CREATE TABLE survey (
    survey_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE question (
    question_id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT NOT NULL REFERENCES survey(survey_id) ON DELETE CASCADE,
    question_text VARCHAR(500) NOT NULL,
    question_type VARCHAR(20) NOT NULL
        CHECK (question_type IN ('short_text','long_text','single_choice','multiple_choice','rating')),
    sort_order INT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE question_option (
    option_id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES question(question_id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE response (
    response_id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT NOT NULL REFERENCES survey(survey_id),
    respondent_id BIGINT,             -- nullable: anonymous responses allowed
    submitted_at TIMESTAMP NOT NULL DEFAULT now()
);

-- One row per answer; value column choice depends on question_type
CREATE TABLE answer (
    answer_id BIGSERIAL PRIMARY KEY,
    response_id BIGINT NOT NULL REFERENCES response(response_id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES question(question_id),
    text_value TEXT,                  -- for short_text / long_text
    rating_value INT,                 -- for rating questions
    UNIQUE (response_id, question_id)
);

-- Multiple choice answers need their own junction (an answer can select several options)
CREATE TABLE answer_option (
    answer_id BIGINT NOT NULL REFERENCES answer(answer_id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL REFERENCES question_option(option_id),
    PRIMARY KEY (answer_id, option_id)
);
```

### Sample Queries (Approach A)

**All questions for a survey, in order, with their options if applicable:**
```sql
SELECT q.question_id, q.question_text, q.question_type,
       o.option_text
FROM question q
LEFT JOIN question_option o ON q.question_id = o.question_id
WHERE q.survey_id = 10
ORDER BY q.sort_order, o.sort_order;
```

**Full response readout for one submission:**
```sql
SELECT q.question_text, a.text_value, a.rating_value,
       STRING_AGG(qo.option_text, ', ') AS selected_options
FROM answer a
JOIN question q ON a.question_id = q.question_id
LEFT JOIN answer_option ao ON a.answer_id = ao.answer_id
LEFT JOIN question_option qo ON ao.option_id = qo.option_id
WHERE a.response_id = 900
GROUP BY q.question_text, a.text_value, a.rating_value, q.sort_order
ORDER BY q.sort_order;
```

**Aggregate results for a rating question (average score):**
```sql
SELECT AVG(rating_value) AS avg_rating
FROM answer
WHERE question_id = 55;
```

| Pros of Approach A | Cons |
|---|---|
| Real columns, real types — rating math (`AVG`) works natively | Adding a genuinely new question type (e.g., "date picker") needs a new nullable column on `answer` |
| Strong referential integrity throughout | More tables, more joins to assemble a full response |
| Easy to build accurate aggregate reports per question type | |

## Approach B: JSONB-Based Flexible Schema

```sql
CREATE TABLE survey (
    survey_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    schema JSONB NOT NULL   -- defines questions, types, and options as structured JSON
);

CREATE TABLE response (
    response_id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT NOT NULL REFERENCES survey(survey_id),
    answers JSONB NOT NULL,   -- { "q1": "some text", "q2": ["option_a","option_c"], "q3": 4 }
    submitted_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_response_answers ON response USING GIN (answers);
```

**Example `survey.schema`:**
```json
{
  "questions": [
    { "id": "q1", "text": "What did you like most?", "type": "short_text" },
    { "id": "q2", "text": "Which features did you use?", "type": "multiple_choice",
      "options": ["Search", "Export", "Sharing"] },
    { "id": "q3", "text": "Rate your experience", "type": "rating", "scale": 5 }
  ]
}
```

**Example `response.answers`:**
```json
{ "q1": "The export feature", "q2": ["Search", "Export"], "q3": 4 }
```

**Query using JSONB operators:**
```sql
-- Average of q3 ratings across all responses to survey 10
SELECT AVG((answers->>'q3')::INT) AS avg_rating
FROM response
WHERE survey_id = 10;
```

| Pros of Approach B | Cons |
|---|---|
| Adding new question types requires zero schema migrations | No database-level type checking on individual answers |
| Naturally matches how a form-builder UI already represents its data | Aggregate reporting requires JSON-parsing expressions (more brittle, engine-specific) |
| Great fit when the survey structure itself is user-defined and highly variable | Harder to enforce "every response answers every required question" at the DB level |

## Decision Guide

| If... | Choose |
|---|---|
| Question types are a small, known, stable set; strong reporting/analytics needed | Approach A (structured relational) |
| Question types and structure are highly variable, defined entirely by end users, analytics needs are lighter | Approach B (JSONB) |
| Mixed needs | Hybrid: structured columns for common fields (survey title, respondent, submitted_at) + a JSONB column for the variable answer payload |

## Why NOT Classic EAV Here

A naive EAV table (`response_id, question_id, attribute_name, value` as one generic text column) is tempting but strictly worse than both approaches above: it loses the type safety Approach A provides (everything becomes a string, breaking `AVG()` on ratings without casting) and loses the natural structure-matching of Approach B (JSON already models nested/variable data better than flattened attribute rows). This is a direct, concrete illustration of the EAV anti-pattern warning in the cheatsheet (file 10) — surveys are exactly the scenario EAV *seems* to fit, and exactly where it usually causes the most pain in practice.

## Common Pitfalls

- Reaching for classic EAV as the "obvious" solution for variable question types without considering JSONB, which handles the same flexibility with better native tooling in modern relational databases.
- In Approach A, forgetting `UNIQUE (response_id, question_id)` on `answer`, allowing duplicate answers to the same question within one response.
- In Approach B, not validating `response.answers` against `survey.schema` at write time (application-level), allowing malformed or incomplete responses to be silently stored.
- Mixing both approaches inconsistently across the same product — pick one primary strategy (or a deliberate hybrid) and document why, rather than letting different features drift toward different patterns organically.

---
[← Previous: Polymorphic Associations](18-polymorphic-associations.md) | [Back to index](00-README.md) | [Next: Notification System →](20-notification-system.md)
