# 1000+ One-Line Python Functions

A massive reference collection of one-line Python functions/lambdas, organized into 52 categories.
Copy-paste ready. Most are `lambda` expressions; a few use recursive self-reference (which works fine once assigned to a name).

---

## 1. Math & Numbers

```python
square = lambda x: x ** 2
cube = lambda x: x ** 3
is_even = lambda n: n % 2 == 0
is_odd = lambda n: n % 2 != 0
factorial = lambda n: 1 if n <= 1 else n * factorial(n - 1)
gcd = lambda a, b: a if b == 0 else gcd(b, a % b)
lcm = lambda a, b: a * b // gcd(a, b)
is_prime = lambda n: n > 1 and all(n % i for i in range(2, int(n**0.5) + 1))
fibonacci_n = lambda n: n if n <= 1 else fibonacci_n(n - 1) + fibonacci_n(n - 2)
average = lambda nums: sum(nums) / len(nums)
percentage = lambda part, whole: (part / whole) * 100
clamp = lambda x, lo, hi: max(lo, min(x, hi))
round_to = lambda x, n: round(x, n)
digit_sum = lambda n: sum(int(d) for d in str(abs(n)))
reverse_number = lambda n: int(str(n)[::-1])
is_palindrome_num = lambda n: str(n) == str(n)[::-1]
celsius_to_fahrenheit = lambda c: c * 9 / 5 + 32
fahrenheit_to_celsius = lambda f: (f - 32) * 5 / 9
is_perfect_square = lambda n: int(n ** 0.5) ** 2 == n
sign = lambda x: (x > 0) - (x < 0)
is_armstrong = lambda n: n == sum(int(d) ** len(str(n)) for d in str(n))
nth_root = lambda x, n: x ** (1 / n)
log_base = lambda x, base: __import__("math").log(x, base)
sum_of_divisors = lambda n: sum(i for i in range(1, n) if n % i == 0)
is_perfect_number = lambda n: sum(i for i in range(1, n) if n % i == 0) == n
is_abundant = lambda n: sum(i for i in range(1, n) if n % i == 0) > n
is_deficient = lambda n: sum(i for i in range(1, n) if n % i == 0) < n
triangular_number = lambda n: n * (n + 1) // 2
collatz_next = lambda n: n // 2 if n % 2 == 0 else 3 * n + 1
harmonic_mean = lambda nums: len(nums) / sum(1 / x for x in nums)
geometric_mean = lambda nums: __import__("math").prod(nums) ** (1 / len(nums))
power_mod = lambda base, exp, mod: pow(base, exp, mod)
integer_sqrt = lambda n: int(n ** 0.5)
is_coprime = lambda a, b: gcd(a, b) == 1
degrees_to_radians = lambda d: d * __import__("math").pi / 180
radians_to_degrees = lambda r: r * 180 / __import__("math").pi
sum_of_squares = lambda nums: sum(x ** 2 for x in nums)
binary_to_decimal = lambda b: int(str(b), 2)
decimal_to_binary = lambda n: bin(n)[2:]
decimal_to_hex = lambda n: hex(n)[2:]
decimal_to_octal = lambda n: oct(n)[2:]
```

## 2. Strings

```python
reverse_string = lambda s: s[::-1]
is_palindrome = lambda s: s.lower() == s.lower()[::-1]
count_vowels = lambda s: sum(1 for c in s.lower() if c in "aeiou")
remove_spaces = lambda s: s.replace(" ", "")
capitalize_words = lambda s: " ".join(w.capitalize() for w in s.split())
is_anagram = lambda a, b: sorted(a.lower()) == sorted(b.lower())
count_words = lambda s: len(s.split())
to_snake_case = lambda s: "_".join(s.lower().split())
to_camel_case = lambda s: s.split()[0].lower() + "".join(w.capitalize() for w in s.split()[1:])
remove_punctuation = lambda s: "".join(c for c in s if c.isalnum() or c.isspace())
count_char = lambda s, c: s.count(c)
truncate = lambda s, n: s[:n] + "..." if len(s) > n else s
is_pangram = lambda s: set("abcdefghijklmnopqrstuvwxyz") <= set(s.lower())
swap_case = lambda s: s.swapcase()
find_duplicates_chars = lambda s: set(c for c in s if s.count(c) > 1)
first_unique_char = lambda s: next((c for c in s if s.count(c) == 1), None)
is_numeric_string = lambda s: s.replace(".", "", 1).isdigit()
title_case = lambda s: s.title()
strip_html_tags = lambda s: __import__("re").sub("<[^<]+?>", "", s)
words_frequency = lambda s: {w: s.split().count(w) for w in set(s.split())}
is_upper = lambda s: s.isupper()
is_lower = lambda s: s.islower()
word_lengths = lambda s: [len(w) for w in s.split()]
longest_word = lambda s: max(s.split(), key=len)
shortest_word = lambda s: min(s.split(), key=len)
count_consonants = lambda s: sum(1 for c in s.lower() if c.isalpha() and c not in "aeiou")
remove_digits = lambda s: "".join(c for c in s if not c.isdigit())
extract_digits_str = lambda s: "".join(c for c in s if c.isdigit())
is_rotation = lambda a, b: len(a) == len(b) and a in b + b
char_frequency = lambda s: {c: s.count(c) for c in set(s)}
remove_repeated_chars = lambda s: "".join(dict.fromkeys(s))
pad_left = lambda s, n, c=" ": s.rjust(n, c)
pad_right = lambda s, n, c=" ": s.ljust(n, c)
center_text = lambda s, n: s.center(n)
repeat_string = lambda s, n: s * n
join_with_comma = lambda lst: ", ".join(lst)
split_by_length = lambda s, n: [s[i:i + n] for i in range(0, len(s), n)]
is_substring = lambda s, sub: sub in s
count_substring = lambda s, sub: s.count(sub)
replace_nth_occurrence = lambda s, old, new, n: s.replace(old, new, n)
is_all_same_char = lambda s: len(set(s)) == 1
remove_vowels = lambda s: "".join(c for c in s if c.lower() not in "aeiou")
word_count_unique = lambda s: len(set(s.split()))
string_to_list_of_chars = lambda s: list(s)
is_valid_identifier = lambda s: s.isidentifier()
```

## 3. Lists & Arrays

```python
flatten = lambda lst: [item for sub in lst for item in sub]
unique_items = lambda lst: list(set(lst))
remove_duplicates_ordered = lambda lst: list(dict.fromkeys(lst))
chunk_list = lambda lst, n: [lst[i:i + n] for i in range(0, len(lst), n)]
find_max = lambda lst: max(lst)
find_min = lambda lst: min(lst)
list_sum = lambda lst: sum(lst)
list_average = lambda lst: sum(lst) / len(lst)
sort_desc = lambda lst: sorted(lst, reverse=True)
second_largest = lambda lst: sorted(set(lst))[-2]
rotate_list = lambda lst, n: lst[n:] + lst[:n]
list_intersection = lambda a, b: list(set(a) & set(b))
list_difference = lambda a, b: list(set(a) - set(b))
list_union = lambda a, b: list(set(a) | set(b))
is_sorted = lambda lst: lst == sorted(lst)
count_occurrences = lambda lst, x: lst.count(x)
transpose_matrix = lambda m: [list(row) for row in zip(*m)]
flatten_deep = lambda lst: [x for i in lst for x in (flatten_deep(i) if isinstance(i, list) else [i])]
list_to_dict_index = lambda lst: {i: v for i, v in enumerate(lst)}
split_evens_odds = lambda lst: ([x for x in lst if x % 2 == 0], [x for x in lst if x % 2 != 0])
product_of_list = lambda lst: __import__("math").prod(lst)
list_median = lambda lst: sorted(lst)[len(lst)//2] if len(lst) % 2 else (sorted(lst)[len(lst)//2-1] + sorted(lst)[len(lst)//2]) / 2
mode_of_list = lambda lst: max(set(lst), key=lst.count)
remove_none = lambda lst: [x for x in lst if x is not None]
remove_falsy = lambda lst: [x for x in lst if x]
list_diff_consecutive = lambda lst: [lst[i+1] - lst[i] for i in range(len(lst)-1)]
cumulative_sum = lambda lst: [sum(lst[:i+1]) for i in range(len(lst))]
cumulative_product = lambda lst: [__import__("math").prod(lst[:i+1]) for i in range(len(lst))]
list_of_squares = lambda lst: [x**2 for x in lst]
pairwise = lambda lst: list(zip(lst, lst[1:]))
nth_element_every = lambda lst, n: lst[::n]
reverse_list_copy = lambda lst: lst[::-1]
shift_list_left = lambda lst, n: lst[n:] + lst[:n]
shift_list_right = lambda lst, n: lst[-n:] + lst[:-n]
find_index = lambda lst, x: lst.index(x) if x in lst else -1
all_unique = lambda lst: len(lst) == len(set(lst))
count_true = lambda lst: sum(bool(x) for x in lst)
zip_lists_to_dict = lambda keys, vals: dict(zip(keys, vals))
list_to_string = lambda lst, sep=" ": sep.join(map(str, lst))
remove_item_all = lambda lst, x: [i for i in lst if i != x]
is_monotonic = lambda lst: all(lst[i] <= lst[i+1] for i in range(len(lst)-1)) or all(lst[i] >= lst[i+1] for i in range(len(lst)-1))
list_intersection_ordered = lambda a, b: [x for x in a if x in b]
find_peak_indices = lambda lst: [i for i in range(1, len(lst)-1) if lst[i] > lst[i-1] and lst[i] > lst[i+1]]
```

## 4. Dictionaries

```python
invert_dict = lambda d: {v: k for k, v in d.items()}
merge_dicts = lambda d1, d2: {**d1, **d2}
filter_dict = lambda d, keys: {k: v for k, v in d.items() if k in keys}
dict_max_value_key = lambda d: max(d, key=d.get)
dict_min_value_key = lambda d: min(d, key=d.get)
sort_dict_by_value = lambda d: dict(sorted(d.items(), key=lambda x: x[1]))
sort_dict_by_key = lambda d: dict(sorted(d.items()))
sum_dict_values = lambda d: sum(d.values())
dict_from_two_lists = lambda keys, vals: dict(zip(keys, vals))
has_key = lambda d, k: k in d
dict_key_with_max_len_value = lambda d: max(d, key=lambda k: len(d[k]))
merge_dict_sum_values = lambda d1, d2: {k: d1.get(k, 0) + d2.get(k, 0) for k in set(d1) | set(d2)}
dict_average_values = lambda d: sum(d.values()) / len(d)
remove_key = lambda d, k: {key: v for key, v in d.items() if key != k}
dict_keys_to_list = lambda d: list(d.keys())
dict_values_to_list = lambda d: list(d.values())
swap_keys_values_safe = lambda d: {v: k for k, v in d.items()} if len(set(d.values())) == len(d) else None
dict_filter_by_value = lambda d, threshold: {k: v for k, v in d.items() if v > threshold}
count_key_occurrence_in_list = lambda lst: {k: lst.count(k) for k in set(lst)}
nested_dict_get = lambda d, keys, default=None: __import__("functools").reduce(lambda acc, k: acc.get(k, default) if isinstance(acc, dict) else default, keys, d)
dict_to_list_of_tuples = lambda d: list(d.items())
list_of_tuples_to_dict = lambda lst: dict(lst)
dict_compare_equal = lambda d1, d2: d1 == d2
update_dict_copy = lambda d, k, v: {**d, k: v}
dict_sort_items_by_value_length = lambda d: sorted(d.items(), key=lambda x: len(str(x[1])))
```

## 5. Sets

