# Data Contracts Cheatsheet for Data Engineers

> A structured reference for treating the interface between data producers and consumers as a formal, versioned, enforceable agreement — contract schema, ownership, breaking-change protection, CI enforcement, and how contracts relate to quality gates, schema evolution, and Data Mesh.

## 📑 Table of Contents

1. [⚡ Quick Reference](#quick-reference)
2. [🧠 Core Concept](#core-concept)
3. [🎯 When You Need Formal Data Contracts](#when-you-need-formal-data-contracts)
4. [📜 Anatomy of a Data Contract](#anatomy-of-a-data-contract)
5. [🏗️ Where Contracts Live in the Pipeline](#where-contracts-live-in-the-pipeline)
6. [🚦 Enforcing Contracts in CI/CD](#enforcing-contracts-in-cicd)
7. [🔄 Versioning a Contract](#versioning-a-contract)
8. [🤝 Producer and Consumer Responsibilities](#producer-and-consumer-responsibilities)
9. [🧯 Handling Contract Violations in Production](#handling-contract-violations-in-production)
10. [📐 Contracts for Streaming vs Batch vs API Sources](#contracts-for-streaming-vs-batch-vs-api-sources)
11. [🛠️ Tooling Landscape](#tooling-landscape)
12. [🧪 Testing Against a Contract](#testing-against-a-contract)
13. [⚠️ Common Gotchas](#common-gotchas)
14. [✅ Best Practices Checklist](#best-practices-checklist)
15. [📚 Data Contracts vs Schema Registry vs Quality Gates](#data-contracts-vs-schema-registry-vs-quality-gates)
16. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Concern | Pattern |
|---|---|
| Format | Version-controlled YAML/JSON, reviewed like code |
| Contents | Schema, semantics, SLAs (freshness/completeness), ownership, breaking-change policy |
| Enforcement | CI check on the producer's pipeline before deploy; runtime validation at publish |
| Ownership | The producer owns and commits to the contract; consumers depend on it |
| Breaking changes | Require a version bump and a negotiated migration window, never a silent change |
| Common tools | Open Data Contract Standard (ODCS), Buf (Protobuf), JSON Schema + custom CI, Great Expectations |

## 🧠 Core Concept

A data contract is a **formal, version-controlled agreement** between whoever produces a dataset and whoever consumes it — specifying not just the schema, but the semantics, freshness guarantees, and what happens when something needs to change. It turns "please don't break my dashboard" from an informal hope into an enforceable, testable specification.

```text
Without a contract:  producer changes a column  -->  consumer's pipeline breaks in production, discovered late
With a contract:     producer's CI validates the change against the contract  -->  breaking change caught BEFORE deploy
```

## 🎯 When You Need Formal Data Contracts

**Formalize contracts when:**
- Producer and consumer are different teams that deploy independently and can't casually coordinate every change.
- A dataset feeds something business-critical (an ML model, a financial report) where an undetected breaking change is expensive.
- You're adopting Data Mesh — data products fundamentally require a contract as part of their definition. See [data-mesh.md](./Data_Mesh_Cheat_Sheet.md#data-products-as-the-unit-of-design).

**Lighter-weight suffices when:**
- Producer and consumer are the same team, already coordinating changes through normal code review — an implicit contract enforced by team communication may be proportionate.

## 📜 Anatomy of a Data Contract

```yaml
# A data contract, following the shape of the Open Data Contract Standard (ODCS)
apiVersion: v3.0.0
kind: DataContract
id: orders-contract
info:
  title: "Orders Dataset Contract"
  version: 2.1.0
  owner: checkout-team
  description: "All completed and in-progress orders."

schema:
  - name: order_id
    type: string
    required: true
    unique: true
  - name: customer_id
    type: string
    required: true
  - name: amount_cents
    type: integer
    required: true
    minimum: 0
  - name: status
    type: string
    enum: [pending, completed, cancelled, refunded]

quality:
  - rule: "row_count > 0"
    severity: error
  - rule: "freshness(order_date) < 2h"
    severity: error
  - rule: "duplicate_count(order_id) = 0"
    severity: error

sla:
  freshness: "hourly"
  availability: "99.9%"

servers:
  - environment: production
    type: table
    location: warehouse.checkout.orders

breakingChangePolicy:
  noticePeriodDays: 30
  versioningStrategy: "new major version on breaking change"
```

A contract that only specifies schema is incomplete — the **SLA and quality sections** are what let a consumer actually build reliable downstream logic (a consumer needs to know it's safe to alert if data is more than 2 hours stale, not just what columns exist).

## 🏗️ Where Contracts Live in the Pipeline

```python
def validate_output_against_contract(df, contract_path: str):
    """Run at the end of the producer's own pipeline, before publishing — the same
    boundary quality gates operate at, but validated against the FORMAL contract
    rather than ad hoc checks the pipeline author happened to write."""
    contract = load_contract(contract_path)
    validate_schema(df, contract.schema)
    for rule in contract.quality:
        if not evaluate_rule(df, rule.rule) and rule.severity == "error":
            raise ContractViolation(f"{contract.id} violated: {rule.rule}")
    validate_freshness(df, contract.sla.freshness)
```

Contracts and quality gates aren't competing concepts — a contract is the **formal, agreed specification**; a quality gate is the **enforcement mechanism** that checks the actual data against it at the pipeline boundary. See [data-quality-gates.md](./Data_Quality_Gates_Cheat_Sheet.md).

## 🚦 Enforcing Contracts in CI/CD

```yaml
# .github/workflows/validate_contract.yml — contract compliance is a merge-blocking CI check,
# just like a broken unit test would be
name: Validate Data Contract
on:
  pull_request:
    paths: ["pipelines/orders/**", "contracts/orders-contract.yaml"]

jobs:
  contract-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run pipeline against a sample and validate output against the contract
        run: python validate_output_against_contract.py --sample --contract contracts/orders-contract.yaml
      - name: Check for breaking schema changes vs the currently-published contract version
        run: python check_contract_compatibility.py --old contracts/orders-contract.yaml@main --new contracts/orders-contract.yaml
```

The highest-leverage moment to catch a contract violation is **before the producer's change is merged**, not after it's deployed and a consumer's pipeline fails in production — this mirrors the schema-registry-at-registration-time principle from [schema-evolution.md](./Schema_Evolution_Cheat_Sheet.md#schema-registries).

## 🔄 Versioning a Contract

```yaml
# v2.1.0 -> v3.0.0: a MAJOR version bump signals a breaking change is coming
apiVersion: v3.0.0
info:
  version: 3.0.0
  changelog:
    - version: 3.0.0
      date: 2026-10-01
      changes: "BREAKING: renamed 'amount' to 'amount_cents' and changed type from decimal to integer. Deprecation window: 2026-09-01 to 2026-10-01."
    - version: 2.1.0
      date: 2026-06-15
      changes: "Added optional 'currency' field."
```

```python
def check_contract_compatibility(old_contract, new_contract):
    """The contract equivalent of a schema registry's compatibility check —
    fails the build if a MINOR/PATCH version bump actually contains a breaking change."""
    if new_contract.version.major == old_contract.version.major:
        breaking_changes = find_breaking_schema_changes(old_contract.schema, new_contract.schema)
        if breaking_changes:
            raise ContractVersioningError(
                f"Breaking changes {breaking_changes} require a MAJOR version bump, "
                f"but version only moved {old_contract.version} -> {new_contract.version}"
            )
```

Semantic versioning (major.minor.patch) applied to contracts gives consumers a reliable signal: a minor/patch bump is always safe to ignore, a major bump always means "read the changelog before you upgrade."

## 🤝 Producer and Consumer Responsibilities

| Party | Responsibility |
|---|---|
| Producer | Owns the contract, validates every pipeline change against it in CI, gives notice before breaking changes, maintains the deprecation window |
| Consumer | Builds against the contract's guarantees (not undocumented current behavior), monitors their own dependency on it, migrates within the notice period |
| Platform/governance | Provides the enforcement tooling (CI checks, contract registry), defines the org-wide minimum contract standard |

A contract is only as good as both sides' discipline — a producer that maintains a pristine contract file while a consumer scrapes undocumented fields "because it happened to work" has, in practice, no real contract at all.

## 🧯 Handling Contract Violations in Production

```python
def on_contract_violation_detected(contract_id, violation_details):
    """A violation in PRODUCTION (as opposed to CI) means either an unvalidated
    emergency change slipped through, or an upstream dependency the contract
    didn't account for changed — both need immediate, not eventual, attention."""
    quarantine_output(contract_id)              # don't let non-compliant data reach consumers
    alert_owner(contract_id, violation_details)
    if is_downstream_impact_severe(contract_id):
        notify_affected_consumers(contract_id, violation_details)
```

Treat a production contract violation the same way you'd treat a quality-gate blocking failure — quarantine the output rather than publishing it, since a contract that's "usually enforced" provides no real guarantee at all.

## 📐 Contracts for Streaming vs Batch vs API Sources

```yaml
# Streaming contract: adds delivery/ordering semantics batch contracts don't need
servers:
  - environment: production
    type: kafka_topic
    location: prod.checkout.orders
deliveryGuarantee: at-least-once
orderingGuarantee: "per-key (partitioned by order_id)"
```

```yaml
# API contract: adds rate limits and versioned endpoints
servers:
  - environment: production
    type: rest_api
    location: https://api.internal/v2/orders
rateLimits:
  requestsPerMinute: 600
```

The core contract concepts (schema, SLA, ownership, versioning) apply across all source types, but each medium adds its own dimension — streaming needs delivery/ordering semantics (see [real-time-streaming.md](./Real_Time_Streaming_Cheat_Sheet.md#delivery-semantics)), APIs need rate limits and endpoint versioning.

## 🛠️ Tooling Landscape

| Category | Tools |
|---|---|
| Contract standards | Open Data Contract Standard (ODCS), AsyncAPI (for event contracts) |
| Schema-level enforcement | Confluent Schema Registry, Buf (Protobuf), JSON Schema |
| Quality-rule enforcement | Great Expectations, Soda Core, dbt tests |
| Contract registries/catalogs | DataHub/OpenMetadata (linking a dataset to its contract), custom Git-based contract repos |

## 🧪 Testing Against a Contract

```python
def test_pipeline_output_matches_contract_schema():
    output = run_pipeline_on_sample_data()
    contract = load_contract("contracts/orders-contract.yaml")
    validate_schema(output, contract.schema)   # raises on any mismatch

def test_breaking_change_without_major_bump_fails_ci():
    old_contract = load_contract_version("orders-contract.yaml", version="2.1.0")
    new_contract = make_contract_with_renamed_field(old_contract, "amount", "amount_cents")
    new_contract.version = "2.2.0"   # incorrectly only a minor bump
    with pytest.raises(ContractVersioningError):
        check_contract_compatibility(old_contract, new_contract)

def test_quality_rules_in_contract_actually_catch_bad_data():
    bad_sample = make_sample_with_duplicate_order_ids()
    contract = load_contract("contracts/orders-contract.yaml")
    with pytest.raises(ContractViolation):
        validate_output_against_contract(bad_sample, contract)
```

## ⚠️ Common Gotchas

- **A contract that only specifies schema**, with no SLA or quality rules, gives consumers false confidence about guarantees that were never actually made.
- **Contracts written but never enforced in CI** — a contract file that isn't validated automatically is just documentation, easily drifting from what the pipeline actually produces.
- **Breaking changes shipped without a version bump**, silently violating the contract's own versioning policy.
- **Consumers depending on undocumented fields/behavior** not actually specified in the contract — this creates an informal, unmanaged second contract that breaks unpredictably.
- **No quarantine on production contract violations** — publishing non-compliant data "just this once" while investigating defeats the entire purpose of having a contract.
- **One contract format per team**, with no shared organizational standard — this is exactly the interoperability gap [data-mesh.md](./Data_Mesh_Cheat_Sheet.md#interoperability-across-domains) warns about.

## ✅ Best Practices Checklist

- [ ] Every contract specifies schema, SLA, quality rules, and ownership — not schema alone
- [ ] Contract compliance is validated in CI, before every producer deploy
- [ ] Contracts are semantically versioned, with breaking changes requiring a major version bump
- [ ] Breaking changes carry a communicated notice period and deprecation window
- [ ] Production contract violations quarantine the output rather than publishing it
- [ ] Consumers build only against what the contract guarantees, not undocumented current behavior
- [ ] The organization uses one shared contract format/standard, not one per team

## 📚 Data Contracts vs Schema Registry vs Quality Gates

| Concept | Scope | Enforces |
|---|---|---|
| Data contract | The full producer-consumer agreement | Schema + SLA + quality + versioning policy, together |
| Schema registry | Schema compatibility only | Structural compatibility at registration/produce time |
| Quality gate | Runtime data validation | The contract's (or an ad hoc) quality rules, at the pipeline boundary |

A schema registry and quality gates are typically the **implementation mechanisms** a data contract is enforced through — the contract is the agreement; the registry and gates are how you make sure reality matches it.

## 💡 Pro Tips

1. **Specify SLA and quality rules in every contract, not just schema** — schema alone doesn't tell a consumer what they can actually rely on.
2. **Enforce contract compliance in CI, before deploy** — a contract that's only checked in production has already failed its purpose once.
3. **Use semantic versioning and actually enforce the major-bump-for-breaking-changes rule** with an automated compatibility check, not manual discipline alone.
4. **Quarantine, don't publish, on a production contract violation** — a contract "usually" honored isn't a contract.
5. **Give consumers a real notice period for breaking changes**, with the deprecation window written into the contract itself, not communicated ad hoc.
6. **Standardize on one contract format organization-wide** (e.g., ODCS) — per-team formats recreate the interoperability problem Data Mesh contracts exist to solve.
7. **Make consumers build only against contract-guaranteed fields/behavior** — discourage relying on undocumented current implementation details.
8. **Treat contract files as code** — version-controlled, reviewed in pull requests, tested in CI.
9. **Pair contracts with schema registries and quality-gate tooling** as the enforcement mechanism, rather than trying to build enforcement from scratch.
10. **Start with contracts on your highest-fan-out datasets** (the ones many consumers depend on) before rolling the practice out organization-wide.
