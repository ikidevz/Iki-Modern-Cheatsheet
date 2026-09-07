# 12. Healthcare / Patient Records

## Scenario

A clinic system tracking patients, appointments, and prescriptions. The defining constraint here isn't the entities themselves — it's that **every access to sensitive data must be logged** (compliance frameworks like HIPAA require knowing who viewed what, and when), and historical clinical data must never be silently altered.

## Entities & Relationships

| Entity | Description |
|---|---|
| Patient | The individual receiving care |
| Provider | Doctor/clinician |
| Appointment | A scheduled visit |
| Diagnosis | A recorded condition from a visit |
| Prescription | Medication prescribed during/after a visit |
| Access_Log | Immutable record of who viewed which patient's data, and when |

```
Patient 1───N Appointment N───1 Provider
Appointment 1───N Diagnosis
Appointment 1───N Prescription
Patient 1───N Access_Log
```

## Schema (PostgreSQL)

```sql
CREATE TABLE patient (
    patient_id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    medical_record_number VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE provider (
    provider_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100),
    license_number VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE appointment (
    appointment_id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patient(patient_id),
    provider_id BIGINT NOT NULL REFERENCES provider(provider_id),
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','completed','cancelled','no_show')),
    reason VARCHAR(255)
);

-- Clinical records are append-only; corrections add new rows, never edit history
CREATE TABLE diagnosis (
    diagnosis_id BIGSERIAL PRIMARY KEY,
    appointment_id BIGINT NOT NULL REFERENCES appointment(appointment_id),
    icd_code VARCHAR(10) NOT NULL,          -- standardized diagnosis code
    description VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT now(),
    recorded_by BIGINT NOT NULL REFERENCES provider(provider_id),
    superseded_by BIGINT REFERENCES diagnosis(diagnosis_id)  -- points to correction, if any
);

CREATE TABLE prescription (
    prescription_id BIGSERIAL PRIMARY KEY,
    appointment_id BIGINT NOT NULL REFERENCES appointment(appointment_id),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    prescribed_by BIGINT NOT NULL REFERENCES provider(provider_id),
    prescribed_at TIMESTAMP NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','completed','cancelled'))
);

-- Every read of sensitive patient data gets logged — immutable, append-only
CREATE TABLE access_log (
    access_log_id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patient(patient_id),
    accessed_by BIGINT NOT NULL REFERENCES provider(provider_id),
    access_reason VARCHAR(255),
    accessed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_patient ON appointment(patient_id, scheduled_at);
CREATE INDEX idx_access_log_patient ON access_log(patient_id, accessed_at);
```

## Sample Queries

**A patient's full appointment history:**
```sql
SELECT a.scheduled_at, p.name AS provider, a.status, a.reason
FROM appointment a
JOIN provider p ON a.provider_id = p.provider_id
WHERE a.patient_id = 300
ORDER BY a.scheduled_at DESC;
```

**Active prescriptions for a patient (across all appointments):**
```sql
SELECT pr.medication_name, pr.dosage, pr.prescribed_at, prov.name AS prescribed_by
FROM prescription pr
JOIN appointment a ON pr.appointment_id = a.appointment_id
JOIN provider prov ON pr.prescribed_by = prov.provider_id
WHERE a.patient_id = 300 AND pr.status = 'active';
```

**Current (non-superseded) diagnoses for a patient:**
```sql
SELECT d.icd_code, d.description, d.recorded_at
FROM diagnosis d
JOIN appointment a ON d.appointment_id = a.appointment_id
WHERE a.patient_id = 300 AND d.superseded_by IS NULL;
```

**Audit report: who accessed a specific patient's record in the last 30 days:**
```sql
SELECT prov.name, al.access_reason, al.accessed_at
FROM access_log al
JOIN provider prov ON al.accessed_by = prov.provider_id
WHERE al.patient_id = 300
  AND al.accessed_at >= now() - INTERVAL '30 days'
ORDER BY al.accessed_at DESC;
```

## Design Decisions & Trade-offs

- **`access_log` is a first-class table, populated on every read of patient data** (via application-layer logging, not something the schema enforces automatically) — compliance regulations in healthcare typically require proving who viewed a record and why, which is fundamentally different from most systems where read access isn't tracked at all.
- **`diagnosis.superseded_by` implements a correction chain instead of allowing `UPDATE`** — if a diagnosis was recorded in error, a new corrected `diagnosis` row is inserted and linked via `superseded_by`, preserving the original entry. This mirrors the append-only philosophy from the banking ledger (example 11) and inventory movement log (example 6): clinical history must never silently change.
- **`medical_record_number` and `license_number` are separate unique identifiers from the surrogate PKs** — these are real-world natural keys used across other systems (insurance, external labs) and need to be queryable/unique independent of the internal auto-increment ID.
- **Appointments link diagnoses and prescriptions** rather than attaching them directly to the patient — clinical records need to be traceable to the specific visit and provider that generated them, which matters for both care coordination and legal accountability.

## Common Pitfalls

- Allowing `UPDATE`/`DELETE` on clinical records (diagnoses, prescriptions) — beyond being a data integrity problem, this can be a compliance violation in regulated healthcare systems.
- Not logging read access at all, only tracking writes — many healthcare compliance frameworks specifically require read-access auditing, which is easy to overlook since most systems only think to log changes.
- Storing free-text diagnoses without a standardized code (ICD-10, etc.), making it impossible to run structured population-health queries ("how many patients have diagnosis X").
- Treating `patient.date_of_birth` casually — combined with name, this is often enough to uniquely (mis)identify the wrong patient; matching logic in appointment scheduling should always use the internal `patient_id`, never re-derive identity from name/DOB alone.

---
[← Previous: Banking / Ledger](11-banking-ledger.md) | [Back to index](00-README.md) | [Next: Ride-Sharing / Logistics →](13-ride-sharing-logistics.md)