```python
is_subset = lambda a, b: set(a).issubset(set(b))
is_superset = lambda a, b: set(a).issuperset(set(b))
symmetric_diff = lambda a, b: set(a) ^ set(b)
has_common_elements = lambda a, b: bool(set(a) & set(b))
jaccard_similarity = lambda a, b: len(set(a) & set(b)) / len(set(a) | set(b))
remove_from_set = lambda s, x: s - {x}
is_disjoint = lambda a, b: set(a).isdisjoint(set(b))
set_powerset_len = lambda s: 2 ** len(s)
set_from_string = lambda s: set(s)
common_elements_count = lambda a, b: len(set(a) & set(b))
set_to_sorted_list = lambda s: sorted(s)
is_equal_set = lambda a, b: set(a) == set(b)
add_multiple_to_set = lambda s, items: s | set(items)
set_difference_both_ways = lambda a, b: (set(a) - set(b), set(b) - set(a))
unique_pairs = lambda lst: {(a, b) for i, a in enumerate(lst) for b in lst[i+1:]}
set_of_lengths = lambda lst: {len(x) for x in lst}
is_proper_subset = lambda a, b: set(a) < set(b)
is_proper_superset = lambda a, b: set(a) > set(b)
frozen_set_of = lambda lst: frozenset(lst)
set_map = lambda s, f: {f(x) for x in s}
```

## 6. Date & Time

```python
current_timestamp = lambda: __import__("time").time()
today_date = lambda: __import__("datetime").date.today()
days_between = lambda d1, d2: abs((d2 - d1).days)
is_leap_year = lambda y: y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
format_date = lambda d, fmt="%Y-%m-%d": d.strftime(fmt)
seconds_to_hms = lambda s: (s // 3600, (s % 3600) // 60, s % 60)
weekday_name = lambda d: d.strftime("%A")
add_days = lambda d, n: d + __import__("datetime").timedelta(days=n)
current_year = lambda: __import__("datetime").date.today().year
current_month = lambda: __import__("datetime").date.today().month
is_weekend = lambda d: d.weekday() >= 5
subtract_days = lambda d, n: d - __import__("datetime").timedelta(days=n)
age_from_birthdate = lambda birth: (__import__("datetime").date.today() - birth).days // 365
datetime_now = lambda: __import__("datetime").datetime.now()
timestamp_to_date = lambda ts: __import__("datetime").datetime.fromtimestamp(ts)
date_to_timestamp = lambda d: __import__("time").mktime(d.timetuple())
is_same_calendar_day = lambda d1, d2: d1.date() == d2.date()
next_day = lambda d: d + __import__("datetime").timedelta(days=1)
days_in_month = lambda y, m: __import__("calendar").monthrange(y, m)[1]
quarter_of_year = lambda m: (m - 1) // 3 + 1
```

## 7. File & OS

```python
read_file_lines = lambda path: open(path).readlines()
file_exists = lambda path: __import__("os").path.exists(path)
file_extension = lambda path: path.split(".")[-1]
list_dir_files = lambda path: __import__("os").listdir(path)
file_size = lambda path: __import__("os").path.getsize(path)
read_json = lambda path: __import__("json").load(open(path))
write_json = lambda path, data: __import__("json").dump(data, open(path, "w"))
get_env_var = lambda key, default=None: __import__("os").environ.get(key, default)
read_file_text = lambda path: open(path).read()
write_file_text = lambda path, text: open(path, "w").write(text)
append_to_file = lambda path, text: open(path, "a").write(text)
count_lines_in_file = lambda path: sum(1 for _ in open(path))
delete_file = lambda path: __import__("os").remove(path)
create_directory = lambda path: __import__("os").makedirs(path, exist_ok=True)
current_working_dir = lambda: __import__("os").getcwd()
join_paths = lambda *parts: __import__("os").path.join(*parts)
absolute_path = lambda path: __import__("os").path.abspath(path)
file_basename = lambda path: __import__("os").path.basename(path)
file_dirname = lambda path: __import__("os").path.dirname(path)
is_directory = lambda path: __import__("os").path.isdir(path)
```

## 8. Functional / Utility

```python
compose = lambda f, g: lambda x: f(g(x))
identity = lambda x: x
negate = lambda f: lambda *a: not f(*a)
apply_twice = lambda f, x: f(f(x))
pipeline = lambda funcs, x: __import__("functools").reduce(lambda acc, f: f(acc), funcs, x)
memoize = lambda f: __import__("functools").lru_cache(maxsize=None)(f)
curry_add = lambda a: lambda b: a + b
flip_args = lambda f: lambda a, b: f(b, a)
repeat_call = lambda f, n: [f() for _ in range(n)]
timer = lambda f: (lambda *a, **k: (__import__("time").time(), f(*a, **k)))
const = lambda x: lambda *a: x
partial_apply = lambda f, *args: lambda *more: f(*args, *more)
call_n_times = lambda f, n, x: [f(x) for _ in range(n)]
tap = lambda x, f: (f(x), x)[1]
always_true = lambda *a, **k: True
always_false = lambda *a, **k: False
compose_many = lambda *funcs: __import__("functools").reduce(lambda f, g: lambda x: f(g(x)), funcs)
is_callable = lambda x: callable(x)
get_function_name = lambda f: f.__name__
args_to_list = lambda *args: list(args)
kwargs_to_dict = lambda **kwargs: dict(kwargs)
apply_to_each = lambda f, lst: list(map(f, lst))
filter_and_map = lambda pred, f, lst: [f(x) for x in lst if pred(x)]
```

## 9. Boolean / Validation Checks

```python
is_valid_email = lambda s: bool(__import__("re").match(r"^[\w.+-]+@[\w-]+\.[\w.-]+$", s))
is_url = lambda s: bool(__import__("re").match(r"^https?://", s))
is_empty = lambda x: len(x) == 0
all_positive = lambda lst: all(x > 0 for x in lst)
all_negative = lambda lst: all(x < 0 for x in lst)
contains_digit = lambda s: any(c.isdigit() for c in s)
is_alpha_only = lambda s: s.isalpha()
is_binary_string = lambda s: set(s) <= {"0", "1"}
is_power_of_two = lambda n: n > 0 and (n & (n - 1)) == 0
is_list_of_type = lambda lst, t: all(isinstance(x, t) for x in lst)
is_valid_ipv4 = lambda ip: bool(__import__("re").match(r"^(\d{1,3}\.){3}\d{1,3}$", ip)) and all(0 <= int(x) <= 255 for x in ip.split("."))
is_valid_phone = lambda s: bool(__import__("re").match(r"^\+?\d{7,15}$", s))
is_hex_color = lambda s: bool(__import__("re").match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", s))
is_strong_password = lambda s: len(s) >= 8 and any(c.isupper() for c in s) and any(c.isdigit() for c in s)
is_valid_date_format = lambda s: bool(__import__("re").match(r"^\d{4}-\d{2}-\d{2}$", s))
contains_only_letters_and_numbers = lambda s: s.isalnum()
is_none_or_empty = lambda x: x is None or len(x) == 0
is_within_range = lambda x, lo, hi: lo <= x <= hi
is_ascii = lambda s: all(ord(c) < 128 for c in s)
all_same_type = lambda lst: len(set(type(x) for x in lst)) == 1
is_json_like = lambda s: s.strip().startswith(("{", "[")) and s.strip().endswith(("}", "]"))
is_square_matrix = lambda m: all(len(row) == len(m) for row in m)
is_symmetric_matrix = lambda m: all(m[i][j] == m[j][i] for i in range(len(m)) for j in range(len(m)))
is_valid_credit_card_luhn = lambda n: sum(int(d) if i % 2 == 0 else (int(d)*2 - 9 if int(d)*2 > 9 else int(d)*2) for i, d in enumerate(str(n)[::-1])) % 10 == 0
is_vowel = lambda c: c.lower() in "aeiou"
```

## 10. Misc / Fun

```python
random_choice = lambda lst: __import__("random").choice(lst)
shuffle_copy = lambda lst: __import__("random").sample(lst, len(lst))
random_int = lambda a, b: __import__("random").randint(a, b)
coin_flip = lambda: __import__("random").choice(["Heads", "Tails"])
generate_password = lambda n: "".join(__import__("random").choices(__import__("string").ascii_letters + __import__("string").digits, k=n))
hash_string = lambda s: __import__("hashlib").sha256(s.encode()).hexdigest()
encode_base64 = lambda s: __import__("base64").b64encode(s.encode()).decode()
decode_base64 = lambda s: __import__("base64").b64decode(s.encode()).decode()
url_encode = lambda s: __import__("urllib.parse", fromlist=["quote"]).quote(s)
get_hostname_ip = lambda: __import__("socket").gethostbyname(__import__("socket").gethostname())
countdown_list = lambda n: list(range(n, 0, -1))
ascii_value = lambda c: ord(c)
char_from_ascii = lambda n: chr(n)
dice_roll = lambda: __import__("random").randint(1, 6)
random_float = lambda a, b: __import__("random").uniform(a, b)
random_bool = lambda: __import__("random").choice([True, False])
shuffle_string = lambda s: "".join(__import__("random").sample(s, len(s)))
generate_uuid = lambda: __import__("uuid").uuid4()
random_hex_color = lambda: "#%06x" % __import__("random").randint(0, 0xFFFFFF)
flip_multiple_coins = lambda n: [__import__("random").choice(["H", "T"]) for _ in range(n)]
random_sample_from_range = lambda a, b, k: __import__("random").sample(range(a, b), k)
weighted_random_choice = lambda items, weights: __import__("random").choices(items, weights=weights, k=1)[0]
random_string = lambda n: "".join(__import__("random").choices(__import__("string").ascii_lowercase, k=n))
magic_8_ball = lambda: __import__("random").choice(["Yes", "No", "Maybe", "Ask again later"])
random_matrix = lambda r, c: [[__import__("random").randint(0, 9) for _ in range(c)] for _ in range(r)]
```

## 11. Bitwise Operations

```python
bitwise_and = lambda a, b: a & b
bitwise_or = lambda a, b: a | b
bitwise_xor = lambda a, b: a ^ b
bitwise_not = lambda a: ~a
left_shift = lambda a, n: a << n
right_shift = lambda a, n: a >> n
count_set_bits = lambda n: bin(n).count("1")
is_bit_set = lambda n, pos: bool(n & (1 << pos))
set_bit = lambda n, pos: n | (1 << pos)
clear_bit = lambda n, pos: n & ~(1 << pos)
toggle_bit = lambda n, pos: n ^ (1 << pos)
swap_two_numbers_xor = lambda a, b: (a ^ b, a ^ b ^ a)
is_odd_bitwise = lambda n: n & 1 == 1
multiply_by_2 = lambda n: n << 1
divide_by_2 = lambda n: n >> 1
get_lowest_set_bit = lambda n: n & -n
count_leading_zeros_32bit = lambda n: 32 - n.bit_length() if n > 0 else 32
bit_length_of = lambda n: n.bit_length()
binary_string_of = lambda n: format(n, "b")
hamming_distance = lambda a, b: bin(a ^ b).count("1")
```

## 12. Statistics & Probability

