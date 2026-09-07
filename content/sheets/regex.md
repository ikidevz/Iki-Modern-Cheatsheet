# Python Regex (`re` Module) Cheatsheet

A structured, tested reference for Python's built-in `re` module — syntax, functions, common patterns, real-world recipes, and gotchas. Every snippet below has been executed against Python 3.12.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Quick Reference Table](#2-quick-reference-table)
3. [Metacharacters](#3-metacharacters)
4. [Character Classes](#4-character-classes)
5. [Quantifiers](#5-quantifiers)
6. [Anchors & Boundaries](#6-anchors--boundaries)
7. [Groups & Capturing](#7-groups--capturing)
8. [Lookaround Assertions](#8-lookaround-assertions)
9. [Flags](#9-flags)
10. [Core Functions](#10-core-functions)
11. [Match Object Methods](#11-match-object-methods)
12. [Common Validation Patterns](#12-common-validation-patterns)
13. [Extended Patterns](#13-extended-patterns)
14. [Practical Examples](#14-practical-examples)
15. [Real-World Recipes](#15-real-world-recipes)
16. [Advanced Techniques](#16-advanced-techniques)
17. [Performance Tips](#17-performance-tips)
18. [Gotchas](#18-gotchas)
19. [Beyond `re`: the `regex` Module](#19-beyond-re-the-regex-module)

---

## 1. Core Concepts

```python
import re
```

- **Raw strings**: always write regex patterns as raw strings (`r'...'`) so backslashes aren't interpreted as Python escape sequences. `r'\d+'`, not `'\d+'` (which happens to also work for `\d` but silently breaks for things like `\n` vs literal newline handling).
- **Pattern compilation**: `re.compile(pattern, flags)` pre-compiles a pattern into a reusable `Pattern` object. Use this when the same pattern runs many times (e.g. in a loop) — it avoids recompiling on every call.
- **Backslash-heavy patterns**: Python caches compiled patterns internally even when you call `re.search()` etc. directly with a string, so `re.compile` is about readability and reuse, not raw speed for one-off calls.
- **Everything returns `None` on no match** for `match`, `search`, `fullmatch` — always check before calling `.group()`.

---

## 2. Quick Reference Table

| Syntax                  | Meaning                    | Example        | Matches                |
| ----------------------- | -------------------------- | -------------- | ---------------------- |
| `.`                     | Any char except newline    | `a.c`          | `abc`, `axc`           |
| `\d`                    | Digit `[0-9]`              | `\d+`          | `123`                  |
| `\D`                    | Non-digit                  | `\D+`          | `abc`                  |
| `\w`                    | Word char `[a-zA-Z0-9_]`   | `\w+`          | `foo_1`                |
| `\W`                    | Non-word char              | `\W+`          | `!@#`                  |
| `\s`                    | Whitespace                 | `\s+`          | `  \t\n`               |
| `\S`                    | Non-whitespace             | `\S+`          | `abc`                  |
| `\b`                    | Word boundary              | `\bcat\b`      | `cat` in `a cat sat`   |
| `\B`                    | Non-word-boundary          | `\Bcat`        | `cat` in `concat`      |
| `^`                     | Start of string/line       | `^abc`         | `abc` at start         |
| `$`                     | End of string/line         | `abc$`         | `abc` at end           |
| `*`                     | 0 or more (greedy)         | `ab*`          | `a`, `ab`, `abbb`      |
| `+`                     | 1 or more (greedy)         | `ab+`          | `ab`, `abbb`           |
| `?`                     | 0 or 1                     | `ab?`          | `a`, `ab`              |
| `{n}`                   | Exactly n                  | `a{3}`         | `aaa`                  |
| `{n,}`                  | n or more                  | `a{2,}`        | `aa`, `aaaa`           |
| `{n,m}`                 | Between n and m            | `a{2,4}`       | `aa`..`aaaa`           |
| `*?` `+?` `??` `{n,m}?` | Lazy (non-greedy) versions | `<.+?>`        | shortest match         |
| `[...]`                 | Character class            | `[aeiou]`      | any vowel              |
| `[^...]`                | Negated class              | `[^0-9]`       | any non-digit          |
| `\|`                    | Alternation (OR)           | `cat\|dog`     | `cat` or `dog`         |
| `(...)`                 | Capturing group            | `(ab)+`        | captures `ab`          |
| `(?:...)`               | Non-capturing group        | `(?:ab)+`      | groups without capture |
| `(?P<name>...)`         | Named group                | `(?P<y>\d{4})` | captures as `y`        |
| `(?=...)`               | Positive lookahead         | `\d(?=px)`     | digit before `px`      |
| `(?!...)`               | Negative lookahead         | `\d(?!px)`     | digit not before `px`  |
| `(?<=...)`              | Positive lookbehind        | `(?<=\$)\d+`   | digits after `$`       |
| `(?<!...)`              | Negative lookbehind        | `(?<!\$)\d+`   | digits not after `$`   |
| `\1`, `\g<name>`        | Backreference              | `(\w+) \1`     | repeated word          |

| Function         | Purpose                                  | Returns                  |
| ---------------- | ---------------------------------------- | ------------------------ |
| `re.match()`     | Match at **start** of string             | `Match` or `None`        |
| `re.fullmatch()` | Match the **entire** string              | `Match` or `None`        |
| `re.search()`    | Find first match **anywhere**            | `Match` or `None`        |
| `re.findall()`   | Find **all** matches                     | `list` of strings/tuples |
| `re.finditer()`  | Find all matches, lazily                 | iterator of `Match`      |
| `re.sub()`       | Replace matches                          | `str`                    |
| `re.subn()`      | Replace matches, with count              | `(str, count)`           |
| `re.split()`     | Split string by pattern                  | `list` of strings        |
| `re.compile()`   | Pre-compile a pattern                    | `Pattern` object         |
| `re.escape()`    | Escape special chars in a literal string | `str`                    |

---

## 3. Metacharacters

Characters with special meaning that must be escaped (`\.`) to match literally:

```
. ^ $ * + ? { } [ ] \ | ( )
```

```python
import re

# Literal dot needs escaping
re.findall(r'\d+\.\d+', 'version 3.14 and 2.0')
# -> ['3.14', '2.0']

# Alternation
re.findall(r'cat|dog', 'I have a cat and a dog')
# -> ['cat', 'dog']
```

---

## 4. Character Classes

```python
import re

re.findall(r'\d', 'a1b2')            # -> ['1', '2']        digits
re.findall(r'\w+', 'foo_bar 123')    # -> ['foo_bar', '123'] word chars
re.split(r'\s+', 'a   b\tc\nd')      # -> ['a', 'b', 'c', 'd']

re.findall(r'[aeiou]', 'hello world')      # -> ['e', 'o', 'o']       custom class
re.findall(r'[^aeiou\s]', 'hi there')      # -> ['h', 't', 'h', 'r']  negated class
re.findall(r'[a-f]', 'abcxyz')             # -> ['a', 'b', 'c']       range
re.findall(r'[a-zA-Z0-9]', 'ab_12!')       # -> ['a','b','1','2']     combined ranges
```

**Notes:**

- Inside `[...]`, most metacharacters lose their special meaning (`[.+*]` matches literal `.`, `+`, or `*`).
- `^` inside `[...]` only negates when it's the **first** character; otherwise it's literal (`[a^b]` matches `a`, `^`, or `b`).
- `-` is literal if it's first, last, or escaped inside a class (`[-abc]`, `[abc-]`, `[a\-c]`).

---

## 5. Quantifiers

```python
import re

re.match(r'a*', 'aaa').group()      # -> 'aaa'   0 or more
re.match(r'a+', 'aaa').group()      # -> 'aaa'   1 or more
re.findall(r'colou?r', 'color colour')   # -> ['color', 'colour']   0 or 1

re.findall(r'\d{3}', '12 123 1234')      # -> ['123', '123']        exactly 3
re.findall(r'\d{2,3}', '1 12 123 1234')  # -> ['12', '123', '123']  2 to 3 (greedy)

# Greedy vs. lazy
re.match(r'<.+>', '<a><b>').group()      # -> '<a><b>'   greedy: longest match
re.match(r'<.+?>', '<a><b>').group()     # -> '<a>'      lazy: shortest match
```

**Greedy vs. lazy rule of thumb:** `*`, `+`, `{n,m}` grab as much as possible by default. Append `?` to make them grab as little as possible. Lazy quantifiers are essential when parsing delimited content like HTML tags or quoted strings.

---

## 6. Anchors & Boundaries

```python
import re

re.match(r'^abc', 'abcdef')                       # matches — start of string
re.search(r'def$', 'abcdef')                      # matches — end of string

re.findall(r'\bcat\b', 'cat category concat cat')  # -> ['cat', 'cat']   word boundary
re.findall(r'\Bcat', 'concatenate scatter')        # -> ['cat', 'cat']   NOT at word boundary
```

- `\b` matches the _position_ between a `\w` character and a non-`\w` character (or string edge) — it doesn't consume any characters.
- With `re.MULTILINE`, `^` and `$` match at the start/end of **every line**, not just the whole string (see [Flags](#9-flags)).
- `\A` and `\Z` always match start/end of the **entire string**, regardless of `MULTILINE`.

---

## 7. Groups & Capturing

```python
import re

# Capturing groups — accessed by position
m = re.match(r'(\d{4})-(\d{2})-(\d{2})', '2024-06-15')
m.groups()          # -> ('2024', '06', '15')
m.group(1)          # -> '2024'

# Named groups — accessed by name, more readable
m = re.match(r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})', '2024-06-15')
m.group('year')     # -> '2024'
m.groupdict()        # -> {'year': '2024', 'month': '06', 'day': '15'}

# Non-capturing group — groups for alternation/quantifying without capturing
m = re.match(r'(?:ab)+c', 'ababc')
m.group()            # -> 'ababc'
m.groups()           # -> ()   nothing captured

# Backreference — match the same text captured earlier
re.match(r'(\w+) \1', 'hello hello')   # matches (repeated word)
re.match(r'(\w+) \1', 'hello world')   # -> None

# Using named groups in re.sub replacement text
re.sub(r'(?P<first>\w+) (?P<last>\w+)', r'\g<last> \g<first>', 'John Smith')
# -> 'Smith John'
```

**When to use which:**

- **Capturing `(...)`** — you need the matched text back.
- **Non-capturing `(?:...)`** — you only need grouping for `|` or a quantifier, and don't care about the captured value (slightly faster, keeps `.groups()` clean).
- **Named `(?P<name>...)`** — multiple groups where positional indexing (`group(1)`, `group(2)`...) would get confusing.

---

## 8. Lookaround Assertions

Lookarounds check for a pattern **without consuming characters** — useful for conditions on context that shouldn't be part of the match itself.

```python
import re

# Positive lookahead: match digits only if followed by " dollars"
re.findall(r'\d+(?= dollars)', '10 dollars 20 euros 30 dollars')
# -> ['10', '30']

# Negative lookahead: match digits only if NOT followed by " dollars"
re.findall(r'\d+(?! dollars)', '10 dollars 20 euros')
# -> ['0', '20']   (careful: partial matches — see Gotchas)

# Positive lookbehind: match digits only if preceded by "$"
re.findall(r'(?<=\$)\d+', 'Price: $50, Cost: $100, Rate 20')
# -> ['50', '100']

# Negative lookbehind: match digits only if NOT preceded by "$"
re.findall(r'(?<!\$)\b\d+\b', 'Price: $50, Count: 100')
# -> ['100']
```

| Assertion           | Syntax     | Checks                        |
| ------------------- | ---------- | ----------------------------- |
| Positive lookahead  | `(?=...)`  | What follows **is** this      |
| Negative lookahead  | `(?!...)`  | What follows **is not** this  |
| Positive lookbehind | `(?<=...)` | What precedes **is** this     |
| Negative lookbehind | `(?<!...)` | What precedes **is not** this |

**Note:** Python's lookbehind requires the pattern inside `(?<=...)` / `(?<!...)` to be a **fixed width** (no unbounded `*`/`+` inside), unlike lookahead which has no such restriction.

---

## 9. Flags

Pass as the second/third argument to `re` functions, or combine with `|`.

```python
import re

re.match(r'hello', 'HELLO', re.IGNORECASE)          # matches — case-insensitive

re.findall(r'^\w+', 'foo\nbar\nbaz', re.MULTILINE)  # -> ['foo', 'bar', 'baz']
                                                       # ^ matches start of EACH line

re.match(r'a.b', 'a\nb', re.DOTALL)                  # matches — . now matches \n too
re.match(r'a.b', 'a\nb')                             # -> None (without DOTALL)

# VERBOSE: write patterns across multiple lines with comments/whitespace ignored
pattern = re.compile(r"""
    (\d{3})   # area code
    -
    (\d{4})   # local number
""", re.VERBOSE)
pattern.match('555-1234').groups()   # -> ('555', '1234')
```

| Flag            | Short  | Effect                                                                   |
| --------------- | ------ | ------------------------------------------------------------------------ |
| `re.IGNORECASE` | `re.I` | Case-insensitive matching                                                |
| `re.MULTILINE`  | `re.M` | `^`/`$` match at line boundaries, not just string boundaries             |
| `re.DOTALL`     | `re.S` | `.` also matches newline characters                                      |
| `re.VERBOSE`    | `re.X` | Whitespace and `#` comments in the pattern are ignored (for readability) |
| `re.ASCII`      | `re.A` | `\w`, `\d`, `\s`, `\b` match ASCII only, not full Unicode                |
| `re.UNICODE`    | `re.U` | Default in Python 3 — Unicode-aware matching                             |

Combine flags with `|`: `re.compile(pattern, re.IGNORECASE | re.MULTILINE)`.

---

## 10. Core Functions

```python
import re

# match() — anchored at the START of the string only
re.match(r'\d+', '123abc').group()          # -> '123'
re.match(r'\d+', 'abc123')                  # -> None (doesn't search)

# fullmatch() — the ENTIRE string must match
re.fullmatch(r'\d+', '12345')               # matches
re.fullmatch(r'\d+', '123a45')              # -> None

# search() — scans the whole string, returns first match
re.search(r'\d+', 'abc123def').group()      # -> '123'

# findall() — all non-overlapping matches as a list
re.findall(r'\d+', 'a1 b22 c333')           # -> ['1', '22', '333']
# with groups, returns tuples of the groups (not the full match)
re.findall(r'(\w)(\d)', 'a1 b2')            # -> [('a','1'), ('b','2')]

# finditer() — like findall but returns an iterator of Match objects
# (better for large text — lazy, and gives you .span()/.start()/.end())
for m in re.finditer(r'\d+', 'a1 b22 c333'):
    print(m.group(), m.span())
# 1 (1, 2)
# 22 (4, 6)
# 333 (8, 11)

# sub() — replace matches with a string (or a function)
re.sub(r'\d+', '#', 'a1 b22 c333')          # -> 'a# b# c#'
re.sub(r'\b[a-z]', lambda m: m.group().upper(), 'hello world')
# -> 'Hello World'
re.sub(r'a', 'X', 'banana', count=2)        # -> 'bXnXna'   limit replacements

# subn() — like sub() but also returns the replacement count
re.subn(r'\d+', '#', 'a1 b22 c333')         # -> ('a# b# c#', 3)

# split() — split string on pattern matches
re.split(r'\s*,\s*', 'a, b,c ,  d')         # -> ['a', 'b', 'c', 'd']
re.split(r'\s+', 'a b c d', maxsplit=2)     # -> ['a', 'b', 'c d']

# compile() — pre-compile for reuse (recommended in loops)
pattern = re.compile(r'\d+')
pattern.search('x9y').group()               # -> '9'
pattern.findall('a1 b2 c3')                 # -> ['1', '2', '3']

# escape() — escape all special characters in a literal string
safe = re.escape('1+1=2? (yes)')
re.match(safe, '1+1=2? (yes)')              # matches literally
```

---

## 11. Match Object Methods

```python
import re

m = re.search(r'(\d+)-(\d+)', 'range 10-20 end')

m.group()        # -> '10-20'   full match (same as group(0))
m.group(1, 2)    # -> ('10', '20')
m.groups()       # -> ('10', '20')   all capturing groups
m.start()        # -> 6    start index of the full match
m.end()          # -> 11   end index of the full match
m.span()         # -> (6, 11)
m.start(1)       # -> 6    start index of group 1 specifically
```

| Method                   | Returns                             |
| ------------------------ | ----------------------------------- |
| `.group(0)` / `.group()` | The entire matched text             |
| `.group(n)`              | Text of capturing group `n`         |
| `.group('name')`         | Text of named group                 |
| `.groups()`              | Tuple of all capturing groups       |
| `.groupdict()`           | Dict of named groups                |
| `.start([n])`            | Start index of match (or group `n`) |
| `.end([n])`              | End index of match (or group `n`)   |
| `.span([n])`             | `(start, end)` tuple                |
| `.re`                    | The `Pattern` object used           |
| `.string`                | The original input string           |

---

## 12. Common Validation Patterns

All patterns below were tested against valid and invalid sample inputs.

```python
import re

# Email (practical, not full RFC 5322)
email_pat = r'^[\w.+-]+@[\w-]+\.[\w.-]+$'
re.match(email_pat, 'john.doe+test@sub.example.com')   # matches

# URL
url_pat = r'^https?://[\w.-]+(?:\.[a-zA-Z]{2,})+(?:/[\w./?%&=+-]*)?$'
re.match(url_pat, 'https://www.example.com/path?query=1')   # matches

# US phone number (accepts optional parens/dashes/dots/spaces)
phone_pat = r'^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$'
re.match(phone_pat, '(555) 123-4567')   # matches
re.match(phone_pat, '555-123-4567')     # matches
re.match(phone_pat, '5551234567')       # matches

# IPv4 address (rejects octets over 255)
ipv4_pat = r'^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$'
re.match(ipv4_pat, '192.168.1.1')       # matches
re.match(ipv4_pat, '999.999.999.999')   # -> None

# ISO 8601 date (YYYY-MM-DD, validates month/day ranges)
iso_date_pat = r'^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$'
re.match(iso_date_pat, '2024-06-15')    # matches
re.match(iso_date_pat, '2024-13-15')    # -> None (invalid month)

# 24-hour time (HH:MM or HH:MM:SS)
time_pat = r'^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$'
re.match(time_pat, '23:59')             # matches
re.match(time_pat, '09:05:30')          # matches
re.match(time_pat, '25:00')             # -> None

# Hex color code (#fff or #ffffff)
hex_color_pat = r'^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
re.match(hex_color_pat, '#1a2b3c')      # matches
re.match(hex_color_pat, '#fff')         # matches

# Username (starts with a letter, 3-16 chars, alphanumeric + underscore)
username_pat = r'^[a-zA-Z][a-zA-Z0-9_]{2,15}$'
re.match(username_pat, 'john_doe123')   # matches
re.match(username_pat, '1john')         # -> None (can't start with digit)

# US ZIP code (5 digits, optional +4)
zip_pat = r'^\d{5}(?:-\d{4})?$'
re.match(zip_pat, '90210')              # matches
re.match(zip_pat, '90210-1234')         # matches

# Strong password: 8+ chars, upper, lower, digit, special char
strong_pw_pat = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$'
re.match(strong_pw_pat, 'MyP@ssw0rd')   # matches
re.match(strong_pw_pat, 'MyPassword1')  # -> None (no special char)
```

| Pattern                                                                         | Use case                     |
| ------------------------------------------------------------------------------- | ---------------------------- |
| `^[\w.+-]+@[\w-]+\.[\w.-]+$`                                                    | Email (practical validation) |
| `^https?://[\w.-]+(?:\.[a-zA-Z]{2,})+(?:/[\w./?%&=+-]*)?$`                      | URL                          |
| `^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$`                                         | US phone number              |
| `^(?:(?:25[0-5]\|2[0-4]\d\|[01]?\d?\d)\.){3}(?:25[0-5]\|2[0-4]\d\|[01]?\d?\d)$` | IPv4 address                 |
| `^\d{4}-(?:0[1-9]\|1[0-2])-(?:0[1-9]\|[12]\d\|3[01])$`                          | ISO date (YYYY-MM-DD)        |
| `^#(?:[0-9a-fA-F]{3}\|[0-9a-fA-F]{6})$`                                         | Hex color                    |
| `^\d{5}(?:-\d{4})?$`                                                            | US ZIP code                  |

---

## 13. Extended Patterns

More validation and extraction patterns for identifiers, formats, and structured text. All tested against real examples.

```python
import re

# UUID (standard hyphenated form, any version)
uuid_pat = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
re.match(uuid_pat, '550e8400-e29b-41d4-a716-446655440000')   # matches

# IPv6 address (full and compressed "::" forms)
ipv6_pat = r'''^(
    (?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}
  | (?:[0-9a-fA-F]{1,4}:){1,7}:
  | (?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}
  | (?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}
  | (?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}
  | (?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}
  | (?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}
  | [0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}
  | :(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)
)$'''
ipv6 = re.compile(ipv6_pat, re.VERBOSE)
ipv6.match('2001:0db8:85a3:0000:0000:8a2e:0370:7334')   # matches (full)
ipv6.match('2001:db8::8a2e:370:7334')                    # matches (compressed)
ipv6.match('::1')                                        # matches (loopback)

# MAC address
mac_pat = r'^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$'
re.match(mac_pat, '00:1A:2B:3C:4D:5E')   # matches

# Semantic version (semver.org core grammar)
semver_pat = (
    r'^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)'
    r'(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)'
    r'(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?'
    r'(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$'
)
re.match(semver_pat, '1.2.3')            # matches
re.match(semver_pat, '1.2.3-alpha.1')    # matches (prerelease)
re.match(semver_pat, '1.2.3+build.456')  # matches (build metadata)
re.match(semver_pat, '1.02.3')           # -> None (leading zero not allowed)

# URL-friendly slug
slug_pat = r'^[a-z0-9]+(?:-[a-z0-9]+)*$'
re.match(slug_pat, 'my-blog-post-title')   # matches
re.match(slug_pat, 'My Blog Post!')        # -> None

# Unix file path
unix_path_pat = r'^(/[^/\0]+)+/?$'
re.match(unix_path_pat, '/home/user/docs/file.txt')   # matches

# Windows file path
win_path_pat = r'^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$'
re.match(win_path_pat, r'C:\Users\john\Documents\file.txt')   # matches

# GPS coordinates ("lat, long" decimal degrees)
coord_pat = r'^-?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*-?(?:1[0-7]\d(?:\.\d+)?|180(?:\.0+)?|\d{1,2}(?:\.\d+)?)$'
re.match(coord_pat, '40.7128, -74.0060')   # matches
re.match(coord_pat, '95.0, -74.0060')      # -> None (latitude out of range)

# Credit card number FORMAT only (major networks) — this is NOT a validity/Luhn check
cc_pat = r'^(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})$'
re.match(cc_pat, '4111111111111111')   # matches (Visa-shaped)
re.match(cc_pat, '5500000000000004')   # matches (Mastercard-shaped)

# ISBN-13
isbn13_pat = r'^(?:97[89])-?\d{1,5}-?\d{1,7}-?\d{1,7}-?\d$'
re.match(isbn13_pat, '978-3-16-148410-0')   # matches
re.match(isbn13_pat, '9783161484100')       # matches (no dashes)

# HTML entities (named and numeric)
html_entity_pat = r'&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);'
re.findall(html_entity_pat, 'Tom &amp; Jerry &copy; 2024')
# -> ['&amp;', '&copy;']

# Markdown links -> (text, url) pairs
md_link_pat = r'\[([^\]]+)\]\(([^)]+)\)'
re.findall(md_link_pat, 'See [Google](https://google.com) and [Docs](https://docs.python.org)')
# -> [('Google', 'https://google.com'), ('Docs', 'https://docs.python.org')]

# Multi-currency amounts ($, €, £, ¥)
currency_multi_pat = r'[$€£¥]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?'
re.findall(currency_multi_pat, 'Costs: $100, €50.00, £75, ¥1,000')
# -> ['$100', '€50.00', '£75', '¥1,000']
```

| Pattern                                                                       | Use case      |
| ----------------------------------------------------------------------------- | ------------- |
| `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}` | UUID          |
| `(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}`                                        | MAC address   |
| `[a-z0-9]+(?:-[a-z0-9]+)*`                                                    | URL slug      |
| `&(?:#\d+\|#x[0-9a-fA-F]+\|[a-zA-Z]+);`                                       | HTML entity   |
| `\[([^\]]+)\]\(([^)]+)\)`                                                     | Markdown link |

> **Credit card caveat:** the pattern above only checks that the digit sequence _looks like_ a real network's number format (correct prefix + length). It does **not** verify the number is actually valid — that requires the [Luhn checksum algorithm](https://en.wikipedia.org/wiki/Luhn_algorithm), which is arithmetic, not something regex can do.

---

## 14. Practical Examples

```python
import re

# 1. Strip HTML tags
re.sub(r'<[^>]+>', '', '<p>Hello <b>World</b></p>')
# -> 'Hello World'

# 2. Collapse repeated whitespace into single spaces
re.sub(r'\s+', ' ', 'foo   bar\t\tbaz\n\nqux').strip()
# -> 'foo bar baz qux'

# 3. Extract hashtags
re.findall(r'#(\w+)', 'Loving #Python and #RegEx today! #coding')
# -> ['Python', 'RegEx', 'coding']

# 4. Extract @mentions
re.findall(r'@(\w+)', 'Thanks @alice and @bob_smith for the help')
# -> ['alice', 'bob_smith']

# 5. Parse a structured log line into fields
log_pat = r'^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (\w+) (.+)$'
re.match(log_pat, '2024-06-15 10:30:45 ERROR Failed to connect to database').groups()
# -> ('2024-06-15', '10:30:45', 'ERROR', 'Failed to connect to database')

# 6. Convert camelCase to snake_case
re.sub(r'(?<!^)(?=[A-Z])', '_', 'camelCaseVariableName').lower()
# -> 'camel_case_variable_name'

# 7. Redact emails from text
re.sub(r'[\w.+-]+@[\w-]+\.[\w.-]+', '[EMAIL REDACTED]', 'Contact john@example.com or jane@test.org')
# -> 'Contact [EMAIL REDACTED] or [EMAIL REDACTED]'

# 8. Extract currency amounts (correctly groups thousands separators)
re.findall(r'\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?', 'Prices: $1,234.56, $99, $10,000.00')
# -> ['$1,234.56', '$99', '$10,000.00']

# 9. Split on commas but NOT commas inside double quotes (simple CSV-like parsing)
re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', 'a,b,"c,d",e')
# -> ['a', 'b', '"c,d"', 'e']

# 10. Extract only alphabetic words (drops punctuation, splits on apostrophes/hyphens)
re.findall(r'[A-Za-z]+', "It's a test-case, isn't it?")
# -> ['It', 's', 'a', 'test', 'case', 'isn', 't', 'it']

# 11. Swap "First Last" to "Last First" using named groups
re.sub(r'(?P<first>\w+) (?P<last>\w+)', r'\g<last> \g<first>', 'John Smith')
# -> 'Smith John'

# 12. Search starting from a specific position in a string
re.compile(r'\d+').search('abc123def456', pos=6).group()
# -> '456'
```

---

## 15. Real-World Recipes

Grouped by task domain — the kind of one-off regex you reach for while scraping, parsing logs, cleaning data, or working with text and config files.

### Web scraping

```python
import re

# Extract all href URLs from raw HTML
html_doc = '<a href="https://a.com">A</a><a href="/relative/b">B</a>'
re.findall(r'href="([^"]+)"', html_doc)
# -> ['https://a.com', '/relative/b']

# Extract image sources
img_html = '<img src="pic1.jpg" alt="x"><img src="pic2.png">'
re.findall(r'<img[^>]+src="([^"]+)"', img_html)
# -> ['pic1.jpg', 'pic2.png']

# Extract a meta description tag's content
meta_html = '<meta name="description" content="A great page about cats">'
re.search(r'<meta\s+name="description"\s+content="([^"]*)"', meta_html).group(1)
# -> 'A great page about cats'
```

> **Note:** these patterns work for simple, well-formed snippets. For real-world HTML parsing, prefer an HTML parser (`BeautifulSoup`, `lxml`) — regex breaks down on nested/malformed tags. Use it for quick extraction on known, simple markup.

### Log parsing

```python
import re

# Apache/Nginx Common Log Format
clf_pat = r'^(\S+) \S+ (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+)$'
clf_line = '127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326'
re.match(clf_pat, clf_line).groups()
# -> ('127.0.0.1', 'frank', '10/Oct/2023:13:55:36 -0700', 'GET', '/apache_pb.gif', 'HTTP/1.0', '200', '2326')

# Pull every IPv4 address out of a log blob
log_blob = "Connection from 192.168.1.5 refused. Retry from 10.0.0.1 succeeded."
re.findall(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', log_blob)
# -> ['192.168.1.5', '10.0.0.1']

# Extract file:line references from a Python traceback
trace = 'Traceback: File "app.py", line 42, in run\n  File "utils.py", line 7, in helper'
re.findall(r'File "([^"]+)", line (\d+)', trace)
# -> [('app.py', '42'), ('utils.py', '7')]

# Parse structured key=value log lines (values may be quoted)
kv_line = 'level=error msg="disk full" code=507 retry=true'
re.findall(r'(\w+)=(".*?"|\S+)', kv_line)
# -> [('level', 'error'), ('msg', '"disk full"'), ('code', '507'), ('retry', 'true')]
```

### Data cleaning

```python
import re

# Strip non-printable / control characters
re.sub(r'[\x00-\x1f\x7f]', '', 'Hello\x00World\x07Test\x1f')
# -> 'HelloWorldTest'

# Normalize a messy phone number down to digits only
re.sub(r'\D', '', '+1 (555) 123-4567 ext.89')
# -> '1555123456789'

# Pull all numbers (including decimals) out of mixed text
re.findall(r'\d+(?:\.\d+)?', 'Order #4521 shipped 3 items at $12.99 each, total $38.97')
# -> ['4521', '3', '12.99', '38.97']

# Strip non-ASCII characters (accents, emoji, CJK, etc.)
re.sub(r'[^\x00-\x7F]', '', 'Café résumé naïve 咖啡 emoji😀')
# -> 'Caf rsum nave  emoji'
```

### Text processing

```python
import re

# Split a paragraph into sentences, avoiding false splits on abbreviations
paragraph = "Dr. Smith went home. He was tired! Did he sleep? Yes, he did."
pat = r'(?<!\bDr\.)(?<!\bMr\.)(?<!\bMs\.)(?<=[.!?])\s+'
re.split(pat, paragraph)
# -> ['Dr. Smith went home.', 'He was tired!', 'Did he sleep?', 'Yes, he did.']

# Extract double-quoted strings
re.findall(r'"([^"]*)"', 'She said "hello there" and then "goodbye" quietly')
# -> ['hello there', 'goodbye']

# Find accidentally duplicated consecutive words ("is is", "test test")
re.findall(r'\b(\w+)\s+\1\b', "This is is a test test of of duplicates", flags=re.IGNORECASE)
# -> ['is', 'test', 'of']
```

### Config & code parsing

```python
import re

# Parse a .env-style file, skipping comments and blank lines
env_text = "# comment\nDB_HOST=localhost\nDB_PORT=5432\n\nDEBUG=true"
re.findall(r'^(?!#)(\w+)=(.*)$', env_text, flags=re.MULTILINE)
# -> [('DB_HOST', 'localhost'), ('DB_PORT', '5432'), ('DEBUG', 'true')]

# Extract module names from Python import statements
py_code = "import os\nimport sys as system\nfrom collections import OrderedDict\nfrom typing import List, Dict"
re.findall(r'^(?:import|from)\s+([\w.]+)', py_code, flags=re.MULTILINE)
# -> ['os', 'sys', 'collections', 'typing']

# Find TODO / FIXME comments and their text
code = "# TODO: fix this bug\nx = 1\n# FIXME: refactor later\ny = 2  # TODO add tests"
re.findall(r'#\s*(TODO|FIXME):?\s*(.*)', code)
# -> [('TODO', 'fix this bug'), ('FIXME', 'refactor later'), ('TODO', 'add tests')]
```

---

## 16. Advanced Techniques

```python
import re

# Keep the delimiters when splitting, by wrapping them in a capturing group
re.split(r'([,;])', 'a,b;c,d')
# -> ['a', ',', 'b', ';', 'c', ',', 'd']

# Find OVERLAPPING matches using a zero-width lookahead trick
# (findall() normally only returns non-overlapping matches)
re.findall(r'(?=(AA))', 'AAAA')
# -> ['AA', 'AA', 'AA']   every position where "AA" starts, including overlaps

# Dynamic, computed replacements with a callback function
def f_to_c(m):
    f = float(m.group(1))
    c = (f - 32) * 5 / 9
    return f"{c:.1f}°C"

re.sub(r'(\d+(?:\.\d+)?)F', f_to_c, "Today is 98.6F and tomorrow 77F")
# -> 'Today is 37.0°C and tomorrow 25.0°C'

# A mini tokenizer/"scanner" using named-group alternation + .lastgroup
token_pat = re.compile(r'''
    (?P<NUMBER>\d+(?:\.\d+)?)
  | (?P<IDENT>[A-Za-z_]\w*)
  | (?P<OP>[+\-*/=])
  | (?P<WS>\s+)
''', re.VERBOSE)

tokens = [
    (m.lastgroup, m.group())
    for m in token_pat.finditer('x = 3.14 + y')
    if m.lastgroup != 'WS'
]
# -> [('IDENT','x'), ('OP','='), ('NUMBER','3.14'), ('OP','+'), ('IDENT','y')]

# VERBOSE mode for a complex, self-documenting pattern
complex_log_pat = re.compile(r"""
    ^(?P<date>\d{4}-\d{2}-\d{2})   # ISO date
    \s+
    (?P<time>\d{2}:\d{2}:\d{2})    # 24h time
    \s+
    \[(?P<level>\w+)\]             # log level in brackets
    \s+
    (?P<message>.+)$               # rest of the line
""", re.VERBOSE)

complex_log_pat.match('2024-06-15 10:30:45 [ERROR] Disk full on /var').groupdict()
# -> {'date': '2024-06-15', 'time': '10:30:45', 'level': 'ERROR', 'message': 'Disk full on /var'}

# Case-insensitive backreferences still respect the flag on the whole match
re.match(r'(?P<word>\w+) \1', 'Hello hello', re.IGNORECASE)
# matches — "Hello" and "hello" are treated as equal under IGNORECASE
```

**What each technique is for:**

- **Split keeping delimiters** — useful when you need to reassemble text after processing, or need to know _what_ separated two chunks.
- **Overlapping matches via lookahead** — `findall`/`finditer` normally consume matched text and move past it; wrapping the real pattern in a lookahead `(?=(...))` makes the engine check-and-not-consume, so the next search starts one character later instead of past the whole match.
- **Callback-based `sub()`** — anytime the replacement depends on the matched value itself (unit conversion, case transforms, formatting), pass a function instead of a string.
- **Named-group tokenizer pattern** — the standard way to hand-roll a simple lexer in Python without a parser library; `match.lastgroup` tells you which alternative fired.
- **`VERBOSE`** — the difference between a regex you can read six months later and one you can't. Worth it for anything beyond a few characters.

---

## 17. Performance Tips

- **Pre-compile patterns used in loops or called repeatedly**: `pattern = re.compile(r'...')` once, then call `pattern.search(...)` many times, instead of `re.search(r'...', ...)` in every iteration.
- **Prefer `finditer()` over `findall()` for large text** when you don't need every match materialized in memory at once — it's a lazy iterator.
- **Avoid unnecessary capturing groups**: use `(?:...)` instead of `(...)` when you don't need the captured value — it's marginally cheaper and keeps `.groups()` output clean.
- **Watch for catastrophic backtracking**: nested quantifiers like `(a+)+` or `(a|aa)+` on non-matching input can cause exponential-time blowups. Avoid ambiguous nested repetition; prefer atomic/possessive-style rewrites (e.g. `a+` instead of `(a+)+`) or use `re.fullmatch` with a tighter pattern.
- **Anchor patterns when possible** (`^`, `$`, `\A`, `\Z`) — an anchored pattern can fail fast instead of scanning the whole string.
- **`str.startswith()` / `in` / `str.split()` are faster than regex** for simple literal checks — reach for regex only when you need pattern matching, not plain substring logic.

---

## 18. Gotchas

- **`match()` only anchors at the start, not the end.** `re.match(r'\d+', '123abc')` succeeds and returns `'123'` — it does _not_ require the whole string to match. Use `fullmatch()` for whole-string validation.
- **`findall()` with groups returns tuples, not full matches.** `re.findall(r'(\w)(\d)', 'a1 b2')` returns `[('a','1'), ('b','2')]`, not `['a1', 'b2']`. If you want the full match alongside groups, wrap the whole pattern in its own group too, or use `finditer()` and read `.group()`.
- **Negative lookahead/lookbehind can produce partial, overlapping-looking results.** `re.findall(r'\d+(?! dollars)', '10 dollars 20 euros')` returns `['0', '20']`, not `['20']` — because `1` in `10` is followed by `0 dollars` (fails the assertion at that position) but `0` itself is followed by `' dollars'`... actually the engine finds the _longest run of digits not immediately followed by " dollars"_ at each position, which can slice a number oddly. Test negative lookarounds against real sample data before trusting them.
- **Character classes don't distinguish context.** A pattern like `\$[\d,]+` for currency will happily swallow a trailing comma that's actually sentence punctuation (e.g. `$99,` in `$99, $10,000`). Use explicit thousands-grouping (`\d{1,3}(?:,\d{3})*`) instead of a loose `[\d,]+` class when parsing currency.
- **Lookbehind must be fixed-width in Python.** `(?<=\d+)` raises `error: look-behind requires fixed-width pattern`. Lookahead has no such restriction. This is why an abbreviation-aware sentence splitter needs `(?<!\bDr\.)` (fixed 3-char width) rather than something like `(?<!\b(?:Dr|Mr|Ms)\.)` with variable-length alternatives inside — Python's `re` rejects variable-width lookbehind outright.
- **"Full" validation regexes (IPv6, semver) are long for a reason.** A correct IPv6 pattern has to enumerate every valid placement of the `::` compression zone — there's no shortcut that stays both correct and short. When a validation pattern is ballooning, it's often a sign to reach for a dedicated parser (`ipaddress` module for IPs, `packaging.version` for semver) instead of forcing it through regex.
- **`.` doesn't match newlines by default.** This trips people up constantly when working with multi-line text — add `re.DOTALL` if you need `.` to cross line boundaries.
- **`^`/`$` mean "whole string" unless `re.MULTILINE` is set**, in which case they mean "start/end of each line." Mixing this up is a common source of subtly wrong matches on multi-line input.
- **Always use raw strings (`r'...'`).** Without the `r` prefix, sequences like `'\b'` are interpreted as a Python backspace character _before_ the regex engine ever sees them, silently breaking word-boundary patterns.
- **`re.compile()` objects are cached by Python automatically** for the string-based `re.search()`/`re.match()` calls too (a small internal cache), so compiling explicitly is about clarity and reuse across a large loop, not a guaranteed speed fix for one-off calls.
- **Unicode is on by default in Python 3.** `\w`, `\d`, `\s` match Unicode word/digit/space characters, not just ASCII, unless you pass `re.ASCII`. This matters for input validation on non-English text.
- **Regex isn't the right tool for nested/recursive structure.** HTML, JSON, and balanced parentheses can't be fully parsed by a _regular_ expression in the formal-language-theory sense (nesting requires more than regular grammar can express). Simple, flat, known-shape markup is fine; anything nested or attacker-controlled should go through a real parser.

---

## 19. Beyond `re`: the `regex` Module

Python's standard library `re` module is deliberately conservative. The third-party [`regex`](https://pypi.org/project/regex/) package (`pip install regex`) is a drop-in superset with features `re` doesn't support:

| Feature                                                  | `re` (stdlib)                              | `regex` (third-party)                               |
| -------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| Variable-width lookbehind                                | ❌ Not allowed                             | ✅ Supported                                        |
| Recursive patterns (`(?R)`)                              | ❌ Not supported                           | ✅ Supported — can match nested/balanced structures |
| Fuzzy matching (approximate matches, e.g. allow 1 typo)  | ❌ Not supported                           | ✅ Supported (`{e<=1}` syntax)                      |
| POSIX character classes (`[[:alpha:]]`)                  | ❌ Not supported                           | ✅ Supported                                        |
| Full Unicode property escapes (`\p{Greek}`)              | ❌ Not supported                           | ✅ Supported                                        |
| Overlapping matches                                      | Workaround only (lookahead trick, see §16) | ✅ Native `overlapped=True` option                  |
| Set operations on character classes (union/intersection) | ❌ Not supported                           | ✅ Supported                                        |

```python
# pip install regex
import regex

# Variable-width lookbehind — impossible in stdlib re
regex.findall(r'(?<=\b(?:Mr|Mrs|Dr)\. )\w+', 'Dr. Smith and Mrs. Jones')
# -> ['Smith', 'Jones']

# Fuzzy matching — allow up to 1 substitution error
regex.search(r'(?:hello){e<=1}', 'helo world')
# matches 'helo' despite the typo
```

Stick with stdlib `re` for everyday use — it's faster to start with, has zero dependencies, and covers the vast majority of real-world pattern matching. Reach for `regex` specifically when you need one of the features in the table above.
