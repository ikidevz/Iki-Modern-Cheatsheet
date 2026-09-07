# Interpreter

**Category:** Behavioral
**Also known as:** —

## Intent
Given a language, define a representation for its grammar along with an interpreter that uses the representation to interpret sentences in the language.

## Motivation
Business rules — discount eligibility, feature flags, pricing logic — often need to be defined by non-programmers or changed frequently without a redeploy. Hardcoding them in `if/elif` chains makes every change require a code deployment:

```python
def is_eligible_for_discount(customer):
    if customer.total_spent > 1000 and customer.is_member:
        return True
    if customer.total_spent > 500 and customer.years_active >= 2:
        return True
    # every new rule combination means editing and redeploying this function
    return False
```

If business analysts need to author and combine rules like `spent > 1000 AND is_member` or `spent > 500 AND years_active >= 2 OR is_vip`, they need some way to *describe* these rules as data, not Python code. Interpreter addresses exactly this: define a small grammar (terms like `AND`, `OR`, comparisons) as a class hierarchy, and "interpreting" a rule becomes walking that structure — new rules can be composed at runtime, even loaded from a config file or database, without touching the interpreter's code at all.

## Applicability — When to Use
- The grammar is simple; complex grammars make the class hierarchy unmanageable (use parser generators instead).
- Efficiency is not a critical concern — tree-walking interpretation is slower than a compiled/optimized evaluator.
- You need to interpret sentences of a language repeatedly, such as rule engines, feature-flag conditions, or configuration DSLs.

## Structure
```
AbstractExpression
  + interpret(context)
       ^          ^
       |          |
TerminalExpression   NonterminalExpression --composed of--> AbstractExpression
```

## Participants
| Role | Responsibility |
|---|---|
| `AbstractExpression` | Declares the `interpret()` operation shared by every node in the grammar tree. |
| `TerminalExpression` | Implements `interpret()` for the grammar's basic symbols (literals, variables). |
| `NonterminalExpression` | Implements `interpret()` for grammar rules that combine other expressions (AND, OR, +, -). |
| `Context` | Holds global information the interpretation needs (e.g., variable bindings) — often passed to `interpret()`. |

## Basic Implementation
```python
from abc import ABC, abstractmethod


class Expression(ABC):
    @abstractmethod
    def interpret(self) -> int: ...


class Number(Expression):
    """Terminal expression"""

    def __init__(self, value: int) -> None:
        self.value = value

    def interpret(self) -> int:
        return self.value


class Add(Expression):
    """Nonterminal expression"""

    def __init__(self, left: Expression, right: Expression) -> None:
        self.left = left
        self.right = right

    def interpret(self) -> int:
        return self.left.interpret() + self.right.interpret()


class Subtract(Expression):
    def __init__(self, left: Expression, right: Expression) -> None:
        self.left = left
        self.right = right

    def interpret(self) -> int:
        return self.left.interpret() - self.right.interpret()


# Represents: (5 + 3) - 2
expression = Subtract(Add(Number(5), Number(3)), Number(2))
print(expression.interpret())  # 6
```

## Real-World Example: A Discount Rule Engine

Turning the motivating scenario into a working rule engine: business rules built from simple terminal comparisons combined with `AND`/`OR`/`NOT`, evaluated against a `Context` (a customer), and constructible either directly in Python or from a small nested-list "language."

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Customer:
    """The Context each rule is evaluated against."""
    total_spent: float
    is_member: bool
    years_active: int
    is_vip: bool = False


class Rule(ABC):
    @abstractmethod
    def interpret(self, customer: Customer) -> bool: ...


# --- Terminal expressions: atomic comparisons ---
class SpentAtLeast(Rule):
    def __init__(self, amount: float) -> None:
        self.amount = amount

    def interpret(self, customer: Customer) -> bool:
        return customer.total_spent >= self.amount


class IsMember(Rule):
    def interpret(self, customer: Customer) -> bool:
        return customer.is_member


class YearsActiveAtLeast(Rule):
    def __init__(self, years: int) -> None:
        self.years = years

    def interpret(self, customer: Customer) -> bool:
        return customer.years_active >= self.years


class IsVIP(Rule):
    def interpret(self, customer: Customer) -> bool:
        return customer.is_vip


# --- Nonterminal expressions: combinators ---
class And(Rule):
    def __init__(self, left: Rule, right: Rule) -> None:
        self.left = left
        self.right = right

    def interpret(self, customer: Customer) -> bool:
        return self.left.interpret(customer) and self.right.interpret(customer)