```python
variance = lambda lst: sum((x - sum(lst)/len(lst))**2 for x in lst) / len(lst)
std_dev = lambda lst: (sum((x - sum(lst)/len(lst))**2 for x in lst) / len(lst)) ** 0.5
median_val = lambda lst: sorted(lst)[len(lst)//2] if len(lst) % 2 else (sorted(lst)[len(lst)//2-1] + sorted(lst)[len(lst)//2]) / 2
range_of_list = lambda lst: max(lst) - min(lst)
z_score = lambda x, mean, std: (x - mean) / std
probability_of_event = lambda favorable, total: favorable / total
combinations_count = lambda n, r: __import__("math").comb(n, r)
permutations_count = lambda n, r: __import__("math").perm(n, r)
covariance = lambda x, y: sum((xi - sum(x)/len(x)) * (yi - sum(y)/len(y)) for xi, yi in zip(x, y)) / len(x)
correlation_sign = lambda x, y: 1 if sum((xi - sum(x)/len(x)) * (yi - sum(y)/len(y)) for xi, yi in zip(x, y)) > 0 else -1
normalize_list = lambda lst: [(x - min(lst)) / (max(lst) - min(lst)) for x in lst]
weighted_average = lambda vals, weights: sum(v * w for v, w in zip(vals, weights)) / sum(weights)
mode_count = lambda lst: max(lst.count(x) for x in set(lst))
is_normal_range = lambda x, mean, std, k=2: abs(x - mean) <= k * std
cumulative_probability = lambda probs: [sum(probs[:i+1]) for i in range(len(probs))]
expected_value = lambda outcomes, probs: sum(o * p for o, p in zip(outcomes, probs))
percentile_rank = lambda lst, x: sum(1 for v in lst if v <= x) / len(lst) * 100
skewness_sign = lambda lst: 1 if sum(lst)/len(lst) > sorted(lst)[len(lst)//2] else -1
relative_frequency = lambda lst: {x: lst.count(x)/len(lst) for x in set(lst)}
dice_probability = lambda target, sides=6: 1/sides if 1 <= target <= sides else 0
```

## 13. Geometry

```python
circle_area = lambda r: __import__("math").pi * r ** 2
circle_circumference = lambda r: 2 * __import__("math").pi * r
rectangle_area = lambda w, h: w * h
rectangle_perimeter = lambda w, h: 2 * (w + h)
triangle_area = lambda b, h: 0.5 * b * h
triangle_area_heron = lambda a, b, c: (lambda s: (s*(s-a)*(s-b)*(s-c))**0.5)((a+b+c)/2)
distance_2d = lambda x1, y1, x2, y2: ((x2-x1)**2 + (y2-y1)**2) ** 0.5
distance_3d = lambda p1, p2: sum((a-b)**2 for a, b in zip(p1, p2)) ** 0.5
sphere_volume = lambda r: (4/3) * __import__("math").pi * r ** 3
sphere_surface_area = lambda r: 4 * __import__("math").pi * r ** 2
cylinder_volume = lambda r, h: __import__("math").pi * r ** 2 * h
cube_volume = lambda s: s ** 3
cube_surface_area = lambda s: 6 * s ** 2
cone_volume = lambda r, h: (1/3) * __import__("math").pi * r ** 2 * h
is_right_triangle = lambda a, b, c: sorted([a, b, c])[0]**2 + sorted([a, b, c])[1]**2 == sorted([a, b, c])[2]**2
slope_of_line = lambda x1, y1, x2, y2: (y2 - y1) / (x2 - x1)
midpoint = lambda x1, y1, x2, y2: ((x1 + x2) / 2, (y1 + y2) / 2)
is_point_in_circle = lambda px, py, cx, cy, r: (px-cx)**2 + (py-cy)**2 <= r**2
polygon_interior_angle = lambda n: (n - 2) * 180 / n
perimeter_of_polygon = lambda points: sum(((points[i][0]-points[i-1][0])**2 + (points[i][1]-points[i-1][1])**2)**0.5 for i in range(len(points)))
```

## 14. Unit Conversions

```python
km_to_miles = lambda km: km * 0.621371
miles_to_km = lambda mi: mi / 0.621371
kg_to_lbs = lambda kg: kg * 2.20462
lbs_to_kg = lambda lb: lb / 2.20462
meters_to_feet = lambda m: m * 3.28084
feet_to_meters = lambda ft: ft / 3.28084
liters_to_gallons = lambda l: l * 0.264172
gallons_to_liters = lambda g: g / 0.264172
bytes_to_kb = lambda b: b / 1024
bytes_to_mb = lambda b: b / (1024 ** 2)
bytes_to_gb = lambda b: b / (1024 ** 3)
inches_to_cm = lambda i: i * 2.54
cm_to_inches = lambda cm: cm / 2.54
seconds_to_minutes = lambda s: s / 60
minutes_to_hours = lambda m: m / 60
hours_to_days = lambda h: h / 24
fahrenheit_to_kelvin = lambda f: (f - 32) * 5/9 + 273.15
kelvin_to_celsius = lambda k: k - 273.15
mph_to_kmh = lambda mph: mph * 1.60934
kmh_to_mph = lambda kmh: kmh / 1.60934
```

## 15. Color Conversions

```python
rgb_to_hex = lambda r, g, b: "#%02x%02x%02x" % (r, g, b)
hex_to_rgb = lambda h: tuple(int(h.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))
rgb_to_grayscale = lambda r, g, b: int(0.299*r + 0.587*g + 0.114*b)
invert_rgb = lambda r, g, b: (255 - r, 255 - g, 255 - b)
is_valid_rgb = lambda r, g, b: all(0 <= v <= 255 for v in (r, g, b))
rgb_to_cmyk_black = lambda r, g, b: 1 - max(r, g, b) / 255
lighten_color = lambda r, g, b, amt: tuple(min(255, int(c + (255 - c) * amt)) for c in (r, g, b))
darken_color = lambda r, g, b, amt: tuple(max(0, int(c * (1 - amt))) for c in (r, g, b))
blend_colors = lambda c1, c2: tuple((a + b) // 2 for a, b in zip(c1, c2))
random_rgb = lambda: tuple(__import__("random").randint(0, 255) for _ in range(3))
hex_to_int = lambda h: int(h.lstrip("#"), 16)
int_to_hex_color = lambda n: "#%06x" % n
rgb_brightness = lambda r, g, b: (r + g + b) / 3
is_dark_color = lambda r, g, b: (0.299*r + 0.587*g + 0.114*b) < 128
contrast_color = lambda r, g, b: "black" if (0.299*r + 0.587*g + 0.114*b) > 128 else "white"
```

## 16. Regex Utilities

```python
extract_numbers = lambda s: __import__("re").findall(r"\d+", s)
extract_emails = lambda s: __import__("re").findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", s)
extract_urls = lambda s: __import__("re").findall(r"https?://\S+", s)
extract_hashtags = lambda s: __import__("re").findall(r"#\w+", s)
extract_mentions = lambda s: __import__("re").findall(r"@\w+", s)
remove_extra_spaces = lambda s: __import__("re").sub(r"\s+", " ", s).strip()
is_matching_pattern = lambda s, pattern: bool(__import__("re").match(pattern, s))
replace_all = lambda s, pattern, repl: __import__("re").sub(pattern, repl, s)
split_on_multiple_delimiters = lambda s, delims: __import__("re").split("|".join(map(__import__("re").escape, delims)), s)
find_all_words = lambda s: __import__("re").findall(r"\b\w+\b", s)
extract_dates_iso = lambda s: __import__("re").findall(r"\d{4}-\d{2}-\d{2}", s)
extract_currency = lambda s: __import__("re").findall(r"\$\d+(?:\.\d{2})?", s)
is_only_letters_regex = lambda s: bool(__import__("re").match(r"^[A-Za-z]+$", s))
count_regex_matches = lambda s, pattern: len(__import__("re").findall(pattern, s))
mask_sensitive_digits = lambda s: __import__("re").sub(r"\d", "*", s)
camel_to_snake_regex = lambda s: __import__("re").sub(r"(?<!^)(?=[A-Z])", "_", s).lower()
extract_html_attributes = lambda s: __import__("re").findall(r'(\w+)="([^"]*)"', s)
is_valid_username = lambda s: bool(__import__("re").match(r"^[a-zA-Z0-9_]{3,16}$", s))
remove_non_alphanumeric = lambda s: __import__("re").sub(r"[^a-zA-Z0-9]", "", s)
find_repeated_words = lambda s: __import__("re").findall(r"\b(\w+)\s+\1\b", s)
```

## 17. Combinatorics

```python
all_permutations = lambda lst: list(__import__("itertools").permutations(lst))
all_combinations = lambda lst, r: list(__import__("itertools").combinations(lst, r))
all_combinations_with_replacement = lambda lst, r: list(__import__("itertools").combinations_with_replacement(lst, r))
cartesian_product = lambda a, b: list(__import__("itertools").product(a, b))
power_set = lambda lst: [c for r in range(len(lst)+1) for c in __import__("itertools").combinations(lst, r)]
all_subsets_of_size = lambda lst, n: list(__import__("itertools").combinations(lst, n))
n_choose_k = lambda n, k: __import__("math").comb(n, k)
n_permute_k = lambda n, k: __import__("math").perm(n, k)
group_consecutive = lambda lst: [list(g) for _, g in __import__("itertools").groupby(lst)]
chain_lists = lambda *lsts: list(__import__("itertools").chain(*lsts))
all_pairs = lambda lst: list(__import__("itertools").combinations(lst, 2))
repeat_element = lambda x, n: list(__import__("itertools").repeat(x, n))
take_first_n = lambda iterable, n: list(__import__("itertools").islice(iterable, n))
count_from = lambda start=0: __import__("itertools").count(start)
cycle_list_n_times = lambda lst, n: list(__import__("itertools").islice(__import__("itertools").cycle(lst), n * len(lst)))
```

## 18. Matrix Operations

```python
matrix_add = lambda a, b: [[a[i][j] + b[i][j] for j in range(len(a[0]))] for i in range(len(a))]
matrix_subtract = lambda a, b: [[a[i][j] - b[i][j] for j in range(len(a[0]))] for i in range(len(a))]
matrix_scalar_multiply = lambda m, k: [[x * k for x in row] for row in m]
matrix_multiply = lambda a, b: [[sum(a[i][k] * b[k][j] for k in range(len(b))) for j in range(len(b[0]))] for i in range(len(a))]
identity_matrix = lambda n: [[1 if i == j else 0 for j in range(n)] for i in range(n)]
matrix_trace = lambda m: sum(m[i][i] for i in range(len(m)))
flatten_matrix = lambda m: [x for row in m for x in row]
matrix_row_sums = lambda m: [sum(row) for row in m]
matrix_col_sums = lambda m: [sum(col) for col in zip(*m)]
is_identity_matrix = lambda m: all(m[i][j] == (1 if i == j else 0) for i in range(len(m)) for j in range(len(m)))
matrix_max_element = lambda m: max(max(row) for row in m)
matrix_min_element = lambda m: min(min(row) for row in m)
zero_matrix = lambda r, c: [[0] * c for _ in range(r)]
matrix_diagonal = lambda m: [m[i][i] for i in range(len(m))]
rotate_matrix_90 = lambda m: [list(row) for row in zip(*m[::-1])]
```

## 19. Searching & Sorting

```python
binary_search = lambda lst, target: (lambda i=__import__("bisect").bisect_left(lst, target): i if i < len(lst) and lst[i] == target else -1)()
linear_search = lambda lst, x: next((i for i, v in enumerate(lst) if v == x), -1)
quicksort = lambda lst: lst if len(lst) <= 1 else quicksort([x for x in lst[1:] if x < lst[0]]) + [lst[0]] + quicksort([x for x in lst[1:] if x >= lst[0]])
merge_sorted_lists = lambda a, b: sorted(a + b)
is_sorted_desc = lambda lst: lst == sorted(lst, reverse=True)
sort_by_key_func = lambda lst, key: sorted(lst, key=key)
sort_strings_by_length = lambda lst: sorted(lst, key=len)
find_kth_smallest = lambda lst, k: sorted(lst)[k-1]
find_kth_largest = lambda lst, k: sorted(lst, reverse=True)[k-1]
custom_sort_multiple_keys = lambda lst, k1, k2: sorted(lst, key=lambda x: (k1(x), k2(x)))
sort_dict_list_by_field = lambda lst, field: sorted(lst, key=lambda d: d[field])
find_closest_value = lambda lst, target: min(lst, key=lambda x: abs(x - target))
interpolation_search_guess = lambda lst, x: int((x - lst[0]) / (lst[-1] - lst[0]) * (len(lst) - 1)) if lst[-1] != lst[0] else 0
selection_sort_step = lambda lst: [max(lst)] + sorted([x for x in lst if x != max(lst)]) if lst else []
bubble_sort_pass = lambda lst: [min(lst)] + [x for x in lst if x != min(lst)] if lst else []
```

