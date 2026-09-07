# 11. Banking / Ledger System

## Scenario

A banking or fintech system where money moves between accounts. The non-negotiable rule: **money can never appear or vanish** — every movement must be traceable, balanced, and immutable. This is the classic double-entry bookkeeping pattern, the gold standard for any system handling money.

## Entities & Relationships

| Entity | Description |
|---|---|
| Account | A holder of a balance (checking, savings, or an internal system account) |
| Transaction | A logical financial event (e.g., "Transfer $50 from Alice to Bob") |
| Ledger_Entry | Each individual debit or credit line making up a transaction |

```
Account 1───N Ledger_Entry N───1 Transaction
```

## Schema (PostgreSQL)

```sql
CREATE TABLE account (
    account_id BIGSERIAL PRIMARY KEY,
    owner_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('checking','savings','system')),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- One transaction = one logical financial event
CREATE TABLE transaction (
    transaction_id BIGSERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Immutable double-entry ledger: every transaction has 2+ balanced entries
CREATE TABLE ledger_entry (
    ledger_entry_id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transaction(transaction_id),
    account_id BIGINT NOT NULL REFERENCES account(account_id),
    entry_type VARCHAR(6) NOT NULL CHECK (entry_type IN ('debit','credit')),
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_account ON ledger_entry(account_id, created_at);
CREATE INDEX idx_ledger_transaction ON ledger_entry(transaction_id);
```

### Enforcing Balance at the Database Level

```sql
-- A transaction's debits must equal its credits (checked via trigger, since
-- CHECK constraints can't span multiple rows across a transaction)
CREATE OR REPLACE FUNCTION check_transaction_balances() RETURNS TRIGGER AS $$
DECLARE
    total_debits NUMERIC(15,2);
    total_credits NUMERIC(15,2);
BEGIN
    SELECT COALESCE(SUM(amount) FILTER (WHERE entry_type = 'debit'), 0),
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'credit'), 0)
    INTO total_debits, total_credits
    FROM ledger_entry WHERE transaction_id = NEW.transaction_id;

    IF total_debits != total_credits THEN
        RAISE EXCEPTION 'Transaction % is unbalanced: debits=% credits=%',
            NEW.transaction_id, total_debits, total_credits;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_balance
AFTER INSERT ON ledger_entry
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_transaction_balances();
```
The trigger is **deferred** so it checks *after* all of a transaction's ledger entries are inserted (within the same DB transaction), not after each individual row.

## Sample Queries

**Transfer $50 from Alice's account to Bob's account (a single financial transaction = two balanced ledger entries):**
```sql
BEGIN;

INSERT INTO transaction (description) VALUES ('Transfer: Alice to Bob') RETURNING transaction_id;
-- assume transaction_id = 9001

INSERT INTO ledger_entry (transaction_id, account_id, entry_type, amount)
VALUES (9001, 1 /* Alice */, 'debit', 50.00);

INSERT INTO ledger_entry (transaction_id, account_id, entry_type, amount)
VALUES (9001, 2 /* Bob */, 'credit', 50.00);

COMMIT;
```

**Current balance of an account (derived, never stored directly):**
```sql
SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'credit'), 0)
  - COALESCE(SUM(amount) FILTER (WHERE entry_type = 'debit'), 0) AS balance
FROM ledger_entry
WHERE account_id = 1;
```

**Full statement (transaction history) for an account:**
```sql
SELECT t.description, le.entry_type, le.amount, le.created_at
FROM ledger_entry le
JOIN transaction t ON le.transaction_id = t.transaction_id
WHERE le.account_id = 1
ORDER BY le.created_at DESC;
```

**Verify the entire ledger is balanced system-wide (a routine integrity check):**
```sql
SELECT
    SUM(amount) FILTER (WHERE entry_type = 'debit') AS total_debits,
    SUM(amount) FILTER (WHERE entry_type = 'credit') AS total_credits
FROM ledger_entry;
-- These two numbers must always be equal across the ENTIRE table
```

## Design Decisions & Trade-offs

- **Every financial movement is exactly one `transaction` with two or more balanced `ledger_entry` rows** — never a single row with a signed amount on one account. This is what makes "where did the money go" always answerable and makes fraud/bugs immediately detectable (an unbalanced ledger is a red flag, not a mystery).
- **Balances are always derived by summing `ledger_entry`, never stored as a mutable `account.balance` column** — a stored balance is the single most common cause of "money mismatches" bugs in financial systems, because it can drift from the ledger due to bugs, race conditions, or manual edits. (High-volume systems do cache a balance for performance, but always alongside a reconciliation process against the ledger — see the inventory example's reconciliation pattern for the same idea applied to stock.)
- **`ledger_entry` is append-only** — corrections are made via new offsetting entries (a reversing transaction), never by editing or deleting historical rows. This preserves a legally/financially defensible audit trail.
- **The balance-check trigger is deferred to the end of the database transaction**, not per-row — a single logical transfer needs both its debit and credit rows inserted before the balance check makes sense.

## Common Pitfalls

- Storing a single signed `amount` on one account per transfer instead of double-entry debit/credit pairs — makes it impossible to verify the system is internally consistent (nothing to balance against).
- Keeping `account.balance` as the only source of truth with no ledger — identical to the "cached-only" inventory anti-pattern (see example 6), but with money instead of stock, where the consequences are far worse.
- Allowing `UPDATE`/`DELETE` on `ledger_entry` — destroys the auditability and legal defensibility of the ledger.
- Not wrapping multi-entry transactions in a single database transaction (`BEGIN`/`COMMIT`) — a crash between inserting the debit and credit rows leaves the ledger unbalanced.
- Ignoring currency: a system with `amount` but no per-entry currency field can't safely support multi-currency without a redesign; even single-currency systems benefit from an explicit currency column for future-proofing.

---
[← Previous: Warehouse Star Schema](10-warehouse-star-schema.md) | [Back to index](00-README.md) | [Next: Healthcare / Patient Records →](12-healthcare-patient-records.md)