class Or(Rule):
    def __init__(self, left: Rule, right: Rule) -> None:
        self.left = left
        self.right = right

    def interpret(self, customer: Customer) -> bool:
        return self.left.interpret(customer) or self.right.interpret(customer)


class Not(Rule):
    def __init__(self, rule: Rule) -> None:
        self.rule = rule

    def interpret(self, customer: Customer) -> bool:
        return not self.rule.interpret(customer)


# Business rule, composed like a sentence in our tiny grammar:
#   (spent >= 1000 AND is_member) OR (spent >= 500 AND years_active >= 2) OR is_vip
discount_rule: Rule = Or(
    Or(
        And(SpentAtLeast(1000), IsMember()),
        And(SpentAtLeast(500), YearsActiveAtLeast(2)),
    ),
    IsVIP(),
)

customers = [
    Customer(total_spent=1200, is_member=True, years_active=1),   # qualifies: spent+member
    Customer(total_spent=600, is_member=False, years_active=3),   # qualifies: spent+years
    Customer(total_spent=50, is_member=False, years_active=0, is_vip=True),  # qualifies: VIP
    Customer(total_spent=100, is_member=False, years_active=0),   # does not qualify
]

for customer in customers:
    eligible = discount_rule.interpret(customer)
    print(f"{customer} -> discount eligible: {eligible}")
```

### Building rules from data (the real payoff)
```python
# A tiny nested-list "language" a non-programmer (or a config file) could produce:
#   ["OR", ["AND", ["spent_at_least", 1000], ["is_member"]], ["is_vip"]]
def build_rule(node: list) -> Rule:
    op, *args = node
    if op == "AND":
        return And(build_rule(args[0]), build_rule(args[1]))
    if op == "OR":
        return Or(build_rule(args[0]), build_rule(args[1]))
    if op == "NOT":
        return Not(build_rule(args[0]))
    if op == "spent_at_least":
        return SpentAtLeast(args[0])
    if op == "is_member":
        return IsMember()
    if op == "years_active_at_least":
        return YearsActiveAtLeast(args[0])
    if op == "is_vip":
        return IsVIP()
    raise ValueError(f"Unknown rule op: {op}")


config_rule = build_rule(["OR", ["AND", ["spent_at_least", 1000], ["is_member"]], ["is_vip"]])
print(config_rule.interpret(customers[0]))   # True — built entirely from data, not code
```

The `build_rule()` function is the point of the whole pattern: business rules now live as **data** (JSON, a database row, a config file) instead of Python `if` statements, and evaluating a new rule combination never requires a code change or redeploy.

## Implementation Notes
- Keep the grammar genuinely small. The moment you need operator precedence, string parsing, or more than a handful of node types, switch to a real parser (Python's `ast` module, `pyparsing`, or a parser generator) — hand-rolled Interpreter trees don't scale past simple, well-bounded grammars.
- The `Context` object (here, `Customer`) should carry everything interpretation needs — avoid reaching for global state inside `interpret()`, which makes rules harder to test in isolation.
- Combine with [Composite](../structural/composite.md) mentally: the rule tree built by `And`/`Or`/`Not` **is** a Composite structure; Interpreter is really "Composite plus a domain-specific meaning for `interpret()`."

## Consequences

**Pros**
- Easy to change or extend the grammar — each rule is an isolated, independently testable class.
- Implementing the grammar itself is straightforward since classes mirror grammar rules directly.
- Rules can be built from external data, enabling non-developers to author logic without code changes.

**Cons**
- Complex grammars lead to large, hard-to-maintain class hierarchies — use parser generators (e.g., ANTLR, `ply`) instead for anything non-trivial.
- Generally less efficient than a purpose-built parser/compiler, since every evaluation re-walks the tree.

## Common Pitfalls
- Reaching for Interpreter to parse a genuinely complex language (a real query language, a scripting DSL) — that's a job for proper parsing tools, not a hand-rolled class-per-grammar-rule tree.
- Letting terminal expressions reach into global/mutable state instead of receiving everything they need via the `Context` parameter — breaks testability and makes rules order-dependent.

## Real-World Examples
- Regular expression engines
- SQL `WHERE`-clause style filter/rule evaluators, feature-flag targeting rules
- Simple template engines and calculator apps

## Related Patterns
- [Composite](../structural/composite.md) — the expression tree (AST) built by Interpreter *is* a Composite structure.
- [Flyweight](../structural/flyweight.md) — terminal symbols shared across many rule trees can be implemented as flyweights.
- [Visitor](#) — an alternative way to add new interpretation logic without adding another method to every node class.