## 20. String Parsing / Formatting

```python
parse_csv_line = lambda line: line.split(",")
parse_key_value_pairs = lambda s: dict(pair.split("=") for pair in s.split("&"))
format_currency = lambda amount: f"${amount:,.2f}"
format_percentage = lambda val: f"{val:.1%}"
format_with_commas = lambda n: f"{n:,}"
pad_number_with_zeros = lambda n, width: str(n).zfill(width)
format_phone_number = lambda digits: f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
bytes_to_readable = lambda b: f"{b / (1024**2):.2f} MB" if b > 1024**2 else f"{b / 1024:.2f} KB"
string_to_bool = lambda s: s.strip().lower() in ("true", "1", "yes", "y")
multiline_to_single = lambda s: " ".join(s.splitlines())
wrap_text = lambda s, width: __import__("textwrap").fill(s, width)
slugify = lambda s: __import__("re").sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
mask_email = lambda email: email[0] + "***@" + email.split("@")[1]
format_seconds_as_clock = lambda s: f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}"
ordinal_suffix = lambda n: f"{n}{'th' if 11 <= n % 100 <= 13 else {1:'st', 2:'nd', 3:'rd'}.get(n % 10, 'th')}"
parse_int_safe = lambda s, default=0: int(s) if s.lstrip('-').isdigit() else default
escape_quotes = lambda s: s.replace('"', '\\"')
lines_to_list = lambda s: s.splitlines()
list_to_lines = lambda lst: "\n".join(lst)
format_name_last_first = lambda first, last: f"{last}, {first}"
```

## 21. Network / Data Validation

```python
is_valid_mac_address = lambda s: bool(__import__("re").match(r"^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$", s))
is_localhost = lambda ip: ip in ("127.0.0.1", "localhost", "::1")
is_private_ip = lambda ip: ip.startswith(("10.", "192.168.")) or bool(__import__("re").match(r"^172\.(1[6-9]|2\d|3[0-1])\.", ip))
extract_domain = lambda url: url.split("//")[-1].split("/")[0]
is_valid_port = lambda p: 0 <= p <= 65535
url_has_query_params = lambda url: "?" in url
get_query_params = lambda url: dict(p.split("=") for p in url.split("?")[1].split("&")) if "?" in url else {}
is_secure_url = lambda url: url.startswith("https://")
strip_protocol = lambda url: __import__("re").sub(r"^https?://", "", url)
is_valid_uuid = lambda s: bool(__import__("re").match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", s.lower()))
get_file_ext_from_url = lambda url: url.split(".")[-1].split("?")[0]
is_valid_json_content_type = lambda ct: "application/json" in ct
status_code_is_success = lambda code: 200 <= code < 300
status_code_is_error = lambda code: code >= 400
build_query_string = lambda params: "&".join(f"{k}={v}" for k, v in params.items())
```

## 22. JSON / CSV / Data Handling

```python
json_pretty_print = lambda obj: __import__("json").dumps(obj, indent=2)
json_minify = lambda obj: __import__("json").dumps(obj, separators=(",", ":"))
csv_row_to_dict = lambda header, row: dict(zip(header, row))
dict_list_to_csv_rows = lambda dicts: [list(d.values()) for d in dicts]
csv_column_values = lambda rows, col_index: [row[col_index] for row in rows]
flatten_json_keys = lambda d, parent="": {**{f"{parent}{k}": v for k, v in d.items() if not isinstance(v, dict)}, **{kk: vv for k, v in d.items() if isinstance(v, dict) for kk, vv in flatten_json_keys(v, f"{parent}{k}.").items()}}
csv_line_count = lambda path: sum(1 for _ in open(path)) - 1
dict_to_query_string = lambda d: "&".join(f"{k}={v}" for k, v in d.items())
json_keys_list = lambda json_str: list(__import__("json").loads(json_str).keys())
merge_json_strings = lambda s1, s2: __import__("json").dumps({**__import__("json").loads(s1), **__import__("json").loads(s2)})
csv_to_list_of_dicts = lambda path: list(__import__("csv").DictReader(open(path)))
write_csv_from_dicts = lambda path, dicts: __import__("csv").DictWriter(open(path, "w"), fieldnames=dicts[0].keys()).writerows(dicts)
list_to_json = lambda lst: __import__("json").dumps(lst)
json_to_list = lambda s: __import__("json").loads(s)
pretty_dict_print = lambda d: "\n".join(f"{k}: {v}" for k, v in d.items())
```

## 23. Tree / Graph Simple Checks

```python
is_leaf_node = lambda node: not node.get("children")
tree_depth = lambda node: 1 + max((tree_depth(c) for c in node.get("children", [])), default=0)
count_nodes = lambda node: 1 + sum(count_nodes(c) for c in node.get("children", []))
graph_has_edge = lambda graph, a, b: b in graph.get(a, [])
graph_neighbors = lambda graph, node: graph.get(node, [])
graph_degree = lambda graph, node: len(graph.get(node, []))
is_connected_pair = lambda graph, a, b: b in graph.get(a, []) or a in graph.get(b, [])
add_edge_undirected = lambda graph, a, b: graph.setdefault(a, []).append(b) or graph.setdefault(b, []).append(a)
all_nodes_in_graph = lambda graph: list(graph.keys())
total_edges_count = lambda graph: sum(len(v) for v in graph.values()) // 2
is_isolated_node = lambda graph, node: len(graph.get(node, [])) == 0
adjacency_list_to_matrix = lambda graph, nodes: [[1 if n2 in graph.get(n1, []) else 0 for n2 in nodes] for n1 in nodes]
tree_sum_values = lambda node: node.get("value", 0) + sum(tree_sum_values(c) for c in node.get("children", []))
find_leaves = lambda node: [node] if not node.get("children") else [leaf for c in node["children"] for leaf in find_leaves(c)]
graph_node_count = lambda graph: len(graph)
```

## 24. Encoding / Hashing / Crypto-lite

```python
md5_hash = lambda s: __import__("hashlib").md5(s.encode()).hexdigest()
sha1_hash = lambda s: __import__("hashlib").sha1(s.encode()).hexdigest()
sha512_hash = lambda s: __import__("hashlib").sha512(s.encode()).hexdigest()
caesar_cipher_encode = lambda s, shift: "".join(chr((ord(c) - 65 + shift) % 26 + 65) if c.isupper() else chr((ord(c) - 97 + shift) % 26 + 97) if c.islower() else c for c in s)
caesar_cipher_decode = lambda s, shift: caesar_cipher_encode(s, -shift)
rot13 = lambda s: __import__("codecs").encode(s, "rot_13")
xor_encrypt = lambda s, key: "".join(chr(ord(c) ^ key) for c in s)
base64_url_safe_encode = lambda s: __import__("base64").urlsafe_b64encode(s.encode()).decode()
base64_url_safe_decode = lambda s: __import__("base64").urlsafe_b64decode(s.encode()).decode()
checksum_simple = lambda s: sum(ord(c) for c in s) % 256
is_valid_hash_format = lambda s, length=64: bool(__import__("re").match(rf"^[a-f0-9]{{{length}}}$", s.lower()))
generate_random_token = lambda n=32: __import__("secrets").token_hex(n)
hash_file_contents = lambda path: __import__("hashlib").sha256(open(path, "rb").read()).hexdigest()
encode_utf8 = lambda s: s.encode("utf-8")
decode_utf8 = lambda b: b.decode("utf-8")
```

## 25. Physics & Science Conversions

```python
speed = lambda distance, time: distance / time
kinetic_energy = lambda m, v: 0.5 * m * v ** 2
potential_energy = lambda m, h, g=9.81: m * g * h
force = lambda m, a: m * a
work_done = lambda f, d: f * d
power_watts = lambda work, time: work / time
density = lambda mass, volume: mass / volume
pressure = lambda force, area: force / area
ohms_law_voltage = lambda i, r: i * r
ohms_law_current = lambda v, r: v / r
ohms_law_resistance = lambda v, i: v / i
wavelength_from_frequency = lambda freq, speed=3e8: speed / freq
escape_velocity = lambda g, m, r: (2 * g * m / r) ** 0.5
momentum = lambda m, v: m * v
gravitational_force = lambda m1, m2, r, g=6.674e-11: g * m1 * m2 / r ** 2
```

## 26. Financial Calculations

```python
simple_interest = lambda p, r, t: p * r * t / 100
compound_interest = lambda p, r, t, n=1: p * (1 + r / (100 * n)) ** (n * t) - p
total_after_compound = lambda p, r, t, n=1: p * (1 + r / (100 * n)) ** (n * t)
monthly_payment_loan = lambda principal, rate, months: principal * rate / (1 - (1 + rate) ** -months) if rate else principal / months
profit_margin = lambda revenue, cost: (revenue - cost) / revenue * 100
discount_price = lambda price, pct: price * (1 - pct / 100)
markup_price = lambda cost, pct: cost * (1 + pct / 100)
break_even_units = lambda fixed_costs, price, variable_cost: fixed_costs / (price - variable_cost)
roi_percentage = lambda gain, cost: (gain - cost) / cost * 100
tax_amount = lambda amount, rate: amount * rate / 100
tip_amount = lambda bill, pct: bill * pct / 100
split_bill = lambda total, people: total / people
future_value = lambda pv, rate, periods: pv * (1 + rate) ** periods
present_value = lambda fv, rate, periods: fv / (1 + rate) ** periods
currency_convert = lambda amount, rate: amount * rate
```

## 27. Text Analysis

```python
average_word_length = lambda s: sum(len(w) for w in s.split()) / len(s.split())
readability_word_count = lambda s: len(s.split())
sentence_count = lambda s: len(__import__("re").split(r"[.!?]+", s)) - 1
most_common_word = lambda s: max(set(s.lower().split()), key=s.lower().split().count)
lexical_diversity = lambda s: len(set(s.split())) / len(s.split())
count_uppercase_words = lambda s: sum(1 for w in s.split() if w.isupper())
longest_sentence = lambda s: max(__import__("re").split(r"[.!?]+", s), key=len).strip()
char_count_no_spaces = lambda s: len(s.replace(" ", ""))
text_similarity_ratio = lambda a, b: __import__("difflib").SequenceMatcher(None, a, b).ratio()
count_syllables_approx = lambda word: max(1, len(__import__("re").findall(r"[aeiouy]+", word.lower())))
is_question = lambda s: s.strip().endswith("?")
is_exclamation = lambda s: s.strip().endswith("!")
word_starts_with_count = lambda s, letter: sum(1 for w in s.split() if w.lower().startswith(letter.lower()))
average_sentence_length = lambda s: len(s.split()) / max(1, len(__import__("re").split(r"[.!?]+", s)) - 1)
reverse_words_order = lambda s: " ".join(s.split()[::-1])
```

## 28. Number Theory

