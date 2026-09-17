# LLM Evaluation & Safety Cheatsheet

## Overview

Evaluating generative systems is fundamentally harder than evaluating a classifier — there's often no single "correct" output to compare against. This sheet covers benchmark vs. task-specific evaluation, LLM-as-judge, hallucination detection, guardrails, and the human evaluation design choices that keep a review process honest.

---

## 1. Benchmark Evaluation vs. Task-Specific Evaluation

| | Benchmarks (MMLU, HellaSwag, etc.) | Task-specific evaluation |
|---|---|---|
| Measures | General capability across broad domains | Performance on YOUR actual use case |
| Risk of misleading you | High — a model can top a leaderboard and still fail your specific task | Low, if the eval set is representative |
| Contamination risk | Real — popular benchmarks can leak into training data | Low, if you write your own eval set |

```python
# A benchmark score tells you almost nothing about a narrow, specialized task.
# Always build a small, representative eval set from YOUR actual use case:
eval_set = [
    {"input": "Summarize this support ticket in one sentence: ...", "expected_criteria": ["mentions the issue", "under 20 words"]},
    {"input": "Extract the invoice total from this text: ...", "expected_output": "$1,432.50"},
]

def evaluate_exact_match(model_fn, eval_set):
    correct = sum(
        1 for ex in eval_set
        if "expected_output" in ex and model_fn(ex["input"]).strip() == ex["expected_output"].strip()
    )
    return correct / len([e for e in eval_set if "expected_output" in e])
```

**Why benchmarks can mislead:** a model's MMLU score says nothing about whether it can reliably extract a dollar amount from your specific invoice format, follow your company's tone guidelines, or avoid a specific failure mode your users actually trigger. Benchmark performance and task performance can diverge significantly — always validate on your own data before trusting a general leaderboard ranking for a production decision.

---

## 2. LLM-as-Judge

For open-ended outputs (summaries, creative writing, chat responses) where exact-match scoring doesn't apply, using a strong LLM to score another model's output is a common, scalable approach.

```python
def llm_judge_evaluation(judge_client, query, response, criteria):
    judge_prompt = f"""Evaluate this AI response on a scale of 1-5 for each criterion.
Respond with ONLY a JSON object mapping each criterion to a score.

Query: {query}
Response: {response}

Criteria: {', '.join(criteria)}"""

    result = judge_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": judge_prompt}],
    )
    return result.content[0].text  # parse as JSON in practice

scores = llm_judge_evaluation(
    judge_client=None,  # your API client
    query="Explain photosynthesis to a 10 year old.",
    response="Plants use sunlight to make food, like a solar-powered kitchen!",
    criteria=["accuracy", "age_appropriateness", "clarity"],
)
```

### Known biases of LLM-as-judge