```python
next_prime = lambda n: next(x for x in __import__("itertools").count(n + 1) if all(x % i for i in range(2, int(x**0.5) + 1)))
nth_prime = lambda n: list(__import__("itertools").islice((x for x in __import__("itertools").count(2) if all(x % i for i in range(2, int(x**0.5) + 1))), n))[-1]
prime_factors = lambda n: [i for i in range(2, n + 1) if n % i == 0 and all(i % j for j in range(2, int(i**0.5) + 1))]
is_twin_prime = lambda n: is_prime(n) and (is_prime(n + 2) or is_prime(n - 2))
divisor_count = lambda n: sum(1 for i in range(1, n + 1) if n % i == 0)
is_perfect_square_isqrt = lambda n: __import__("math").isqrt(n) ** 2 == n
euler_totient = lambda n: sum(1 for k in range(1, n + 1) if gcd(n, k) == 1)
is_relatively_prime = lambda a, b: gcd(a, b) == 1
sum_of_prime_factors = lambda n: sum(set(prime_factors(n)))
is_squarefree = lambda n: all(n % (i * i) != 0 for i in range(2, int(n**0.5) + 1))
digital_root = lambda n: n if n < 10 else digital_root(sum(int(d) for d in str(n)))
is_narcissistic_number = lambda n: n == sum(int(d) ** len(str(n)) for d in str(n))
count_digits = lambda n: len(str(abs(n)))
is_automorphic = lambda n: str(n**2).endswith(str(n))
is_kaprekar_number = lambda n: (lambda sq=str(n**2): n == 0 or (int((sq[:len(sq)-len(str(n))] or "0")) + int(sq[len(sq)-len(str(n)):])) == n)()
```

## 29. Array Utilities (no NumPy)

```python
zeros_array = lambda n: [0] * n
ones_array = lambda n: [1] * n
range_array = lambda start, stop, step=1: list(range(start, stop, step))
array_dot_product = lambda a, b: sum(x * y for x, y in zip(a, b))
array_scalar_multiply = lambda arr, k: [x * k for x in arr]
array_elementwise_add = lambda a, b: [x + y for x, y in zip(a, b)]
array_elementwise_subtract = lambda a, b: [x - y for x, y in zip(a, b)]
array_norm = lambda arr: sum(x**2 for x in arr) ** 0.5
array_argmax = lambda arr: arr.index(max(arr))
array_argmin = lambda arr: arr.index(min(arr))
array_cumsum = lambda arr: [sum(arr[:i+1]) for i in range(len(arr))]
array_reshape_pairs = lambda arr: list(zip(arr[::2], arr[1::2]))
array_clip = lambda arr, lo, hi: [max(lo, min(x, hi)) for x in arr]
array_unique_sorted = lambda arr: sorted(set(arr))
array_moving_average = lambda arr, w: [sum(arr[i:i+w]) / w for i in range(len(arr) - w + 1)]
```

## 30. Fun & Games

```python
rock_paper_scissors_winner = lambda a, b: "Tie" if a == b else "Player 1" if (a, b) in [("rock", "scissors"), ("paper", "rock"), ("scissors", "paper")] else "Player 2"
tic_tac_toe_row_winner = lambda board, row: board[row][0] if board[row][0] == board[row][1] == board[row][2] != "" else None
is_valid_chess_square = lambda s: bool(__import__("re").match(r"^[a-h][1-8]$", s))
card_value_blackjack = lambda card: 10 if card in ("J", "Q", "K") else 11 if card == "A" else int(card)
random_card_draw = lambda deck: __import__("random").choice(deck)
shuffle_deck = lambda deck: __import__("random").sample(deck, len(deck))
magic_square_sum = lambda n: n * (n**2 + 1) // 2
is_valid_sudoku_row = lambda row: sorted(row) == list(range(1, 10))
score_to_grade = lambda score: "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "F"
hangman_reveal = lambda word, guessed: "".join(c if c in guessed else "_" for c in word)
wheel_of_fortune_spin = lambda options: __import__("random").choice(options)
lottery_numbers = lambda n, max_num: sorted(__import__("random").sample(range(1, max_num + 1), n))
is_winning_lotto = lambda picked, drawn: set(picked) == set(drawn)
simple_rpg_damage = lambda attack, defense: max(1, attack - defense)
level_up_xp_needed = lambda level: level ** 2 * 100
```

## 31. Algorithms & Recursion

```python
sum_recursive = lambda n: 0 if n == 0 else n + sum_recursive(n - 1)
power_recursive = lambda base, exp: 1 if exp == 0 else base * power_recursive(base, exp - 1)
is_palindrome_recursive = lambda s: True if len(s) <= 1 else s[0] == s[-1] and is_palindrome_recursive(s[1:-1])
count_down_recursive = lambda n: [] if n <= 0 else [n] + count_down_recursive(n - 1)
sum_digits_recursive = lambda n: n if n < 10 else n % 10 + sum_digits_recursive(n // 10)
flatten_recursive = lambda lst: sum(([x] if not isinstance(x, list) else flatten_recursive(x) for x in lst), [])
reverse_recursive = lambda lst: [] if not lst else reverse_recursive(lst[1:]) + [lst[0]]
max_recursive = lambda lst: lst[0] if len(lst) == 1 else max(lst[0], max_recursive(lst[1:]))
min_recursive = lambda lst: lst[0] if len(lst) == 1 else min(lst[0], min_recursive(lst[1:]))
count_occurrences_recursive = lambda lst, x: 0 if not lst else (1 if lst[0] == x else 0) + count_occurrences_recursive(lst[1:], x)
is_sorted_recursive = lambda lst: True if len(lst) <= 1 else lst[0] <= lst[1] and is_sorted_recursive(lst[1:])
product_recursive = lambda lst: 1 if not lst else lst[0] * product_recursive(lst[1:])
length_recursive = lambda lst: 0 if not lst else 1 + length_recursive(lst[1:])
ackermann_lite = lambda m, n: n + 1 if m == 0 else (ackermann_lite(m - 1, 1) if n == 0 else ackermann_lite(m - 1, ackermann_lite(m, n - 1)))
tower_of_hanoi_moves = lambda n: 0 if n == 0 else 2 * tower_of_hanoi_moves(n - 1) + 1
gcd_recursive_list = lambda lst: lst[0] if len(lst) == 1 else gcd(lst[0], gcd_recursive_list(lst[1:]))
sum_of_list_tail = lambda lst, acc=0: acc if not lst else sum_of_list_tail(lst[1:], acc + lst[0])
count_vowels_recursive = lambda s: 0 if not s else (1 if s[0].lower() in "aeiou" else 0) + count_vowels_recursive(s[1:])
binary_exponentiation = lambda base, exp: 1 if exp == 0 else (binary_exponentiation(base * base, exp // 2) if exp % 2 == 0 else base * binary_exponentiation(base, exp - 1))
is_subsequence_recursive = lambda s, t: True if not s else (False if not t else (is_subsequence_recursive(s[1:], t[1:]) if s[0] == t[0] else is_subsequence_recursive(s, t[1:])))
merge_two_sorted_recursive = lambda a, b: a or b if not (a and b) else ([a[0]] + merge_two_sorted_recursive(a[1:], b) if a[0] <= b[0] else [b[0]] + merge_two_sorted_recursive(a, b[1:]))
count_digits_recursive = lambda n: 1 if n < 10 else 1 + count_digits_recursive(n // 10)
```

## 32. String Algorithms

```python
longest_common_prefix = lambda strs: __import__("os").path.commonprefix(strs)
edit_distance_lengths_diff = lambda a, b: abs(len(a) - len(b))
is_isomorphic_strings = lambda s, t: len(set(s)) == len(set(t)) == len(set(zip(s, t)))
count_distinct_substrings = lambda s: len({s[i:j] for i in range(len(s)) for j in range(i + 1, len(s) + 1)})
is_permutation_of = lambda a, b: sorted(a) == sorted(b)
longest_repeating_char_run = lambda s: max(len(list(g)) for _, g in __import__("itertools").groupby(s))
run_length_encode = lambda s: "".join(f"{c}{len(list(g))}" for c, g in __import__("itertools").groupby(s))
run_length_decode = lambda s: "".join(c * int(n) for c, n in __import__("re").findall(r"([A-Za-z])(\d+)", s))
is_valid_parentheses = lambda s: not __import__("functools").reduce(lambda stack, c: stack[:-1] if stack and c == ")" and stack[-1] == "(" else stack + [c], s, [])
string_compression_ratio = lambda s: len("".join(f"{c}{len(list(g))}" for c, g in __import__("itertools").groupby(s))) / len(s)
hamming_like_distance = lambda a, b: sum(x != y for x, y in zip(a, b)) + abs(len(a) - len(b))
find_all_anagram_starts = lambda s, p: [i for i in range(len(s) - len(p) + 1) if sorted(s[i:i + len(p)]) == sorted(p)]
longest_common_suffix = lambda a, b: __import__("os").path.commonprefix([a[::-1], b[::-1]])[::-1]
is_balanced_brackets_multi = lambda s: not __import__("functools").reduce(lambda st, c: st[:-1] if st and ((c == ")" and st[-1] == "(") or (c == "]" and st[-1] == "[") or (c == "}" and st[-1] == "{")) else (st + [c] if c in "([{" else st), s, [])
morse_partial_lookup = lambda c: {"A": ".-", "B": "-...", "S": "...", "O": "---"}.get(c.upper(), "")
count_words_starting_with_vowel = lambda s: sum(1 for w in s.split() if w[0].lower() in "aeiou")
text_justify_line = lambda words, width: " ".join(words).ljust(width)
word_break_possible = lambda s, wordset: s == "" or any(s[:i] in wordset and word_break_possible(s[i:], wordset) for i in range(1, len(s) + 1))
group_anagrams = lambda words: __import__("functools").reduce(lambda d, w: (d.setdefault("".join(sorted(w)), []).append(w), d)[1], words, {})
is_clean_palindrome = lambda s: (lambda clean=__import__("re").sub(r"[^a-z0-9]", "", s.lower()): clean == clean[::-1])()
caesar_brute_force_all = lambda s: [caesar_cipher_encode(s, k) for k in range(26)]
```

## 33. Stack & Queue Simulations

```python
stack_push = lambda stack, x: stack + [x]
stack_pop = lambda stack: stack[:-1]
stack_peek = lambda stack: stack[-1] if stack else None
stack_is_empty = lambda stack: len(stack) == 0
queue_enqueue = lambda queue, x: queue + [x]
queue_dequeue = lambda queue: queue[1:]
queue_front = lambda queue: queue[0] if queue else None
queue_is_empty = lambda queue: len(queue) == 0
stack_to_list_reversed = lambda stack: stack[::-1]
deque_from_list = lambda lst: __import__("collections").deque(lst)
priority_queue_push = lambda pq, item, priority: sorted(pq + [(priority, item)])
priority_queue_pop = lambda pq: pq[1:]
priority_queue_top = lambda pq: pq[0][1] if pq else None
circular_buffer_add = lambda buf, x, size: (buf + [x])[-size:]
stack_max_so_far = lambda stack: max(stack) if stack else None
is_valid_stack_sequence = lambda pushed, popped: not __import__("functools").reduce(lambda st, x: (st + [x]) if not st or st[-1] != x else st[:-1], popped, list(pushed))
queue_from_two_stacks_peek = lambda s1, s2: s2[-1] if s2 else (s1[0] if s1 else None)
stack_sum = lambda stack: sum(stack)
queue_size = lambda queue: len(queue)
stack_contains = lambda stack, x: x in stack
```

## 34. Binary Tree / BST Helpers

```python
tree_min_value = lambda node: node["value"] if not node.get("left") else tree_min_value(node["left"])
tree_max_value = lambda node: node["value"] if not node.get("right") else tree_max_value(node["right"])
tree_height = lambda node: 0 if node is None else 1 + max(tree_height(node.get("left")), tree_height(node.get("right")))
tree_inorder = lambda node: [] if node is None else tree_inorder(node.get("left")) + [node["value"]] + tree_inorder(node.get("right"))
tree_preorder = lambda node: [] if node is None else [node["value"]] + tree_preorder(node.get("left")) + tree_preorder(node.get("right"))
tree_postorder = lambda node: [] if node is None else tree_postorder(node.get("left")) + tree_postorder(node.get("right")) + [node["value"]]
is_bst_valid_inorder = lambda values: values == sorted(values)
tree_count_leaves = lambda node: 0 if node is None else (1 if not node.get("left") and not node.get("right") else tree_count_leaves(node.get("left")) + tree_count_leaves(node.get("right")))
tree_contains = lambda node, val: False if node is None else (True if node["value"] == val else tree_contains(node.get("left") if val < node["value"] else node.get("right"), val))
tree_sum_all = lambda node: 0 if node is None else node["value"] + tree_sum_all(node.get("left")) + tree_sum_all(node.get("right"))
tree_is_height_balanced = lambda node: True if node is None else abs(tree_height(node.get("left")) - tree_height(node.get("right"))) <= 1
build_leaf_node = lambda value: {"value": value, "left": None, "right": None}
tree_mirror = lambda node: None if node is None else {"value": node["value"], "left": tree_mirror(node.get("right")), "right": tree_mirror(node.get("left"))}
tree_node_count = lambda node: 0 if node is None else 1 + tree_node_count(node.get("left")) + tree_node_count(node.get("right"))
tree_find_parent = lambda node, val, parent=None: parent if (node is None or node["value"] == val) else tree_find_parent(node.get("left") if val < node["value"] else node.get("right"), val, node)
tree_count_full_nodes = lambda node: 0 if node is None else (1 if node.get("left") and node.get("right") else 0) + tree_count_full_nodes(node.get("left")) + tree_count_full_nodes(node.get("right"))
tree_average_value = lambda node: tree_sum_all(node) / len(tree_inorder(node))
is_same_tree = lambda a, b: (a is None and b is None) or (a is not None and b is not None and a["value"] == b["value"] and is_same_tree(a.get("left"), b.get("left")) and is_same_tree(a.get("right"), b.get("right")))
tree_depth_of_value = lambda node, val, depth=0: depth if node and node["value"] == val else (None if node is None else tree_depth_of_value(node.get("left") if val < node["value"] else node.get("right"), val, depth + 1))
is_leaf_node = lambda node: bool(node) and not node.get("left") and not node.get("right")
```

## 35. Linked List Simulations

```python
linked_list_append = lambda ll, x: ll + [x]
linked_list_prepend = lambda ll, x: [x] + ll
linked_list_delete_value = lambda ll, x: [v for v in ll if v != x]
linked_list_reverse = lambda ll: ll[::-1]
linked_list_find = lambda ll, x: ll.index(x) if x in ll else -1
linked_list_middle = lambda ll: ll[len(ll) // 2]
linked_list_nth_from_end = lambda ll, n: ll[-n] if n <= len(ll) else None
linked_list_merge = lambda a, b: a + b
linked_list_remove_duplicates = lambda ll: list(dict.fromkeys(ll))
linked_list_is_palindrome = lambda ll: ll == ll[::-1]
linked_list_rotate = lambda ll, k: ll[k:] + ll[:k]
linked_list_partition_around = lambda ll, x: [v for v in ll if v < x] + [v for v in ll if v >= x]
linked_list_to_number = lambda ll: int("".join(map(str, ll)))
linked_list_intersection = lambda a, b: [x for x in a if x in b]
linked_list_length = lambda ll: len(ll)
linked_list_swap_ends = lambda ll: [ll[-1]] + ll[1:-1] + [ll[0]] if len(ll) > 1 else ll
linked_list_insert_at = lambda ll, i, x: ll[:i] + [x] + ll[i:]
linked_list_remove_at = lambda ll, i: ll[:i] + ll[i + 1:]
```

## 36. Cryptography & Security Extras

```python
is_valid_bcrypt_format = lambda s: bool(__import__("re").match(r"^\$2[aby]\$\d{2}\$", s))
constant_time_compare = lambda a, b: len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 0
generate_salt = lambda n=16: __import__("secrets").token_hex(n)
simple_vigenere_encode = lambda s, key: "".join(chr((ord(c) - 65 + ord(key[i % len(key)].upper()) - 65) % 26 + 65) if c.isalpha() else c for i, c in enumerate(s.upper()))
is_valid_jwt_format = lambda token: len(token.split(".")) == 3
password_entropy_bits_approx = lambda pwd: len(pwd) * __import__("math").log2(len(set(pwd)) or 1)
is_common_password = lambda pwd, common_list: pwd.lower() in common_list
mask_credit_card = lambda cc: "*" * (len(cc) - 4) + cc[-4:]
generate_otp = lambda n=6: "".join(__import__("random").choices("0123456789", k=n))
is_valid_api_key_format = lambda key: bool(__import__("re").match(r"^[A-Za-z0-9_\-]{20,}$", key))
base32_encode = lambda s: __import__("base64").b32encode(s.encode()).decode()
base32_decode = lambda s: __import__("base64").b32decode(s.encode()).decode()
random_bytes_hex = lambda n=16: __import__("secrets").token_bytes(n).hex()
is_valid_pin = lambda pin: pin.isdigit() and len(pin) in (4, 6)
xor_two_hex_strings = lambda a, b: format(int(a, 16) ^ int(b, 16), "x")
simple_hash_rolling = lambda s, base=31, mod=10**9 + 7: __import__("functools").reduce(lambda h, c: (h * base + ord(c)) % mod, s, 0)
is_strong_password_v2 = lambda s: len(s) >= 10 and any(c.islower() for c in s) and any(c.isupper() for c in s) and any(c.isdigit() for c in s) and any(not c.isalnum() for c in s)
token_expired = lambda issued_ts, ttl_seconds: __import__("time").time() > issued_ts + ttl_seconds
redact_string_middle = lambda s: s[0] + "*" * (len(s) - 2) + s[-1] if len(s) > 2 else "*" * len(s)
is_valid_luhn_generic = lambda digits: sum(int(d) if i % 2 == 0 else (int(d) * 2 - 9 if int(d) * 2 > 9 else int(d) * 2) for i, d in enumerate(digits[::-1])) % 10 == 0
```

## 37. Machine Learning Basics

```python
sigmoid = lambda x: 1 / (1 + __import__("math").exp(-x))
relu = lambda x: max(0, x)
leaky_relu = lambda x, alpha=0.01: x if x > 0 else alpha * x
tanh_activation = lambda x: __import__("math").tanh(x)
softmax = lambda xs: [__import__("math").exp(x) / sum(__import__("math").exp(v) for v in xs) for x in xs]
mean_squared_error = lambda y_true, y_pred: sum((a - b) ** 2 for a, b in zip(y_true, y_pred)) / len(y_true)
mean_absolute_error = lambda y_true, y_pred: sum(abs(a - b) for a, b in zip(y_true, y_pred)) / len(y_true)
accuracy_score = lambda y_true, y_pred: sum(a == b for a, b in zip(y_true, y_pred)) / len(y_true)
min_max_scale = lambda lst: [(x - min(lst)) / (max(lst) - min(lst)) for x in lst]
one_hot_encode = lambda categories, value: [1 if c == value else 0 for c in categories]
dot_product_vectors = lambda a, b: sum(x * y for x, y in zip(a, b))
cosine_similarity = lambda a, b: sum(x * y for x, y in zip(a, b)) / ((sum(x ** 2 for x in a) ** 0.5) * (sum(y ** 2 for y in b) ** 0.5))
euclidean_distance = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5
manhattan_distance = lambda a, b: sum(abs(x - y) for x, y in zip(a, b))
step_activation = lambda x: 1 if x >= 0 else 0
linear_regression_predict = lambda x, m, b: m * x + b
gradient_step = lambda w, grad, lr: w - lr * grad
binary_cross_entropy = lambda y, p: -(y * __import__("math").log(p) + (1 - y) * __import__("math").log(1 - p))
confusion_matrix_accuracy = lambda tp, tn, fp, fn: (tp + tn) / (tp + tn + fp + fn)
precision_score = lambda tp, fp: tp / (tp + fp) if (tp + fp) else 0
recall_score = lambda tp, fn: tp / (tp + fn) if (tp + fn) else 0
f1_score = lambda precision, recall: 2 * precision * recall / (precision + recall) if (precision + recall) else 0
softplus_activation = lambda x: __import__("math").log(1 + __import__("math").exp(x))
```

## 38. Image / Pixel Processing

```python
pixel_grayscale = lambda p: int(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2])
image_flip_horizontal = lambda img: [row[::-1] for row in img]
image_flip_vertical = lambda img: img[::-1]
image_invert = lambda img: [[(255 - r, 255 - g, 255 - b) for (r, g, b) in row] for row in img]
image_brightness_avg = lambda img: sum(sum(sum(p) for p in row) for row in img) / (len(img) * len(img[0]) * 3)
image_to_grayscale = lambda img: [[pixel_grayscale(p) for p in row] for row in img]
image_crop = lambda img, x1, y1, x2, y2: [row[x1:x2] for row in img[y1:y2]]
image_downsample_half = lambda img: [row[::2] for row in img[::2]]
image_threshold_bw = lambda gray_img, t: [[255 if px > t else 0 for px in row] for row in gray_img]
pixel_blend_alpha = lambda p1, p2, alpha: tuple(int(a * alpha + b * (1 - alpha)) for a, b in zip(p1, p2))
image_rotate_90_pixels = lambda img: [list(row) for row in zip(*img[::-1])]
image_pixel_count = lambda img: len(img) * len(img[0])
image_average_color = lambda img: tuple(int(sum(p[i] for row in img for p in row) / (len(img) * len(img[0]))) for i in range(3))
is_grayscale_pixel = lambda p: p[0] == p[1] == p[2]
contrast_stretch_pixel = lambda v, lo, hi: int((v - lo) / (hi - lo) * 255) if hi != lo else v
image_channel_extract = lambda img, ch: [[p[ch] for p in row] for row in img]
image_pixel_diff = lambda img1, img2: [[tuple(abs(a - b) for a, b in zip(p1, p2)) for p1, p2 in zip(r1, r2)] for r1, r2 in zip(img1, img2)]
gamma_correct_pixel = lambda v, gamma=2.2: int(255 * (v / 255) ** (1 / gamma))
```

## 39. Audio / Signal Basics

```python
amplitude_to_db = lambda amp, ref=1.0: 20 * __import__("math").log10(amp / ref) if amp > 0 else float("-inf")
db_to_amplitude = lambda db, ref=1.0: ref * 10 ** (db / 20)
sample_rate_to_period = lambda sr: 1 / sr
frequency_to_period = lambda f: 1 / f
midi_note_to_frequency = lambda n: 440 * 2 ** ((n - 69) / 12)
normalize_signal = lambda signal: [x / max(abs(v) for v in signal) for x in signal]
signal_rms = lambda signal: (sum(x ** 2 for x in signal) / len(signal)) ** 0.5
clip_signal = lambda signal, lo, hi: [max(lo, min(x, hi)) for x in signal]
mix_two_signals = lambda a, b: [x + y for x, y in zip(a, b)]
generate_sine_wave = lambda freq, duration, sr: [__import__("math").sin(2 * __import__("math").pi * freq * t / sr) for t in range(int(duration * sr))]
moving_average_filter = lambda signal, w: [sum(signal[i:i + w]) / w for i in range(len(signal) - w + 1)]
zero_crossing_count = lambda signal: sum(1 for i in range(1, len(signal)) if signal[i - 1] * signal[i] < 0)
signal_peak_amplitude = lambda signal: max(abs(x) for x in signal)
bpm_to_seconds_per_beat = lambda bpm: 60 / bpm
semitone_ratio = lambda n: 2 ** (n / 12)
```

## 40. Calendar & Scheduling