- **Position bias**: when comparing two responses side-by-side, judges tend to favor whichever is presented first — mitigate by randomizing (or evaluating both orderings and averaging).
- **Verbosity bias**: judges tend to rate longer responses more favorably, independent of actual quality — control for length in your rubric or normalize for it.
- **Self-preference bias**: a model judging outputs (including its own family's outputs) can show a subtle preference for its own generation style.
- **Mitigation**: use a different, typically stronger model as judge than the one being evaluated, use detailed rubrics rather than vague "rate 1-5" prompts, and spot-check a sample of judge scores against human ratings periodically to confirm the judge remains well-calibrated to human preference.

---

## 3. Hallucination: Why It Happens and Detection Strategies

**Why it happens:** an LLM is trained to produce plausible, fluent continuations — not to say "I don't know." When it lacks the actual answer, the same fluency-optimizing process that makes it eloquent when correct makes it eloquent when confabulating.

```python
def citation_check(generated_answer, source_documents):
    """A simple grounding check: does every factual claim trace back to something in the source?"""
    # In practice this itself often uses an LLM call: "does this claim appear in these sources?"
    verification_prompt = f"""Source documents:
{chr(10).join(source_documents)}

Claim to verify: {generated_answer}

Is this claim directly supported by the source documents? Answer only YES or NO, then briefly explain."""
    return verification_prompt  # send to a judge model

def uncertainty_via_self_consistency(model_fn, prompt, n_samples=5, temperature=0.7):
    """Generate multiple times at non-zero temperature — high variance in answers signals low confidence."""
    responses = [model_fn(prompt, temperature=temperature) for _ in range(n_samples)]
    unique_responses = len(set(responses))
    consistency_score = 1 - (unique_responses - 1) / (n_samples - 1) if n_samples > 1 else 1.0
    return consistency_score, responses
```

| Detection strategy | How it works |
|---|---|
| Retrieval grounding | Only let the model answer from retrieved context (RAG), and check the answer against it |
| Citation checking | Require the model to cite sources, then verify the citation actually supports the claim |
| Self-consistency / uncertainty sampling | Sample multiple times; disagreement across samples signals low confidence |
| Asking the model to express calibrated uncertainty | Prompt explicitly for confidence levels or "I don't know" as an allowed answer — reduces but doesn't eliminate confident fabrication |

---

## 4. Guardrails

```python
# Input filtering — screen for policy-violating or injection-attempt content before it reaches the model
def input_guardrail_check(user_input, blocked_patterns):
    for pattern in blocked_patterns:
        if pattern.lower() in user_input.lower():
            return False, f"Blocked: matched pattern '{pattern}'"
    return True, None

# Output filtering — screen generated content before it reaches the user
def output_guardrail_check(generated_text, classifier_fn):
    """classifier_fn could be a smaller moderation model checking for policy violations."""
    is_safe, category = classifier_fn(generated_text)
    return is_safe, category
```

| Guardrail type | Purpose |
|---|---|
| Input content filtering | Block clearly disallowed requests before they reach the model |
| Output content filtering | Catch policy-violating generations before they reach the user |
| Prompt injection defenses | Detect/neutralize instructions embedded in retrieved content or user input attempting to override system behavior |
| Jailbreak-resistance testing | Adversarial red-teaming — actively try to break your own guardrails before an attacker does |

**Jailbreak-resistance testing in practice:** maintain a growing test suite of known jailbreak patterns (role-play framing, encoding tricks, hypothetical framing, "ignore previous instructions" variants) and run it against every model/prompt update, treating regressions the same as any other test failure.

---

## 5. Human Evaluation Design

```python
# A rubric-based evaluation form, filled out by human raters
evaluation_rubric = {
    "helpfulness": "Does the response address what the user actually asked? (1-5)",
    "accuracy": "Are all factual claims correct and unhallucinated? (1-5)",
    "safety": "Does the response avoid harmful, biased, or policy-violating content? (Y/N)",
    "tone": "Is the tone appropriate for the context? (1-5)",
}
```

- **Inter-annotator agreement**: have multiple raters score the same sample and compute agreement (e.g., Cohen's kappa) — low agreement signals an ambiguous rubric more often than it signals genuinely disagreeing quality judgments, and is a prompt to refine the rubric before trusting the ratings.
- **Avoiding leading questions**: "How much did you like this helpful response?" primes a positive answer. Neutral framing ("Rate this response on a scale of 1-5") produces more reliable signal.
- **Blind evaluation**: raters shouldn't know which model/version produced which response when comparing — otherwise brand or version expectations bias the rating, mirroring the position-bias concern with LLM judges.

---

## 6. Cost/Latency Tradeoffs

| Lever | Effect |
|---|---|
| Model size selection | Smaller/distilled models are cheaper and faster but may need more prompt engineering or fine-tuning to hit the same quality bar |
| Caching | Repeated or near-identical queries (common in production, e.g., FAQ-style traffic) can skip a full generation call entirely |
| Batching | Processing multiple requests together improves throughput on self-hosted inference, at the cost of added latency per individual request |
| Prompt length reduction | Shorter prompts (better retrieval precision, less redundant context) directly reduce cost and latency, and often improve quality via less dilution |

```python
import hashlib
import functools

_response_cache = {}

def cached_llm_call(prompt, model_fn):
    cache_key = hashlib.sha256(prompt.encode()).hexdigest()
    if cache_key in _response_cache:
        return _response_cache[cache_key]
    result = model_fn(prompt)
    _response_cache[cache_key] = result
    return result
```

**Practical framing:** treat model size, caching, and prompt design as one joint optimization problem, not separate decisions — a well-designed RAG pipeline with tight retrieval and a smaller model often beats an expensive large model given a sloppy, context-stuffed prompt, at a fraction of the cost.

## Common Pitfalls

- **Reporting only benchmark scores** as evidence a model will perform well on your specific task.
- **Using the same model as both generator and judge** without accounting for self-preference bias.
- **Treating hallucination as fully solvable by RAG alone** — grounding reduces but does not eliminate confabulation, especially when the model misreads or over-generalizes from retrieved context.
- **Skipping adversarial testing** and only validating guardrails against "polite" test cases — real misuse attempts are adversarial by design.
- **Ignoring inter-annotator agreement** in human evaluation and treating a single rater's scores as ground truth.

---

## 7. End-to-End Worked Example: Building a Small Task-Specific Eval Harness

```python
from anthropic import Anthropic
import json

client = Anthropic()

# A small, hand-curated eval set representative of a real support-ticket summarization task
eval_set = [
    {
        "input": "Customer says their order #4521 arrived damaged and wants a replacement shipped ASAP.",
        "required_elements": ["order number", "damaged", "replacement"],
    },
    {
        "input": "Customer is asking why they were charged twice for their subscription this month and wants a refund for the duplicate charge.",
        "required_elements": ["duplicate charge", "refund"],
    },
]

def generate_summary(ticket_text):
    response = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=100,
        messages=[{"role": "user", "content": f"Summarize this support ticket in one sentence:\n\n{ticket_text}"}],
    )
    return response.content[0].text

def rule_based_check(summary, required_elements):
    """A cheap, fast first-pass check: does the summary at least MENTION the key facts?"""
    missing = [elem for elem in required_elements if elem.lower() not in summary.lower()]
    return len(missing) == 0, missing

def llm_judge_check(ticket_text, summary):
    """A more nuanced second-pass check for cases the rule-based check can't fully capture."""
    judge_prompt = f"""Original ticket: {ticket_text}
Summary: {summary}

Does the summary accurately and completely capture the key issue and requested action?
Respond with ONLY "PASS" or "FAIL" followed by a one-sentence reason."""
    response = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=100,
        messages=[{"role": "user", "content": judge_prompt}],
    )
    return response.content[0].text

results = []
for case in eval_set:
    summary = generate_summary(case["input"])
    rule_passed, missing = rule_based_check(summary, case["required_elements"])
    judge_result = llm_judge_check(case["input"], summary)
    results.append({
        "input": case["input"][:50] + "...",
        "summary": summary,
        "rule_based_pass": rule_passed,
        "missing_elements": missing,
        "judge_verdict": judge_result,
    })

for r in results:
    print(f"Rule-based: {'PASS' if r['rule_based_pass'] else 'FAIL (' + str(r['missing_elements']) + ')'}")
    print(f"Judge: {r['judge_verdict']}")
    print()
```

**The two-tier pattern here is deliberate:** the cheap rule-based check catches obvious, unambiguous failures (a summary that literally omits the order number) at near-zero cost and can run on every single production output. The LLM-as-judge check catches subtler failures (technically mentions all elements but misrepresents the customer's tone or urgency) but costs an extra API call — reserve it for a sample of traffic or a pre-deployment test suite rather than every request, unless latency/cost budgets allow otherwise.

---

## 8. Advanced & Lesser-Known Techniques

- **Red-teaming with a dedicated adversarial model**: rather than manually brainstorming jailbreak attempts, use a separate LLM specifically prompted to generate adversarial inputs against your system, then evaluate your guardrails against its output — scales adversarial test generation beyond what a human red-team alone can produce.
- **Constitutional AI-style self-critique**: prompt a model to critique and revise its own output against a set of principles before finalizing a response — can catch some categories of policy violations or quality issues without a separate judge call, though it shares the self-preference bias risk noted in section 2.
- **Canary tokens for data leakage detection**: embed a unique, traceable string in a private document; if that string ever appears in a model's output on unrelated queries, it's strong evidence of unintended memorization or a retrieval/context leak.
- **A/B testing model changes in production**: rather than relying solely on offline eval sets, route a small percentage of real traffic to a new prompt/model version and compare downstream business metrics (task completion rate, user satisfaction ratings) against the existing version — offline evals are necessary but not sufficient for catching every real-world failure mode.

---

## 9. Practice Exercises

1. Extend the eval harness above to 10+ diverse test cases and compute the overall pass rate for both the rule-based and LLM-judge checks — identify any systematic disagreement between the two.
2. Implement position-bias testing for an LLM-as-judge comparison: judge the same pair of responses in both orderings (A-then-B and B-then-A) and measure how often the verdict flips.
3. Write 5 adversarial prompts attempting to override a system prompt's constraints (from the LLM Fundamentals sheet's example), test them against a real model, and categorize which succeeded vs. failed.
4. Implement a simple citation-checking function that verifies every sentence of a RAG-generated answer is supported by at least one retrieved source document, and test it against a deliberately hallucinated answer.
5. Design and implement a canary-token test: insert a unique fake fact into a small RAG knowledge base, then query the system with unrelated questions to confirm the canary fact never leaks into unrelated answers.

---

## 10. More Examples

### Example: A simple automated regression test suite for prompt changes

```python
regression_tests = [
    {"input": "What's 15% of 200?", "check": lambda output: "30" in output},
    {"input": "Translate 'hello' to Spanish.", "check": lambda output: "hola" in output.lower()},
    {"input": "Is the sky green?", "check": lambda output: "no" in output.lower()},
]

def run_regression_suite(prompt_fn, tests):
    failures = []
    for test in tests:
        output = prompt_fn(test["input"])
        if not test["check"](output):
            failures.append({"input": test["input"], "output": output})
    return failures

# Run this test suite every time the system prompt or model version changes,
# treating a new failure exactly like a code regression
```

### Example: Measuring output consistency across paraphrased inputs

```python
paraphrases = [
    "What is the capital of France?",
    "Which city is France's capital?",
    "Tell me France's capital city.",
]

def check_consistency(prompt_fn, paraphrases):
    outputs = [prompt_fn(p) for p in paraphrases]
    # A robust model should give substantively the same answer regardless of phrasing
    unique_answers = len(set(o.strip().lower()[:50] for o in outputs))
    return unique_answers == 1, outputs

# consistent, outputs = check_consistency(my_model_call, paraphrases)
```

### Example: Tracking safety-relevant refusal rates over a test set

```python
def measure_refusal_rate(prompt_fn, borderline_prompts):
    """For a set of prompts that SHOULD be declined, measure how often the model actually declines —
    and separately, for benign prompts, how often it incorrectly over-refuses."""
    refusal_phrases = ["i can't", "i cannot", "i won't", "unable to help"]
    refused = sum(
        1 for p in borderline_prompts
        if any(phrase in prompt_fn(p).lower() for phrase in refusal_phrases)
    )
    return refused / len(borderline_prompts)

# Track this metric over time as prompts/models change — both under-refusal (safety risk)
# and over-refusal (helpfulness/user-frustration risk) are worth monitoring as distinct failure modes
```

---

## 11. Quick-Reference Cheat-Table

| Need | Approach |
|---|---|
| Open-ended output scoring | LLM-as-judge (with bias mitigations) |
| Exact-match tasks | Rule-based / exact-match scoring |
| General capability claim | Don't trust benchmarks alone — build a task-specific eval set |
| Hallucination detection | Citation checking, self-consistency sampling |
| Guardrail validation | Adversarial/red-team testing, not just polite test cases |
| Production safety monitoring | A/B test + track refusal rate and error rate over time |

## 12. FAQ

**Q: Is a high benchmark score (MMLU, etc.) enough to trust a model for my task?**
A: No — benchmark performance and task-specific performance can diverge significantly. Always validate on your own representative eval set.

**Q: Can I trust an LLM judging another LLM's output?**
A: With caution — watch for position bias, verbosity bias, and self-preference bias. Randomize ordering and use detailed rubrics to mitigate these.

**Q: How do I know if my guardrails actually work?**
A: Adversarial testing, not just checking normal/polite inputs — real misuse attempts are adversarial by design, and your test suite needs to be too.

**Q: Does RAG solve hallucination?**
A: It substantially reduces it but doesn't eliminate it — the model can still misuse or misread retrieved context. Keep citation-checking as a separate safeguard.

**Q: Should every production request go through an LLM-as-judge check?**
A: Usually not — reserve expensive judge calls for a sample of traffic or pre-deployment test suites; use cheap rule-based checks for every request when possible.