```python
is_business_day = lambda d: d.weekday() < 5
week_number_of_year = lambda d: d.isocalendar()[1]
days_until = lambda target_date: (target_date - __import__("datetime").date.today()).days
is_overlapping_ranges = lambda s1, e1, s2, e2: s1 < e2 and s2 < e1
time_slot_duration_minutes = lambda start, end: (end - start).seconds // 60
is_same_week = lambda d1, d2: d1.isocalendar()[1] == d2.isocalendar()[1] and d1.year == d2.year
schedule_conflict_check = lambda events, new_start, new_end: any(s < new_end and new_start < e for s, e in events)
format_meeting_time_range = lambda start, end: f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}"
is_holiday_in_list = lambda d, holidays: d in holidays
get_month_name = lambda m: __import__("calendar").month_name[m]
get_day_of_year = lambda d: d.timetuple().tm_yday
remaining_days_in_year = lambda d: 365 - d.timetuple().tm_yday
is_end_of_month = lambda d: (d + __import__("datetime").timedelta(days=1)).day == 1
time_to_minutes_since_midnight = lambda t: t.hour * 60 + t.minute
minutes_to_time_string = lambda mins: f"{mins // 60:02d}:{mins % 60:02d}"
is_first_day_of_month = lambda d: d.day == 1
seconds_until_next_hour = lambda now: 3600 - (now.minute * 60 + now.second)
```

## 41. E-commerce / Inventory

```python
total_cart_price = lambda items: sum(i["price"] * i["qty"] for i in items)
apply_coupon_discount = lambda total, pct: total * (1 - pct / 100)
is_in_stock = lambda inventory, sku: inventory.get(sku, 0) > 0
low_stock_items = lambda inventory, threshold: [sku for sku, qty in inventory.items() if qty < threshold]
calculate_shipping_cost = lambda weight, rate_per_kg: weight * rate_per_kg
total_with_tax = lambda subtotal, tax_rate: subtotal * (1 + tax_rate / 100)
bulk_discount_price = lambda price, qty, threshold, discount_pct: price * qty * (1 - discount_pct / 100) if qty >= threshold else price * qty
average_order_value = lambda orders: sum(orders) / len(orders)
restock_amount_needed = lambda current, target: max(0, target - current)
sku_from_name = lambda name: name.upper().replace(" ", "-")[:10]
cart_item_count = lambda items: sum(i["qty"] for i in items)
is_free_shipping_eligible = lambda total, threshold=50: total >= threshold
apply_flat_discount = lambda total, amount: max(0, total - amount)
inventory_turnover_ratio = lambda cogs, avg_inventory: cogs / avg_inventory
best_selling_item = lambda sales: max(sales, key=sales.get)
price_after_multiple_discounts = lambda price, discounts: __import__("functools").reduce(lambda p, d: p * (1 - d / 100), discounts, price)
gross_profit = lambda revenue, cogs: revenue - cogs
reorder_point = lambda avg_daily_usage, lead_time_days: avg_daily_usage * lead_time_days
```

## 42. Physics Extended

```python
kinematics_final_velocity = lambda u, a, t: u + a * t
kinematics_displacement = lambda u, a, t: u * t + 0.5 * a * t ** 2
projectile_range = lambda v, angle_deg, g=9.81: (v ** 2 * __import__("math").sin(2 * __import__("math").radians(angle_deg))) / g
projectile_max_height = lambda v, angle_deg, g=9.81: (v * __import__("math").sin(__import__("math").radians(angle_deg))) ** 2 / (2 * g)
centripetal_force = lambda m, v, r: m * v ** 2 / r
torque = lambda force, distance: force * distance
wave_speed = lambda freq, wavelength: freq * wavelength
doppler_shift_approx = lambda f_source, v_source, v_sound=343: f_source * v_sound / (v_sound - v_source)
relativistic_time_dilation = lambda t0, v, c=3e8: t0 / (1 - (v / c) ** 2) ** 0.5
half_life_remaining = lambda n0, t, half_life: n0 * 0.5 ** (t / half_life)
specific_heat_energy = lambda mass, specific_heat, delta_t: mass * specific_heat * delta_t
resistors_in_series = lambda *rs: sum(rs)
resistors_in_parallel = lambda *rs: 1 / sum(1 / r for r in rs)
capacitance_energy = lambda c, v: 0.5 * c * v ** 2
gravitational_pe = lambda m, h, g=9.81: m * g * h
buoyant_force = lambda fluid_density, volume, g=9.81: fluid_density * volume * g
```

## 43. Chemistry Basics

```python
moles_to_mass = lambda moles, molar_mass: moles * molar_mass
mass_to_moles = lambda mass, molar_mass: mass / molar_mass
molarity = lambda moles, volume_liters: moles / volume_liters
ph_from_h_concentration = lambda h_conc: -__import__("math").log10(h_conc)
h_concentration_from_ph = lambda ph: 10 ** (-ph)
ideal_gas_pressure = lambda n, r, t, v: n * r * t / v
celsius_to_kelvin = lambda c: c + 273.15
kelvin_to_celsius_chem = lambda k: k - 273.15
dilution_c1v1_c2 = lambda c1, v1, v2: c1 * v1 / v2
percent_yield = lambda actual, theoretical: (actual / theoretical) * 100
avogadro_particles = lambda moles, na=6.022e23: moles * na
is_acidic_ph = lambda ph: ph < 7
is_basic_ph = lambda ph: ph > 7
empirical_formula_ratio = lambda counts: {k: v / min(counts.values()) for k, v in counts.items()}
molar_concentration_after_dilution = lambda c1, v1, v_final: c1 * v1 / v_final
```

## 44. Biology & Genetics

```python
gc_content = lambda dna: (dna.upper().count("G") + dna.upper().count("C")) / len(dna) * 100
dna_complement = lambda dna: dna.upper().translate(str.maketrans("ACGT", "TGCA"))
dna_reverse_complement = lambda dna: dna.upper().translate(str.maketrans("ACGT", "TGCA"))[::-1]
transcribe_dna_to_rna = lambda dna: dna.upper().replace("T", "U")
count_nucleotides = lambda dna: {n: dna.upper().count(n) for n in "ACGT"}
hamming_distance_dna = lambda a, b: sum(x != y for x, y in zip(a, b))
is_valid_dna_sequence = lambda s: set(s.upper()) <= set("ACGT")
bmi_calculate = lambda weight_kg, height_m: weight_kg / height_m ** 2
bmi_category = lambda bmi: "Underweight" if bmi < 18.5 else "Normal" if bmi < 25 else "Overweight" if bmi < 30 else "Obese"
heart_rate_max_estimate = lambda age: 220 - age
target_heart_rate_zone = lambda age, pct: (220 - age) * pct
calories_burned_walking = lambda weight_kg, km: weight_kg * km * 0.53
bmr_mifflin_male = lambda weight_kg, height_cm, age: 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
bmr_mifflin_female = lambda weight_kg, height_cm, age: 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
is_palindromic_dna = lambda dna: dna.upper() == dna.upper().translate(str.maketrans("ACGT", "TGCA"))[::-1]
```

## 45. Geography & Maps

```python
haversine_distance_km = lambda lat1, lon1, lat2, lon2: 6371 * 2 * __import__("math").asin((__import__("math").sin(__import__("math").radians(lat2 - lat1) / 2) ** 2 + __import__("math").cos(__import__("math").radians(lat1)) * __import__("math").cos(__import__("math").radians(lat2)) * __import__("math").sin(__import__("math").radians(lon2 - lon1) / 2) ** 2) ** 0.5)
is_valid_latitude = lambda lat: -90 <= lat <= 90
is_valid_longitude = lambda lon: -180 <= lon <= 180
timezone_offset_hours = lambda utc_offset_str: int(utc_offset_str.replace("UTC", "") or 0)
is_northern_hemisphere = lambda lat: lat > 0
is_within_bounding_box = lambda lat, lon, min_lat, max_lat, min_lon, max_lon: min_lat <= lat <= max_lat and min_lon <= lon <= max_lon
km_to_nautical_miles = lambda km: km * 0.539957
nautical_miles_to_km = lambda nm: nm / 0.539957
utm_zone_from_longitude = lambda lon: int((lon + 180) / 6) + 1
elevation_grade_percent = lambda rise, run: (rise / run) * 100
compass_direction_from_bearing = lambda bearing: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int((bearing % 360) / 45 + 0.5) % 8]
distance_to_horizon_km = lambda height_m: 3.57 * height_m ** 0.5
is_coordinate_pair_valid = lambda lat, lon: -90 <= lat <= 90 and -180 <= lon <= 180
degrees_to_dms_string = lambda deg: f"{int(deg)}°{int((deg - int(deg)) * 60)}'{((deg - int(deg)) * 60 - int((deg - int(deg)) * 60)) * 60:.1f}\""
```

## 46. Sports Statistics

```python
batting_average = lambda hits, at_bats: hits / at_bats if at_bats else 0
field_goal_percentage = lambda made, attempted: made / attempted * 100 if attempted else 0
win_loss_ratio = lambda wins, losses: wins / losses if losses else float("inf")
points_per_game = lambda total_points, games: total_points / games
run_rate_cricket = lambda runs, overs: runs / overs
required_run_rate = lambda runs_needed, overs_left: runs_needed / overs_left if overs_left else float("inf")
era_baseball = lambda earned_runs, innings_pitched: (earned_runs / innings_pitched) * 9 if innings_pitched else 0
free_throw_percentage = lambda made, attempted: made / attempted * 100 if attempted else 0
goal_difference = lambda scored, conceded: scored - conceded
league_points_from_record = lambda wins, draws, losses: wins * 3 + draws
strike_rate_cricket = lambda runs, balls: (runs / balls) * 100 if balls else 0
plus_minus_stat = lambda points_for, points_against: points_for - points_against
completion_percentage_football = lambda completions, attempts: completions / attempts * 100 if attempts else 0
average_speed_race = lambda distance_km, time_hours: distance_km / time_hours
is_hat_trick = lambda goals: goals >= 3
```

## 47. Weather Calculations

```python
wind_chill_approx = lambda temp_f, wind_mph: 35.74 + 0.6215 * temp_f - 35.75 * wind_mph ** 0.16 + 0.4275 * temp_f * wind_mph ** 0.16
dew_point_approx = lambda temp_c, humidity: temp_c - ((100 - humidity) / 5)
is_freezing = lambda temp_c: temp_c <= 0
uv_index_risk_level = lambda uv: "Low" if uv <= 2 else "Moderate" if uv <= 5 else "High" if uv <= 7 else "Very High" if uv <= 10 else "Extreme"
rainfall_mm_to_inches = lambda mm: mm / 25.4
is_storm_warning = lambda wind_speed_kmh: wind_speed_kmh > 88
barometric_trend = lambda p1, p2: "Rising" if p2 > p1 else "Falling" if p2 < p1 else "Steady"
air_quality_category = lambda aqi: "Good" if aqi <= 50 else "Moderate" if aqi <= 100 else "Unhealthy for Sensitive" if aqi <= 150 else "Unhealthy" if aqi <= 200 else "Hazardous"
visibility_km_to_miles = lambda km: km * 0.621371
is_humid = lambda humidity_pct: humidity_pct > 60
temperature_trend = lambda temps: "Warming" if temps[-1] > temps[0] else "Cooling" if temps[-1] < temps[0] else "Stable"
feels_like_simple = lambda temp_c, humidity, wind_kmh: temp_c + (0.05 * humidity) - (0.1 * wind_kmh)
```

## 48. Language / NLP Basics

```python
tokenize_words = lambda s: s.split()
bag_of_words = lambda s: {w: s.split().count(w) for w in set(s.split())}
ngrams = lambda tokens, n: [tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]
remove_stopwords = lambda tokens, stopwords: [w for w in tokens if w.lower() not in stopwords]
term_frequency = lambda word, doc: doc.split().count(word) / len(doc.split())
inverse_document_frequency = lambda word, docs: __import__("math").log(len(docs) / sum(1 for d in docs if word in d.split()))
jaccard_text_similarity = lambda a, b: len(set(a.split()) & set(b.split())) / len(set(a.split()) | set(b.split()))
simple_stemmer_suffix_strip = lambda word: word[:-3] if word.endswith("ing") else word[:-2] if word.endswith("ed") else word
char_ngrams = lambda s, n: [s[i:i + n] for i in range(len(s) - n + 1)]
capitalize_first_letter_only = lambda s: s[0].upper() + s[1:] if s else s
word_overlap_count = lambda a, b: len(set(a.split()) & set(b.split()))
is_stopword = lambda word, stopwords: word.lower() in stopwords
token_length_stats = lambda tokens: (min(map(len, tokens)), max(map(len, tokens)), sum(map(len, tokens)) / len(tokens))
sentiment_word_score = lambda text, positive_words, negative_words: sum(1 for w in text.lower().split() if w in positive_words) - sum(1 for w in text.lower().split() if w in negative_words)
pluralize_simple = lambda word: word[:-1] + "ies" if word.endswith("y") else word + "es" if word.endswith(("s", "x", "z", "ch", "sh")) else word + "s"
```

## 49. Form Validation Extras

```python
is_valid_zipcode_us = lambda z: bool(__import__("re").match(r"^\d{5}(-\d{4})?$", z))
is_valid_postal_code_ca = lambda p: bool(__import__("re").match(r"^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$", p))
is_valid_ssn_format = lambda s: bool(__import__("re").match(r"^\d{3}-\d{2}-\d{4}$", s))
is_valid_credit_card_format = lambda s: bool(__import__("re").match(r"^\d{4}-?\d{4}-?\d{4}-?\d{4}$", s))
is_non_empty_trimmed = lambda s: bool(s.strip())
is_valid_age = lambda age: isinstance(age, int) and 0 <= age <= 130
is_valid_currency_amount = lambda s: bool(__import__("re").match(r"^\d+(\.\d{2})?$", s))
is_matching_confirmation = lambda a, b: a == b
is_valid_username_length = lambda s: 3 <= len(s) <= 20
is_valid_slug = lambda s: bool(__import__("re").match(r"^[a-z0-9]+(-[a-z0-9]+)*$", s))
is_valid_hex_token = lambda s: bool(__import__("re").match(r"^[0-9a-fA-F]+$", s))
is_valid_time_format_24h = lambda s: bool(__import__("re").match(r"^([01]\d|2[0-3]):[0-5]\d$", s))
is_within_length_bounds = lambda s, min_len, max_len: min_len <= len(s) <= max_len
is_valid_domain_name = lambda s: bool(__import__("re").match(r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$", s))
required_fields_present = lambda data, fields: all(f in data and data[f] for f in fields)
is_valid_country_code = lambda code: bool(__import__("re").match(r"^[A-Z]{2}$", code))
sanitize_input_basic = lambda s: __import__("re").sub(r"[<>\"'&]", "", s)
```

## 50. Everyday Life Calculators

```python
tip_split_per_person = lambda bill, tip_pct, people: (bill * (1 + tip_pct / 100)) / people
gas_cost_for_trip = lambda distance_km, efficiency_km_per_l, price_per_l: (distance_km / efficiency_km_per_l) * price_per_l
time_to_read_book = lambda word_count, wpm=200: word_count / wpm
recipe_scale_factor = lambda original_servings, desired_servings: desired_servings / original_servings
paint_needed_liters = lambda wall_area_m2, coverage_per_liter=10: wall_area_m2 / coverage_per_liter
commute_time_saved = lambda old_minutes, new_minutes: old_minutes - new_minutes
battery_life_remaining_pct = lambda current_mah, full_mah: current_mah / full_mah * 100
water_intake_recommended_liters = lambda weight_kg: weight_kg * 0.033
steps_to_km = lambda steps, stride_m=0.75: steps * stride_m / 1000
calories_from_macros = lambda protein_g, carbs_g, fat_g: protein_g * 4 + carbs_g * 4 + fat_g * 9
sleep_hours_needed = lambda age: 9 if age < 13 else 8.5 if age < 18 else 8
screen_time_daily_avg = lambda weekly_minutes: weekly_minutes / 7
laundry_loads_needed = lambda items, capacity_per_load=15: -(-items // capacity_per_load)
grocery_budget_per_meal = lambda budget, meals: budget / meals
mortgage_monthly_payment = lambda principal, annual_rate, years: (principal * (annual_rate / 1200)) / (1 - (1 + annual_rate / 1200) ** (-years * 12)) if annual_rate else principal / (years * 12)
car_depreciation_value = lambda price, rate_pct, years: price * (1 - rate_pct / 100) ** years
electricity_cost = lambda kwh_used, price_per_kwh: kwh_used * price_per_kwh
minutes_to_next_appointment = lambda now, appointment: (appointment - now).seconds // 60
is_overdue_bill = lambda due_date, today: today > due_date
average_commute_cost_monthly = lambda daily_cost, work_days=22: daily_cost * work_days
plant_watering_frequency_days = lambda soil_moisture_pct: 7 if soil_moisture_pct > 60 else 3 if soil_moisture_pct > 30 else 1
leftovers_safe_to_eat = lambda stored_date, today: (today - stored_date).days <= 4
how_many_pizzas_needed = lambda people, slices_per_person=3, slices_per_pizza=8: -(-(people * slices_per_person) // slices_per_pizza)
age_in_days = lambda birth_date, today: (today - birth_date).days
hourly_wage_from_salary = lambda annual_salary, hours_per_week=40: annual_salary / (hours_per_week * 52)
```

## 51. Grab-Bag Utilities

```python
swap_variables = lambda a, b: (b, a)
clamp_angle_degrees = lambda deg: deg % 360
list_of_dicts_pluck = lambda lst, key: [d[key] for d in lst]
dict_list_group_by = lambda lst, key: __import__("functools").reduce(lambda acc, d: (acc.setdefault(d[key], []).append(d), acc)[1], lst, {})
safe_divide = lambda a, b: a / b if b != 0 else None
clamp_index = lambda i, length: max(0, min(i, length - 1))
is_valid_index = lambda lst, i: 0 <= i < len(lst)
list_batch_average = lambda lst, batch_size: [sum(lst[i:i + batch_size]) / len(lst[i:i + batch_size]) for i in range(0, len(lst), batch_size)]
random_emoji_face = lambda: __import__("random").choice(["😀", "😎", "🤔", "😴", "🥳"])
text_progress_bar = lambda pct, width=20: "[" + "#" * int(width * pct / 100) + "-" * (width - int(width * pct / 100)) + f"] {pct}%"
is_valid_semver = lambda v: bool(__import__("re").match(r"^\d+\.\d+\.\d+$", v))
version_compare_gt = lambda v1, v2: tuple(map(int, v1.split("."))) > tuple(map(int, v2.split(".")))
retry_count_from_attempts = lambda max_attempts, attempt: max_attempts - attempt
exponential_backoff_delay = lambda attempt, base=1: base * (2 ** attempt)
human_readable_duration = lambda seconds: f"{seconds // 3600}h {(seconds % 3600) // 60}m {seconds % 60}s"
list_rotate_to_start_at = lambda lst, value: lst[lst.index(value):] + lst[:lst.index(value)] if value in lst else lst
count_words_over_length = lambda s, n: sum(1 for w in s.split() if len(w) > n)
flatten_and_dedupe = lambda lst: list(dict.fromkeys(x for sub in lst for x in sub))
list_all_indexes_of = lambda lst, x: [i for i, v in enumerate(lst) if v == x]
clamp_string_length = lambda s, max_len: s[:max_len]
safe_get_nested_list = lambda lst, indices: __import__("functools").reduce(lambda acc, i: acc[i] if acc and i < len(acc) else None, indices, lst)
random_greeting = lambda: __import__("random").choice(["Hello!", "Hi there!", "Hey!", "Greetings!"])
is_valid_time_zone_offset = lambda offset: -12 <= offset <= 14
percent_change = lambda old, new: ((new - old) / old) * 100 if old else float("inf")
```

---

## 52. Bonus Round

```python
is_valid_hex_number = lambda s: bool(__import__("re").match(r"^[0-9a-fA-F]+$", s))
list_pad_to_length = lambda lst, n, fill=None: lst + [fill] * (n - len(lst)) if len(lst) < n else lst
dict_deep_copy = lambda d: __import__("copy").deepcopy(d)
seconds_since_epoch_to_iso = lambda ts: __import__("datetime").datetime.fromtimestamp(ts).isoformat()
is_valid_roman_numeral = lambda s: bool(__import__("re").match(r"^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$", s.upper()))
roman_to_int_value_lookup = lambda c: {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}.get(c.upper(), 0)
list_average_excluding_outliers = lambda lst: sum(x for x in lst if abs(x - sum(lst)/len(lst)) < 2 * (sum((v - sum(lst)/len(lst))**2 for v in lst)/len(lst))**0.5) / len([x for x in lst if abs(x - sum(lst)/len(lst)) < 2 * (sum((v - sum(lst)/len(lst))**2 for v in lst)/len(lst))**0.5])
is_valid_binary_number = lambda s: set(s) <= {"0", "1"} and len(s) > 0
temperature_to_emoji = lambda c: "🥵" if c > 30 else "😎" if c > 20 else "🧥" if c > 10 else "🥶"
list_to_set_preserving_type = lambda lst: type(lst)(dict.fromkeys(lst))
word_is_palindrome_phrase = lambda s: (lambda c=__import__("re").sub(r"\s+", "", s.lower()): c == c[::-1])()
random_dice_pair = lambda: (__import__("random").randint(1, 6), __import__("random").randint(1, 6))
list_to_tuple = lambda lst: tuple(lst)
tuple_to_list = lambda tup: list(tup)
is_valid_email_domain = lambda email, domain: email.lower().endswith(f"@{domain.lower()}")
first_n_fibonacci = lambda n: __import__("functools").reduce(lambda acc, _: acc + [acc[-1] + acc[-2]], range(n - 2), [0, 1])[:n]
average_of_dict_values_rounded = lambda d, ndigits=2: round(sum(d.values()) / len(d), ndigits)
list_has_consecutive_duplicates = lambda lst: any(lst[i] == lst[i+1] for i in range(len(lst)-1))
string_starts_and_ends_same = lambda s: s[0] == s[-1] if s else False
percent_of_total = lambda part, total: (part / total) * 100 if total else 0
list_second_smallest = lambda lst: sorted(set(lst))[1]
is_valid_percentage_value = lambda x: 0 <= x <= 100
random_password_with_symbols = lambda n: "".join(__import__("random").choices(__import__("string").ascii_letters + __import__("string").digits + "!@#$%^&*", k=n))
```

---

### Notes
- `__import__(...)` is used inline so each function stays a true single-line `lambda` without a separate `import` statement above it.
- Recursive lambdas (`factorial`, `gcd`, `fibonacci_n`, `quicksort`, `digital_root`, `flatten_deep`, tree/graph helpers) work because they call themselves **by the name they're assigned to** — a truly anonymous lambda can't do this.
- A handful of functions (`is_coprime`, `is_twin_prime`, `sum_of_prime_factors`, `caesar_cipher_decode`) call other functions defined earlier in this file (`gcd`, `is_prime`, `prime_factors`, `caesar_cipher_encode`) — keep those definitions above them if you copy snippets out of order.
- Lambdas can't contain `try/except`, so functions that parse untrusted input (JSON, ints, etc.) will raise on bad input rather than silently returning `False`/`None` — wrap them in `try/except` yourself for production use.
- These are quick-reference one-liners, not a style guide — for real projects, prefer readable `def` functions over deeply nested one-liners.

**Total: 1020 one-line functions across 52 categories.**
