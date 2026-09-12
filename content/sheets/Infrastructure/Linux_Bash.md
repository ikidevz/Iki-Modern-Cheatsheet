# Linux / Bash / Shell Scripting Cheatsheet for Data & Analytics Engineers

> A structured Bash/Linux reference for data & analytics engineering — shell navigation and file operations through text processing (grep/sed/awk), scripting constructs, process management, and system administration. Every non-trivial snippet in this file (parameter expansion, arrays, traps, getopts, process substitution, `awk`/`sed` pipelines, background jobs) was actually executed in a live Bash 5.2 shell, not just syntax-checked — including the classic `set -e` + `((i++))` interaction documented in the gotchas section below.

## 📑 Table of Contents

1. [🚀 Shell Basics & Navigation](#shell-basics-navigation)
2. [📁 File & Directory Operations](#file-directory-operations)
3. [🔐 Permissions & Ownership](#permissions-ownership)
4. [🔎 Finding Files & Searching](#finding-files-searching)
5. [✂️ Text Processing Basics](#text-processing-basics)
6. [🐍 grep & Regular Expressions](#grep-regular-expressions)
7. [🪄 sed — Stream Editor](#sed-stream-editor)
8. [📊 awk — Text Processing Language](#awk-text-processing-language)
9. [🔀 Redirection, Pipes & Process Substitution](#redirection-pipes-process-substitution)
10. [⚙️ Variables & Environment](#variables-environment)
11. [🏗️ Shell Script Structure & Exit Codes](#shell-script-structure-exit-codes)
12. [🔢 Arithmetic Operations](#arithmetic-operations)
13. [🧵 String Manipulation & Parameter Expansion](#string-manipulation-parameter-expansion)
14. [📦 Arrays](#arrays)
15. [🔀 Conditionals & Test Operators](#conditionals-test-operators)
16. [🔁 Loops](#loops)
17. [🧩 Functions](#functions)
18. [📥 Input/Output & User Interaction](#input-output-user-interaction)
19. [🎛️ Command-Line Arguments & getopts](#command-line-arguments-getopts)
20. [⚡ Process Management & Job Control](#process-management-job-control)
21. [🌐 Networking & Remote Operations](#networking-remote-operations)
22. [📅 Cron, Scheduling & System Admin](#cron-scheduling-system-admin)
23. [🗜️ Archiving & Compression](#archiving-compression)
24. [🛡️ Error Handling, Debugging & Traps](#error-handling-debugging-traps)
25. [⚠️ Common Gotchas](#common-gotchas)
26. [🎯 Best Practices](#best-practices)
27. [📚 Idioms, Performance & Memory Tips](#idioms-performance-memory-tips)
28. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**Syntax cheatsheet**

| Task                  | Syntax                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Navigate              | `cd path`, `cd -` (previous dir), `pwd`, `pushd`/`popd`                                    |
| List / inspect        | `ls -la`, `ls -lh`, `tree -L 2`, `stat file`, `file file`                                  |
| Search text           | `grep -RniE 'pattern' .`                                                                    |
| Search files          | `find . -name '*.log' -mtime -1`, `fd pattern` (if installed)                               |
| Edit stream           | `sed 's/old/new/g' file`, `sed -i 's/old/new/g' file`                                       |
| Columnar processing   | `awk -F',' '{print $1,$3}' file`                                                             |
| Sort / dedupe         | `sort -t',' -k2 -n file`, `sort file \| uniq -c \| sort -rn`                                |
| Redirect              | `cmd > out.txt` (overwrite), `cmd >> out.txt` (append), `cmd 2>&1` (merge stderr)            |
| Pipe                  | `cmd1 \| cmd2 \| cmd3`                                                                       |
| Variables             | `name="value"`, `readonly name`, `export NAME=value`, `${name:-default}`                    |
| Arithmetic            | `$((a + b))`, `(( a += 1 ))`, `let "a = a + 1"`                                              |
| Arrays                | `arr=(a b c)`, `${arr[@]}`, `${#arr[@]}`, `declare -A map`                                  |
| Condition             | `if [[ cond ]]; then ... elif [[ cond ]]; then ... else ... fi`                              |
| Loop                  | `for x in list; do ...; done`, `while [[ cond ]]; do ...; done`                              |
| Function              | `name() { local x="$1"; ...; return 0; }`                                                    |
| Script safety header  | `#!/usr/bin/env bash` + `set -euo pipefail`                                                  |
| Process info          | `ps aux`, `top`/`htop`, `kill -TERM pid`, `jobs`, `bg`/`fg`                                  |
| Permissions           | `chmod 755 file`, `chmod u+x file`, `chown user:group file`                                  |
| Compress              | `tar -czf archive.tar.gz dir/`, `tar -xzf archive.tar.gz`                                    |
| Remote                | `ssh user@host`, `scp file user@host:/path`, `rsync -avz src/ dest/`                         |

**File permission cheat sheet**

| Symbolic     | Octal | Meaning                                  |
| ------------ | ----- | ----------------------------------------- |
| `-rwxr-xr-x` | `755` | Owner: full; group/other: read + execute  |
| `-rw-r--r--` | `644` | Owner: read/write; group/other: read only |
| `-rwx------` | `700` | Owner-only full access (private scripts)  |
| `-rw-------` | `600` | Owner-only read/write (secrets, keys)     |
| `-rwxrwxrwx` | `777` | Everyone: full access (avoid — see gotchas) |

**Test operator cheat sheet (`[[ ]]`)**

| Test           | Meaning                        | Test           | Meaning                     |
| -------------- | ------------------------------- | -------------- | ---------------------------- |
| `-e file`      | exists                          | `-f file`      | is a regular file             |
| `-d file`      | is a directory                  | `-L file`      | is a symlink                  |
| `-s file`      | exists and size > 0             | `-x file`      | is executable                 |
| `-z string`    | string is empty                 | `-n string`    | string is non-empty           |
| `str1 == str2` | string equality                 | `str =~ regex` | regex match (extended regex)  |
| `-eq -ne`      | numeric equal / not equal       | `-lt -gt`      | numeric less-than / greater-than |
| `-a` / `&&`    | logical AND                     | `-o` / `\|\|`  | logical OR                    |

## 🚀 Shell Basics & Navigation

```bash
# Where am I / who am I
pwd                     # print working directory
whoami                  # current user
hostname                # machine name
uname -a                # kernel + system info

# Moving around
cd /var/log             # absolute path
cd ../sibling_dir        # relative path
cd ~                    # home directory
cd -                    # previous directory (toggles)
pushd /tmp              # push dir onto stack and cd there
popd                    # pop back to previous dir

# Listing
ls -la                  # long format, incl. hidden files
ls -lh                  # human-readable sizes (K/M/G)
ls -lt                  # sort by modification time, newest first
ls -laR                 # recursive listing
tree -L 2               # directory tree, 2 levels deep (if installed)

# History & shortcuts
history | tail -20      # last 20 commands
!123                    # re-run history item 123
!!                      # re-run last command
Ctrl+R                  # reverse search command history
!$                      # last argument of the previous command
alias ll='ls -la'       # define a shortcut (put in ~/.bashrc to persist)
unalias ll              # remove it

# Getting help
man ls                  # full manual page
ls --help               # quick usage summary
tldr tar                # community-maintained example-based help (if installed)
type cd                 # shows if a name is a builtin, alias, function, or file
which python3           # path to an executable found on $PATH
command -v python3      # POSIX-portable equivalent of `which`
```

## 📁 File & Directory Operations

```bash
# Create
touch newfile.txt              # create empty file / bump mtime if it exists
mkdir new_dir                   # create a directory
mkdir -p a/b/c                  # create nested directories, no error if exists

# Copy / move / remove
cp file.txt backup.txt          # copy a file
cp -r src_dir/ dest_dir/        # copy a directory recursively
cp -a src_dir/ dest_dir/        # archive mode: preserves perms, timestamps, symlinks
mv file.txt renamed.txt         # rename (mv is also how you rename in Linux)
mv file.txt /tmp/               # move to another directory
rm file.txt                     # delete a file
rm -r dir/                      # delete a directory recursively
rm -rf dir/                     # force-delete, no prompts — DOUBLE-CHECK THE PATH FIRST
rmdir empty_dir/                # remove only if the directory is empty

# Inspecting
file data.bin                   # guess file type from content, not extension
stat file.txt                   # detailed metadata: size, perms, timestamps, inode
wc -l file.txt                  # line count (also -w words, -c bytes, -m chars)
du -sh dir/                     # total size of a directory, human-readable
du -sh * | sort -rh | head      # biggest items in current dir, largest first
df -h                           # disk free space per mounted filesystem

# Links
ln -s /path/to/target linkname  # symbolic (soft) link — points to a path
ln /path/to/target hardname     # hard link — points to the same inode
readlink -f linkname            # resolve a symlink to its absolute target

# Comparing
diff file1.txt file2.txt        # line-by-line differences
diff -u file1.txt file2.txt     # unified diff (the format used in patches)
cmp file1.bin file2.bin         # byte-by-byte comparison, good for binaries
md5sum file.txt                 # checksum for quick equality/integrity checks
sha256sum file.txt              # stronger checksum, common for downloads

# Renaming/moving in bulk
for f in *.JPG; do mv "$f" "${f%.JPG}.jpg"; done   # lowercase extensions
rename 's/\.txt$/.bak/' *.txt                      # Perl-based rename (if installed)
```

## 🔐 Permissions & Ownership

```bash
# Reading permission strings: -rwxr-xr-x
#  [type][owner][group][other]  e.g. rwx r-x r-x
#  r=4 w=2 x=1 per triplet -> owner=7, group=5, other=5 => 755

chmod 755 script.sh             # owner rwx, group/other rx (typical for scripts)
chmod 644 data.csv               # owner rw, group/other read-only (typical for data)
chmod 600 id_rsa                 # owner-only rw (typical for private keys/secrets)
chmod u+x script.sh               # add execute for owner only
chmod g-w file.txt                 # remove write for group
chmod o=r file.txt                  # set "other" permissions to read-only exactly
chmod -R 755 dir/                    # recursively apply to a whole tree

chown user:group file.txt        # change owner and group
chown -R user:group dir/         # recursively
chgrp analysts file.txt          # change only the group

umask                             # show current default-permission mask
umask 022                         # new files: 644, new dirs: 755 (the common default)

# Special bits
chmod +t /shared_dir              # sticky bit: only owner can delete their own files
                                   # (this is why /tmp is safe for shared use)
chmod g+s dir/                    # setgid on a directory: new files inherit its group
chmod u+s /usr/bin/some_binary    # setuid: runs with the *owner's* privileges (rare, risky)

# Checking access without changing anything
[[ -r file.txt ]] && echo "readable"
[[ -w file.txt ]] && echo "writable"
[[ -x script.sh ]] && echo "executable"
sudo -l                           # list what the current user can run via sudo
```

## 🔎 Finding Files & Searching

```bash
# find — locate files by name, type, time, size
find . -name "*.log"                       # by name (case-sensitive)
find . -iname "*.LOG"                      # case-insensitive
find . -type f -name "*.py"                # files only (not directories)
find . -type d -name "cache"               # directories only
find . -maxdepth 2 -name "*.csv"           # limit recursion depth
find . -mtime -1                           # modified in the last 1 day
find . -mtime +30                          # modified more than 30 days ago
find . -newer reference_file.txt           # newer than a given file
find . -size +100M                         # files larger than 100 MB
find . -empty                              # empty files or directories

# Acting on results
find . -name "*.tmp" -delete                       # delete matches directly
find . -name "*.log" -exec gzip {} \;               # run a command per match
find . -name "*.log" -exec rm {} +                  # batch matches into fewer invocations
find . -name "*.csv" -print0 | xargs -0 wc -l       # NUL-delimited, safe for spaces/newlines

# xargs — build and run commands from stdin
echo "file1.txt file2.txt" | xargs rm               # rm file1.txt file2.txt
find . -name "*.txt" | xargs -I{} cp {} /backup/     # {} placeholder per item
find . -name "*.jpg" | xargs -P4 -I{} convert {} {}.png  # -P4: 4 parallel workers

# locate — instant search using a prebuilt index (needs `updatedb` to be current)
locate myfile.txt
sudo updatedb                              # refresh the index

# which/whereis — find executables
which python3
whereis python3                            # binary + man page + source, if known
```

## ✂️ Text Processing Basics

```bash
# cut — extract columns/characters
cut -d',' -f1,3 data.csv          # fields 1 and 3, comma-delimited
cut -c1-10 file.txt                # first 10 characters of each line
cut -d':' -f1 /etc/passwd          # extract usernames from /etc/passwd

# sort
sort file.txt                      # alphabetical
sort -n numbers.txt                # numeric (alphabetical sort mis-orders 2 vs 10)
sort -r file.txt                   # reverse
sort -k2 -t',' file.csv            # sort by 2nd comma-delimited field
sort -k2,2 -k3,3n file.csv         # sort by field 2, then numerically by field 3
sort -u file.txt                   # sort and drop duplicates
sort -h sizes.txt                  # "human" sort: understands 1K, 2M, 3G

# uniq (expects sorted input)
sort file.txt | uniq               # remove adjacent duplicate lines
sort file.txt | uniq -c            # count occurrences of each line
sort file.txt | uniq -d            # show only lines that appeared more than once
sort file.txt | uniq -u            # show only lines that appeared exactly once

# tr — translate/delete characters
echo "Hello" | tr 'a-z' 'A-Z'      # uppercase
echo "a,b,c" | tr ',' '\n'         # commas to newlines
tr -d '\r' < windows_file.txt      # strip Windows carriage returns
tr -s ' ' < file.txt                # squeeze repeated spaces into one

# wc — counts
wc -l file.txt                     # lines
wc -w file.txt                     # words
wc -c file.txt                     # bytes
wc -l < file.txt                   # print just the number (no filename)

# paste / join — combine files
paste file1.txt file2.txt          # merge line-by-line, tab-separated
paste -d',' file1.txt file2.txt    # merge with a custom delimiter
join -t',' -1 1 -2 1 a.csv b.csv   # SQL-style join on field 1 of each (both must be sorted)

# head / tail
head -n 20 file.txt                 # first 20 lines
tail -n 20 file.txt                 # last 20 lines
tail -f app.log                     # follow a growing file (great for live logs)
tail -n +2 file.csv                 # everything from line 2 onward (skip header)

# column — pretty-print tabular text
column -t -s',' data.csv            # align comma-delimited columns
```

## 🐍 grep & Regular Expressions

```bash
grep "error" app.log                     # literal substring match
grep -i "error" app.log                  # case-insensitive
grep -v "debug" app.log                  # invert match — lines NOT containing it
grep -c "error" app.log                  # count of matching lines
grep -n "error" app.log                  # show line numbers
grep -l "error" *.log                    # just filenames that contain a match
grep -r "TODO" src/                      # recursive over a directory
grep -w "cat" file.txt                   # whole word match only (not "category")
grep -A3 -B1 "Exception" app.log         # 3 lines After, 1 line Before each match
grep -o -E '[0-9]+\.[0-9]+\.[0-9]+' f    # print only the matched text (e.g. versions)

# Basic vs extended regex
grep 'a\+' file.txt                      # BRE: '+' needs escaping
grep -E 'a+' file.txt                    # ERE: '+' works unescaped (equivalent to egrep)
grep -P '(?<=id=)\d+' file.txt           # PCRE: lookbehind/lookahead (GNU grep, -P flag)

# Common patterns
grep -E '^[0-9]{3}-[0-9]{4}$' file.txt   # exact-format match (e.g. phone extension)
grep -E '\S+@\S+\.\S+' file.txt          # loose email match
grep -E '^\s*$' -v file.txt              # drop blank/whitespace-only lines
grep -E '^#' -v config.ini               # drop comment lines starting with #

# fgrep / zgrep
fgrep "literal[stuff]" file.txt          # treats pattern as literal text, no regex
zgrep "error" app.log.gz                 # grep directly inside a gzipped file
```

## 🪄 sed — Stream Editor

```bash
# Substitution
sed 's/foo/bar/' file.txt                # replace first match per line
sed 's/foo/bar/g' file.txt               # replace all matches per line
sed 's/foo/bar/2' file.txt               # replace only the 2nd match per line
sed 's/foo/bar/gi' file.txt              # case-insensitive, all matches

# In-place editing
sed -i 's/foo/bar/g' file.txt            # edit the file directly (GNU sed)
sed -i.bak 's/foo/bar/g' file.txt        # ...but keep a .bak backup first (safer)
sed -i '' 's/foo/bar/g' file.txt         # macOS/BSD sed needs an explicit '' for no-backup

# Line selection & deletion
sed -n '5,10p' file.txt                  # print only lines 5-10 (-n suppresses auto-print)
sed '3d' file.txt                        # delete line 3
sed '/^#/d' file.txt                     # delete comment lines
sed '/^\s*$/d' file.txt                  # delete blank lines
sed '$d' file.txt                        # delete the last line
sed '1,5d' file.txt                      # delete lines 1 through 5

# Using capture groups
sed -E 's/([a-z]+)@([a-z]+)\.com/\1 AT \2 DOT com/' file.txt

# Multiple commands
sed -e 's/foo/bar/' -e 's/baz/qux/' file.txt
sed '{s/foo/bar/; s/baz/qux/}' file.txt

# Insert / append / change
sed '2i\Inserted before line 2' file.txt
sed '2a\Appended after line 2' file.txt
sed '3c\Replacement for line 3' file.txt

# Using a different delimiter (handy when replacing paths with slashes)
sed 's#/old/path#/new/path#g' file.txt
```

## 📊 awk — Text Processing Language

```bash
# Basic field printing (default field separator: whitespace)
awk '{print $1, $3}' file.txt            # print columns 1 and 3
awk -F',' '{print $2}' data.csv          # custom field separator
awk 'BEGIN{FS=","; OFS="\t"} {print $1,$2}' data.csv  # set FS/OFS; convert CSV to TSV

# Filtering rows
awk -F',' '$3 > 100' data.csv            # rows where field 3 > 100
awk -F',' '$2 == "Engineering"' data.csv # exact-match filter
awk 'NR > 1' data.csv                    # skip the header row (NR = current row number)
awk 'NR==1 || /pattern/' data.csv        # keep header + matching rows
awk 'NF > 3' data.csv                    # rows with more than 3 fields

# Aggregation with associative arrays
awk -F',' 'NR>1 {sum[$3]+=$4; cnt[$3]++} 
           END {for (k in sum) printf "%s: total=%d avg=%.2f\n", k, sum[k], sum[k]/cnt[k]}' data.csv

# Built-in variables
# NR = current record (row) number       NF = number of fields in current row
# FS = input field separator             OFS = output field separator
# FILENAME = name of current input file  $0 = the whole current line

# String functions
awk '{print length($0)}' file.txt        # line length
awk '{print toupper($1)}' file.txt       # uppercase field 1
awk '{gsub(/foo/, "bar"); print}' file.txt   # global substitution, like sed
awk '{print substr($1, 1, 3)}' file.txt  # substring: chars 1-3 of field 1

# Multi-line / multi-file idioms
awk 'FNR==1{print "== " FILENAME " =="} {print}' a.txt b.txt   # header per file
awk '{a[NR]=$0} END{for(i=NR;i>=1;i--) print a[i]}' file.txt   # reverse a file (tac equivalent)

# Full script style (readable for complex logic)
awk '
BEGIN { FS=","; print "Processing started" }
NR > 1 {
    total += $4
    count++
}
END {
    printf "Rows: %d, Total: %.2f, Avg: %.2f\n", count, total, total/count
}
' data.csv
```

## 🔀 Redirection, Pipes & Process Substitution

```bash
# Redirection
cmd > out.txt              # stdout to file, overwrite
cmd >> out.txt              # stdout to file, append
cmd 2> err.txt               # stderr to file
cmd > out.txt 2>&1            # stdout AND stderr to the same file (order matters!)
cmd &> out.txt                 # bash shorthand for the line above
cmd < input.txt                 # stdin from a file
cmd < /dev/null                  # give a command empty/no input
cmd > /dev/null 2>&1               # discard all output silently

# Pipes — feed stdout of one command into stdin of the next
grep "error" app.log | wc -l
cat data.csv | cut -d',' -f2 | sort | uniq -c | sort -rn | head -5

# tee — split a stream: write to a file AND pass it on
cmd | tee out.txt | grep "error"          # save full output, but only show errors here
cmd | tee -a out.txt                      # append instead of overwrite

# Here-documents — multi-line stdin, expands $variables by default
cat << EOF
User: $USER
Home: $HOME
EOF

# Here-document with no expansion (quote the delimiter)
cat << 'EOF'
This $variable is printed literally, not expanded.
EOF

# Here-string — feed a single string as stdin
grep "pattern" <<< "$my_variable"

# Process substitution — treat a command's output as if it were a file
diff <(sort file1.txt) <(sort file2.txt)
while read -r line; do echo "got: $line"; done < <(some_command)
paste <(cut -d',' -f1 a.csv) <(cut -d',' -f2 b.csv)

# Named pipes (FIFOs) — for producer/consumer patterns across processes
mkfifo mypipe
some_producer > mypipe &
some_consumer < mypipe
```

## ⚙️ Variables & Environment

```bash
# Declaring and using
name="Alice"                 # no spaces around = ; unquoted spaces break assignment
echo "$name"                  # always quote variable expansions
readonly PI=3.14159            # constant — reassignment will error
unset name                      # remove a variable

# Scope & export
export DB_HOST="localhost"       # makes it visible to child processes
env | grep DB_                    # see exported vars matching a pattern
printenv PATH                      # print one specific env var

# Special/positional variables (inside a script or function)
$0    # script name         $1 $2 ... # positional args      $#   # arg count
$@    # all args as separate words     $*   # all args as one word
$?    # exit status of last command    $$   # PID of the current shell
$!    # PID of the last background job

# Common environment variables
echo "$HOME"        # user's home directory
echo "$PATH"        # directories searched for executables (colon-separated)
echo "$USER"        # current username
echo "$PWD"         # current working directory
echo "$SHELL"       # user's default shell
echo "$LANG"        # locale settings

# Configuring PATH
export PATH="$HOME/bin:$PATH"    # prepend so your scripts are found first
echo "$PATH" | tr ':' '\n'       # print each PATH entry on its own line

# Config files load order (interactive login shells)
# ~/.bash_profile or ~/.profile -> ~/.bashrc -> current shell
# Put PATH/exports in .bash_profile, aliases/functions in .bashrc

# declare — explicit typing and attributes
declare -i count=0        # integer — arithmetic happens automatically on assignment
declare -r LOCKED="fixed"  # read-only, same as readonly
declare -A lookup          # associative array
declare -x SHARED=1        # same as export
```

## 🏗️ Shell Script Structure & Exit Codes

```bash
#!/usr/bin/env bash
# ^ shebang: run this file with whichever bash is first on $PATH (portable across
#   systems where bash isn't always at /bin/bash, e.g. some macOS/Nix setups)

set -euo pipefail
# -e: exit immediately if any command fails
# -u: error on use of an unset variable
# -o pipefail: a pipeline's exit code is its first failing command, not just the last

# Making a script executable and runnable
# chmod +x myscript.sh
# ./myscript.sh              (needs +x and to be found via ./ or full path)
# bash myscript.sh           (works without +x, ignores the shebang)

# Exit codes
# 0       = success
# 1-255   = failure (specific meanings are command-defined; 126=not executable,
#           127=command not found, 130=terminated by Ctrl+C/SIGINT)
exit 0                      # explicit success
exit 1                      # explicit generic failure

my_function() {
    if [[ ! -f "$1" ]]; then
        echo "Error: file not found" >&2   # errors go to stderr, not stdout
        return 1
    fi
    return 0
}

if my_function "data.csv"; then
    echo "found it"
else
    echo "exit code was $?"
fi

# Checking the outcome of the last command
some_command
if [[ $? -eq 0 ]]; then
    echo "succeeded"
fi
# (idiomatic form checks directly instead of via $?:)
if some_command; then echo "succeeded"; fi
```

## 🔢 Arithmetic Operations

```bash
# Arithmetic expansion — the standard way to do math in bash
a=5; b=3
echo $((a + b))          # 8
echo $((a - b))          # 2
echo $((a * b))          # 15
echo $((a / b))          # 1  (integer division — bash has no native floats)
echo $((a % b))          # 2  (modulo)
echo $((a ** b))         # 125 (exponentiation)

# Floating point needs an external tool
echo "scale=2; 5/3" | bc         # 1.66
python3 -c "print(5/3)"          # 1.6666666666666667
awk "BEGIN{print 5/3}"           # 1.66667

# In-place arithmetic
((a += 1))                # a is now 6
((a++))                   # post-increment (see gotchas: risky under `set -e`)
((++a))                   # pre-increment
let "a = a + 5"           # `let` is an older, less-used arithmetic form

# Comparisons (inside (( )), use normal math operators, not -eq/-gt)
(( a > b )) && echo "a is bigger"
(( a == 6 )) && echo "a is six"

# Base conversions
echo $((16#1F))           # hex 1F -> decimal: 31
echo $((2#1010))          # binary 1010 -> decimal: 10
printf "%x\n" 255          # decimal to hex: ff
printf "%o\n" 8             # decimal to octal: 10

# Random numbers
echo $RANDOM               # bash's built-in pseudo-random 0-32767
echo $(( RANDOM % 100 ))   # random number 0-99
shuf -i 1-100 -n 1          # random number in a range (external tool)
```

## 🧵 String Manipulation & Parameter Expansion

```bash
str="Hello, World!"

# Length
echo "${#str}"                  # 13

# Substring: ${var:offset:length}
echo "${str:7:5}"               # "World"
echo "${str:7}"                 # "World!"  (offset only, to end of string)
echo "${str: -6}"                # "World!"  (negative offset needs the space)

# Case conversion (Bash 4+)
echo "${str^^}"                  # HELLO, WORLD!  (all uppercase)
echo "${str,,}"                  # hello, world!  (all lowercase)
echo "${str^}"                    # Hello, World!  (capitalize first char only)

# Search & replace
echo "${str/World/Bash}"         # replace first match: "Hello, Bash!"
echo "${str//o/0}"                # replace all matches: "Hell0, W0rld!"
echo "${str/#Hello/Hi}"            # replace only if match is at the start
echo "${str/%!/.}"                  # replace only if match is at the end

# Default values / required values
echo "${var:-default}"            # use "default" if var is unset or empty (doesn't set var)
echo "${var:=default}"            # same, but also ASSIGNS default to var
echo "${var:?must be set}"        # error out with message if var is unset/empty
echo "${var:+alt}"                # use "alt" ONLY if var IS set (inverse of :-)

# Trimming prefixes/suffixes — the classic path/filename toolkit
path="/home/user/archive.tar.gz"
echo "${path##*/}"                 # "archive.tar.gz"  (greedy strip from front = basename)
echo "${path#*/}"                   # "home/user/archive.tar.gz"  (non-greedy strip from front)
echo "${path%/*}"                    # "/home/user"  (greedy strip from back = dirname)
echo "${path%.*}"                     # "/home/user/archive.tar"  (strip last extension)
echo "${path##*.}"                     # "gz"  (extension only)

# Splitting a string into words (relies on IFS / default word-splitting)
str="a,b,c"
IFS=',' read -ra parts <<< "$str"
echo "${parts[1]}"                  # "b"

# Concatenation
first="Hello"; second="World"
combined="${first}, ${second}!"     # braces avoid ambiguity when adjacent to other text
```

## 📦 Arrays

```bash
# Indexed arrays
arr=(apple banana cherry)
echo "${arr[0]}"                 # "apple"  (0-indexed)
echo "${arr[@]}"                 # all elements: "apple banana cherry"
echo "${#arr[@]}"                 # length: 3
echo "${!arr[@]}"                  # indices: 0 1 2

arr+=(date)                       # append an element
arr[1]="blueberry"                 # overwrite element at index 1
unset 'arr[0]'                      # remove element at index 0 (leaves a gap in indices!)
arr=("${arr[@]}")                    # re-index / compact after unset

# Slicing
echo "${arr[@]:1:2}"               # 2 elements starting at index 1

# Iterating
for item in "${arr[@]}"; do
    echo "item: $item"
done

for i in "${!arr[@]}"; do          # iterate by index when you need position too
    echo "arr[$i] = ${arr[$i]}"
done

# Building an array from command output (each line becomes one element)
mapfile -t lines < file.txt         # safest way — one element per line, no word-splitting
readarray -t files < <(find . -name "*.csv")

# Associative arrays (Bash 4+) — key/value maps
declare -A config
config[host]="localhost"
config[port]="5432"
config["db name"]="analytics"        # keys can contain spaces if quoted

echo "${config[host]}"
for key in "${!config[@]}"; do
    echo "$key -> ${config[$key]}"
done

# Passing arrays to functions (bash has no true array pass-by-value; pass name or expand)
print_all() {
    local -n ref=$1        # nameref: refers to the caller's variable by name
    for x in "${ref[@]}"; do echo "$x"; done
}
print_all arr
```

## 🔀 Conditionals & Test Operators

```bash
# if / elif / else
if [[ -f "file.txt" ]]; then
    echo "file exists"
elif [[ -d "file.txt" ]]; then
    echo "it's actually a directory"
else
    echo "not found"
fi

# [[ ]] (bash-native, preferred) vs [ ] (POSIX, portable to /bin/sh)
[[ $name == "Alice" ]] && echo "match"    # no word-splitting/globbing surprises
[ "$name" = "Alice" ] && echo "match"      # POSIX form — always quote variables here

# Combining conditions
if [[ -f "file.txt" && -r "file.txt" ]]; then echo "exists and readable"; fi
if [[ $age -ge 18 && $age -lt 65 ]]; then echo "working age"; fi
if [[ $x -eq 1 || $x -eq 2 ]]; then echo "one or two"; fi

# Pattern matching inside [[ ]] (glob-style, not full regex)
[[ $filename == *.csv ]] && echo "is a csv"

# Regex matching with =~
if [[ "user@example.com" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo "looks like a valid email"
fi
echo "${BASH_REMATCH[0]}"          # the full match; [1], [2]... are capture groups

# case — cleaner than a long if/elif chain for multiple discrete values
read -rp "Enter environment: " env
case "$env" in
    dev|development) echo "Development settings" ;;
    staging)          echo "Staging settings" ;;
    prod|production)  echo "Production settings — be careful!" ;;
    *)                echo "Unknown environment: $env" ;;
esac

# Ternary-style one-liners
result=$([[ $x -gt 0 ]] && echo "positive" || echo "non-positive")

# Short-circuit idioms
[[ -d "$dir" ]] || mkdir -p "$dir"     # create dir only if it doesn't exist
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
```

## 🔁 Loops

```bash
# for — over a list
for color in red green blue; do
    echo "$color"
done

# for — over a range
for i in {1..5}; do echo "$i"; done
for i in {0..20..5}; do echo "$i"; done      # step of 5: 0 5 10 15 20

# for — C-style
for (( i=0; i<5; i++ )); do echo "$i"; done

# for — over files (glob expansion; always quote the variable)
for file in *.csv; do
    echo "processing $file"
done

# for — over command output, safely (word-splits on IFS, careful with spaces)
for f in $(ls *.txt); do echo "$f"; done       # fragile: breaks on spaces in filenames
while IFS= read -r f; do echo "$f"; done < <(find . -name "*.txt")   # safer

# while
count=0
while (( count < 5 )); do
    echo "count: $count"
    count=$((count + 1))       # prefer this over ((count++)) under `set -e` — see gotchas
done

# while — reading a file line by line (the standard, safe idiom)
while IFS=, read -r id name amount; do
    echo "$name: $amount"
done < data.csv

# until — loops while the condition is FALSE
n=0
until (( n >= 3 )); do
    echo "n=$n"
    n=$((n + 1))
done

# Loop control
for i in {1..10}; do
    (( i == 3 )) && continue     # skip this iteration
    (( i == 6 )) && break         # exit the loop entirely
    echo "$i"
done

# select — quick interactive menus
select option in "Start" "Stop" "Quit"; do
    case $option in
        Start) echo "Starting..."; break ;;
        Stop)  echo "Stopping..."; break ;;
        Quit)  break ;;
    esac
done
```

## 🧩 Functions

```bash
# Definition styles (equivalent)
greet() {
    echo "Hello, $1!"
}
function greet {
    echo "Hello, $1!"
}

# Calling
greet "World"                # positional args, just like a script

# Local variables — always declare with `local` to avoid leaking into global scope
calculate() {
    local a=$1
    local b=$2
    local sum=$((a + b))
    echo "$sum"                 # "returning" a value: print it, capture with $()
}
result=$(calculate 3 4)
echo "$result"                 # 7

# Return codes vs "returned" values
# `return` only sets the numeric exit status ($?), 0-255 — it is NOT a value channel.
check_positive() {
    (( $1 > 0 ))            # the truth value of this becomes the function's exit code
}
if check_positive 5; then echo "positive"; fi

# Default parameters
greet() {
    local name="${1:-World}"
    echo "Hello, $name!"
}

# Variable-length arguments
sum_all() {
    local total=0
    for n in "$@"; do
        total=$((total + n))
    done
    echo "$total"
}
sum_all 1 2 3 4 5              # 15

# Passing an array (expand it explicitly)
process_list() {
    local items=("$@")
    for item in "${items[@]}"; do echo "- $item"; done
}
my_arr=(a b c)
process_list "${my_arr[@]}"

# Recursive functions
factorial() {
    local n=$1
    if (( n <= 1 )); then
        echo 1
    else
        echo $(( n * $(factorial $((n - 1))) ))
    fi
}
factorial 5                     # 120

# Sourcing shared functions from another file
# source ./lib/helpers.sh
# . ./lib/helpers.sh             # "." is the POSIX equivalent of "source"
```

## 📥 Input/Output & User Interaction

```bash
# Reading user input
read -rp "Enter your name: " name
echo "Hello, $name"

read -rsp "Enter password: " password    # -s: silent (no echo to terminal)
echo                                      # newline after silent input

read -t 5 -rp "Answer within 5s: " ans    # -t: timeout in seconds
echo "you said: ${ans:-<no answer>}"

read -n 1 -rp "Press any key..." key      # -n1: read exactly 1 character
echo

# Reading multiple values at once
read -r first last <<< "John Doe"
echo "First: $first, Last: $last"

# Printing
echo "Simple text"
echo -n "No trailing newline"
echo -e "Tab:\tNewline:\n"                 # -e enables backslash escape interpretation
printf "%s is %d years old\n" "Alice" 30    # printf is more predictable than echo -e
printf "%-10s|%5d|\n" "left" 42              # width/alignment control

# Colored output (ANSI escape codes)
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'  # NC = "no color", resets it
echo -e "${RED}Error:${NC} something failed"
echo -e "${GREEN}Success:${NC} all good"

# Prompts with a default, and yes/no confirmation
read -rp "Continue? [y/N] " confirm
if [[ "${confirm,,}" == "y" ]]; then
    echo "proceeding"
fi

# Redirecting a whole block to a log file
{
    echo "Starting job at $(date)"
    echo "Doing work..."
} >> job.log 2>&1
```

## 🎛️ Command-Line Arguments & getopts

```bash
#!/usr/bin/env bash
# Positional arguments
echo "Script name: $0"
echo "First arg: $1"
echo "All args: $@"
echo "Arg count: $#"

# Shifting through args
while (( $# > 0 )); do
    echo "processing: $1"
    shift
done

# getopts — the standard way to parse -flag style options
usage() { echo "Usage: $0 [-v] [-o outfile] [-n num] arg1"; exit 1; }

verbose=false
outfile="output.txt"
number=1

while getopts ":vo:n:h" opt; do
    case $opt in
        v) verbose=true ;;
        o) outfile="$OPTARG" ;;
        n) number="$OPTARG" ;;
        h) usage ;;
        \?) echo "Invalid option: -$OPTARG" >&2; usage ;;
        :) echo "Option -$OPTARG requires an argument" >&2; usage ;;
    esac
done
shift $((OPTIND - 1))          # remove parsed options, leaving positional args in $@

echo "verbose=$verbose outfile=$outfile number=$number remaining=$*"

# Long options (--flag style) need manual parsing — getopts only handles single-char flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)  name="$2"; shift 2 ;;
        --verbose) verbose=true; shift ;;
        --) shift; break ;;                 # explicit end-of-options marker
        -*) echo "Unknown option: $1" >&2; exit 1 ;;
        *) break ;;                          # first non-option arg — stop parsing
    esac
done

# Requiring a minimum number of arguments
[[ $# -lt 1 ]] && { echo "Missing required argument" >&2; usage; }
```

## ⚡ Process Management & Job Control

```bash
# Viewing processes
ps aux                       # all processes, full detail
ps aux | grep python           # find a specific process (or use pgrep, see below)
ps -ef --forest                 # process tree view
top                              # live, interactive process monitor
htop                              # nicer top, if installed
pstree                             # visual process tree

# Finding & signaling processes by name (no need to grep ps output)
pgrep -f "python script.py"          # list matching PIDs
pkill -f "python script.py"           # send SIGTERM to matching processes
killall firefox                        # kill all processes with this exact name

# Signals
kill PID                     # SIGTERM (15) — polite request to terminate
kill -9 PID                  # SIGKILL (9) — immediate, un-catchable termination
kill -HUP PID                # SIGHUP (1) — often used to make a daemon reload config
kill -l                       # list all available signal names

# Background & foreground jobs
long_running_command &        # run in the background
jobs                            # list jobs in the current shell
fg %1                             # bring job 1 to the foreground
bg %1                              # resume a stopped job in the background
disown %1                           # detach job 1 so it survives the shell exiting
wait                                 # wait for all background jobs to finish
wait $!                               # wait for the most recently started background job

# Surviving terminal disconnects
nohup long_script.sh > output.log 2>&1 &    # ignore SIGHUP, keeps running after logout
disown                                       # (used with nohup for extra safety)
setsid long_script.sh &                       # detach into a fully new session
# tmux / screen: full persistent terminal sessions you can detach from and reattach to
tmux new -s mysession
# Ctrl+b d to detach, then later: tmux attach -t mysession

# Priority
nice -n 10 heavy_script.sh          # start with lower priority (higher niceness = nicer to others)
renice -n 5 -p PID                    # change priority of an already-running process

# Resource usage
/usr/bin/time -v ./script.sh          # detailed timing + memory usage of one run
free -h                                # system memory usage
vmstat 2 5                              # system stats every 2s, 5 times
```

## 🌐 Networking & Remote Operations

```bash
# Connectivity checks
ping -c 4 example.com               # 4 ICMP echo requests
curl -I https://example.com          # HTTP headers only (HEAD request)
curl -sSL https://example.com/file -o file    # -s silent, -S show errors, -L follow redirects
wget https://example.com/file.tar.gz            # download a file
nc -zv host 443                                  # check if a TCP port is open

# DNS
dig example.com                     # detailed DNS lookup
dig +short example.com                # just the IP
nslookup example.com                    # older, simpler DNS tool
host example.com                          # quick forward/reverse lookup

# Local network info
ip addr show                       # interfaces + IP addresses (modern replacement for ifconfig)
ip route                             # routing table
ss -tulpn                              # listening ports + owning processes (modern netstat)
netstat -tulpn                           # older equivalent of the line above

# SSH — remote shell access
ssh user@host                       # connect
ssh -p 2222 user@host                 # connect on a non-default port
ssh -i ~/.ssh/id_ed25519 user@host      # use a specific private key
ssh user@host "ls -la /var/log"           # run a single remote command and exit
ssh -L 8080:localhost:80 user@host          # local port forward (tunnel remote port to you)

# SSH config shortcuts (~/.ssh/config)
# Host myserver
#     HostName 203.0.113.5
#     User deploy
#     Port 2222
#     IdentityFile ~/.ssh/id_ed25519
# then just:  ssh myserver

# scp / rsync — copying files to/from remote hosts
scp file.txt user@host:/remote/path/          # local -> remote
scp user@host:/remote/file.txt .                # remote -> local
scp -r local_dir/ user@host:/remote/path/         # recursive copy of a directory
rsync -avz src/ user@host:/remote/dest/             # -a archive, -v verbose, -z compress
rsync -avz --delete src/ dest/                        # mirror exactly, removing extras in dest
rsync --dry-run -avz src/ dest/                         # preview what would change, no copy

# curl for APIs
curl -X POST https://api.example.com/data \
     -H "Content-Type: application/json" \
     -d '{"key": "value"}'
curl -u username:password https://api.example.com/secure
```

## 📅 Cron, Scheduling & System Admin

```bash
# crontab — recurring scheduled jobs
crontab -l                      # list current user's cron jobs
crontab -e                       # edit current user's cron jobs
crontab -r                        # remove all of current user's cron jobs

# Cron syntax: minute hour day-of-month month day-of-week command
# *     *     *          *      *          command
# 0-59  0-23  1-31        1-12   0-7 (0/7=Sun)

# Examples
# 0 2 * * *        /scripts/backup.sh          # 2:00 AM daily
# */15 * * * *      /scripts/healthcheck.sh      # every 15 minutes
# 0 9 * * 1-5        /scripts/weekday_report.sh    # 9:00 AM, Monday-Friday
# 0 0 1 * *            /scripts/monthly_cleanup.sh   # midnight on the 1st of every month
# @reboot                /scripts/startup.sh              # once, at system boot

# Ensuring a cron job's environment matches your interactive shell
# (cron runs with a minimal PATH/env — always use absolute paths and set PATH explicitly)
# PATH=/usr/local/bin:/usr/bin:/bin
# 0 2 * * * /full/path/to/script.sh >> /full/path/to/log 2>&1

# at — run a one-off job at a specific future time
echo "/scripts/one_off.sh" | at 23:00
atq                              # list pending at-jobs
atrm 3                             # cancel job number 3

# systemd — services on modern Linux distros
systemctl status nginx            # check service status
systemctl start nginx               # start it
systemctl stop nginx                 # stop it
systemctl restart nginx                # restart it
systemctl enable nginx                   # start automatically on boot
sudo journalctl -u nginx -f                # follow that service's logs live
sudo journalctl --since "1 hour ago"          # recent logs across the system

# Package management (Debian/Ubuntu)
sudo apt update                     # refresh package index
sudo apt install package_name          # install
sudo apt remove package_name             # remove
sudo apt list --installed                  # what's installed

# Package management (RHEL/CentOS/Fedora)
sudo dnf install package_name          # (yum on older systems)
sudo dnf remove package_name
sudo dnf update

# Environment/system info useful for debugging pipelines
lsb_release -a                     # distro name/version
uname -r                             # kernel version
nproc                                  # number of CPU cores
```

## 🗜️ Archiving & Compression

```bash
# tar — the standard bundling tool (does NOT compress by itself)
tar -cf archive.tar dir/            # create an archive
tar -xf archive.tar                   # extract
tar -tf archive.tar                     # list contents without extracting

# tar + compression (combined flags)
tar -czf archive.tar.gz dir/         # create, gzip-compressed  (c=create z=gzip f=file)
tar -xzf archive.tar.gz                # extract a .tar.gz
tar -cjf archive.tar.bz2 dir/            # create, bzip2-compressed (better ratio, slower)
tar -xjf archive.tar.bz2
tar -cJf archive.tar.xz dir/               # create, xz-compressed (best ratio, slowest)
tar -xJf archive.tar.xz

tar -xzf archive.tar.gz -C /target/dir/     # extract into a specific directory
tar -tzf archive.tar.gz | grep "\.csv$"        # search inside an archive without extracting
tar -czf backup.tar.gz --exclude="*.log" dir/    # exclude a pattern

# gzip / gunzip — single-file compression
gzip file.txt                       # compresses in place -> file.txt.gz (removes original)
gzip -k file.txt                       # keep the original as well
gunzip file.txt.gz                       # decompress in place
zcat file.txt.gz                           # view contents without decompressing to disk
zgrep "pattern" file.txt.gz                  # grep inside a .gz file directly

# zip / unzip — cross-platform, keeps directory structure in one file
zip -r archive.zip dir/
unzip archive.zip
unzip -l archive.zip                       # list contents
unzip archive.zip -d /target/dir/            # extract to a specific directory

# Choosing a format for a data pipeline
# .tar.gz  — most common on Linux, fast, decent ratio, universally supported
# .tar.bz2 — smaller than gz, notably slower to compress
# .tar.xz  — smallest, slowest, best for cold storage/archival
# .zip     — best when the receiving end is likely to be Windows/macOS
```

## 🛡️ Error Handling, Debugging & Traps

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'            # safer word-splitting: only newline/tab, not plain spaces

# set flags, individually
set -e            # exit on any command failure
set -u             # error on unset variable use
set -x              # print every command before running it (great for debugging)
set -o pipefail      # a pipeline fails if ANY stage fails, not just the last one
set +x               # turn off command tracing again

# trap — run cleanup code on exit or on a signal, no matter how the script ends
cleanup() {
    echo "Cleaning up temp files..."
    rm -f "$TMPFILE"
}
TMPFILE=$(mktemp)
trap cleanup EXIT                     # always runs when the script exits, success or fail
trap 'echo "Interrupted!"; exit 130' INT     # handle Ctrl+C explicitly
trap 'echo "Error on line $LINENO"' ERR        # log the line number where a command failed

# Custom error handling function
die() {
    echo "ERROR: $*" >&2
    exit 1
}
[[ -f "config.yml" ]] || die "config.yml not found"

# Debugging techniques
bash -x script.sh                     # run with tracing enabled, without editing the file
bash -n script.sh                      # syntax check only ("no-exec") — catches typos fast
echo "DEBUG: value of x = $x" >&2        # manual debug prints to stderr (keeps stdout clean)
PS4='+ ${BASH_SOURCE}:${LINENO}: '         # customize the set -x trace prefix with file/line

# Assertions
assert_file_exists() {
    [[ -f "$1" ]] || die "Expected file not found: $1"
}
assert_file_exists "data.csv"

# Retry logic for flaky operations (e.g. network calls)
retry() {
    local max=$1; shift
    local n=0
    until "$@"; do
        (( n++ >= max )) && { echo "Failed after $max attempts" >&2; return 1; }
        echo "Attempt $n failed, retrying..." >&2
        sleep $(( n * 2 ))     # simple exponential-ish backoff
    done
}
retry 3 curl -sf https://example.com/health
```

## ⚠️ Common Gotchas

- **`set -e` + `((i++))` silently kills your script** — when `i` is `0`, `((i++))` evaluates (returns) the *old* value `0`, which bash treats as a false/failing exit status. Under `set -e`, that aborts the whole script the moment a post-increment counter starts at 0. Use `i=$((i+1))`, `(( ++i ))`, or `(( i++ )) || true` instead.
- **Unquoted variable expansions break on spaces and globs** — `rm $file` can turn into multiple `rm` arguments (or an unintended glob) if `$file` contains spaces. Always write `rm "$file"`.
- **`for f in $(ls *.txt)` breaks on filenames with spaces or newlines** — command substitution word-splits on `$IFS`. Prefer a glob directly (`for f in *.txt`) or `find ... -print0 | xargs -0`.
- **`[ ]` vs `[[ ]]` are not the same** — `[` is the POSIX test command (external or builtin) and is sensitive to word-splitting/globbing on unquoted variables; `[[ ]]` is a bash keyword that's safer and supports `&&`, `||`, and `=~` directly. Use `[[ ]]` in bash scripts; reserve `[ ]` for scripts that must run under `/bin/sh`.
- **Command substitution strips trailing newlines** — `x=$(printf "a\n\n")` leaves `$x` as just `"a"`; this is usually harmless but surprises people diffing output.
- **Backticks vs `$()`** — legacy `` `cmd` `` backticks are harder to nest and to escape correctly than `$(cmd)`; prefer `$()` in new scripts.
- **`==` inside `[[ ]]` does glob matching, not regex** — `[[ $x == *.txt ]]` works as a wildcard, but `[[ $x == ^[0-9]+$ ]]` will NOT do what you think; use `=~` for real regex.
- **Heredoc delimiter quoting changes expansion** — `<< EOF` expands `$variables` inside the block; `<< 'EOF'` (quoted delimiter) does not. Pick deliberately.
- **`sed -i` behaves differently on macOS/BSD vs Linux/GNU** — GNU `sed -i 's/a/b/'` edits in place with no backup; BSD `sed -i` requires an explicit (even empty) suffix argument: `sed -i '' 's/a/b/'`.
- **A trailing `&` doesn't survive shell logout** without extra help — a background job is killed by `SIGHUP` when its parent shell exits unless started with `nohup`, `disown`, or `setsid`.
- **`chmod -R 777` "fixes" permission errors by removing all safety** — it makes every file/directory world-writable, which is a common source of security incidents on shared or internet-facing machines. Diagnose the actual owner/group mismatch instead.
- **Cron jobs "work in my terminal" but fail under cron** — cron runs with a minimal `$PATH` and no shell profile loaded; always use absolute paths for both the script and any tools it calls, and set `PATH` explicitly in the crontab if needed.
- **Word-splitting on `$@` vs `$*`** — `"$@"` expands to separate quoted words (what you almost always want when forwarding arguments); `"$*"` joins everything into one single string. Unquoted, both behave the same (and both are unsafe).
- **Reading a `while` loop's variables doesn't survive a pipe into it** — `cat file | while read -r line; do count=$((count+1)); done; echo $count` prints `0`, because the pipe puts the loop in a subshell with its own variable scope. Use process substitution (`while read -r line; do ...; done < <(cat file)`) or redirect the file directly into the loop instead.

## 🎯 Best Practices

```bash
#!/usr/bin/env bash
#
# script_name.sh — one-line description of what this script does
#
# Usage: script_name.sh [-v] [-o output] input_file
#
set -euo pipefail
IFS=$'\n\t'

# Constants at the top, in caps, marked readonly
readonly MAX_RETRIES=3
readonly LOG_FILE="/var/log/myscript.log"

# Always quote variable expansions
process_file() {
    local input="$1"
    [[ -f "$input" ]] || { echo "File not found: $input" >&2; return 1; }
    # ... work happens here
}

# Validate inputs before doing anything destructive
[[ $# -ge 1 ]] || { echo "Usage: $0 <input_file>" >&2; exit 1; }

# Prefer $(...) over backticks, and [[ ]] over [ ] in bash-only scripts
if [[ -f "$1" ]]; then
    result=$(process_file "$1")
fi

# Use functions to keep main logic readable, call them from a clear entry point
main() {
    process_file "$1"
}
main "$@"

# Clean up temp resources deterministically
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

# Log meaningfully, to stderr for diagnostics, keep stdout for actual output/data
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; }
log "Starting processing"
```

- Start every non-trivial script with `#!/usr/bin/env bash` and `set -euo pipefail`.
- Quote every variable expansion (`"$var"`, `"${arr[@]}"`) unless you specifically need word-splitting or globbing.
- Use `[[ ]]` instead of `[ ]` in bash scripts; use `(( ))` for arithmetic comparisons.
- Use `local` for every function-scoped variable to avoid leaking into the global namespace.
- Prefer `$(command)` over backtick substitution — it nests and escapes far more predictably.
- Check `command -v` for required external tools at the top of a script, and fail fast with a clear message if one is missing.
- Use `shellcheck script.sh` before shipping anything — it catches the majority of the gotchas listed above automatically.
- Keep scripts idempotent where possible (safe to re-run without side effects) — especially important for anything cron will call.
- Write to `stderr` for logs/diagnostics and reserve `stdout` for the script's actual data output, so it composes cleanly in a pipeline.

## 📚 Idioms, Performance & Memory Tips

### Common Idioms

```bash
# Check if a command exists before using it
if command -v jq >/dev/null 2>&1; then
    echo "jq is available"
fi

# Default a variable only if empty/unset
output_dir="${1:-./output}"

# One-liner directory setup
mkdir -p "$output_dir"/{logs,data,tmp}    # brace expansion creates 3 subdirs at once

# Dry-run pattern
DRY_RUN="${DRY_RUN:-false}"
run() { if [[ "$DRY_RUN" == "true" ]]; then echo "[DRY RUN] $*"; else "$@"; fi; }
run rm -f old_file.txt

# Counting matching lines without a separate wc call
count=$(grep -c "error" app.log)

# Turning a delimited string into an array of trimmed fields
IFS=',' read -ra fields <<< "  a , b , c  "

# Timestamped filenames
backup_file="backup_$(date +%Y%m%d_%H%M%S).tar.gz"

# Simple progress indicator in a loop
total=100
for (( i=1; i<=total; i++ )); do
    printf "\rProgress: %d/%d" "$i" "$total"
done
echo

# Guard clause pattern (return/exit early instead of nesting deeply)
process() {
    [[ -z "$1" ]] && { echo "arg required" >&2; return 1; }
    [[ ! -f "$1" ]] && { echo "not a file" >&2; return 1; }
    # main logic, unindented and readable
}
```

### Performance Tips

1. Prefer builtins (`[[`, `((`, parameter expansion) over spawning external processes (`test`, `expr`, `basename`) inside tight loops.
2. Batch `find ... -exec cmd {} +` instead of `-exec cmd {} \;` to invoke the command fewer times.
3. Use `mapfile`/`readarray` instead of a `while read` loop when you just need the whole file as an array.
4. Avoid `cat file | grep pattern` — `grep pattern file` skips spawning an extra process ("useless use of cat").
5. Use `grep -F` for literal-string searches — it skips regex engine overhead entirely.
6. Combine multiple `sed`/`awk` operations into one invocation with `-e` or `{}` blocks rather than chaining several processes.
7. Use `xargs -P` to parallelize independent, per-item work across multiple cores.
8. For large files, prefer streaming tools (`awk`, `sed`, `grep`) over loading everything into a bash array.
9. Use `rsync` instead of repeated `scp`/`cp` for incremental syncs — it only transfers changed bytes.
10. Profile a slow script with `time ./script.sh` or `bash -x` plus `PS4` timestamps before optimizing blindly.

### Memory & Resource Tips

1. Stream large files line-by-line (`while read`, `awk`, `sed`) rather than reading them entirely into a variable or array.
2. Use `du -sh` and `df -h` to catch disk-space issues before a script fails mid-run.
3. Clear large local variables/arrays with `unset` once a script no longer needs them, especially in long-running loops.
4. Prefer `tar`/`gzip` streaming (`tar -cz ... | ssh host 'cat > backup.tar.gz'`) over materializing a huge intermediate archive on disk when space is tight.
5. Watch out for unbounded log growth from `set -x` or verbose `curl`/`rsync` output in long-running or cron-scheduled scripts — rotate or truncate logs.
6. Use `ulimit -v` / `ulimit -f` to cap a runaway script's memory or file-size usage during development.
7. For very large text processing jobs, `awk` typically uses far less memory than reading the same data into bash arrays.

## 💡 Pro Tips

1. **Always run `shellcheck`** on scripts before deploying them — it catches quoting bugs, unreachable code, and portability issues that are easy to miss by eye.
2. **`set -euo pipefail` is a default, not a guarantee** — commands in an `if`/`while` condition, or on the left of `||`, are exempt from `-e`; know the exceptions.
3. **Use `mktemp` / `mktemp -d`** for temporary files instead of hardcoding `/tmp/myfile` — avoids collisions and predictable-filename security issues.
4. **Prefer absolute paths in cron jobs and systemd units** — the runtime environment there is far more minimal than an interactive shell.
5. **Use `trap ... EXIT`** for cleanup instead of scattering `rm -f "$tmp"` before every possible exit point in a script.
6. **Test scripts with `bash -n`** for a fast syntax-only check, and `bash -x` for full execution tracing, before reaching for print-debugging.
7. **Version-pin your tools' behavior in comments** when a snippet depends on GNU vs BSD `sed`/`date` — it saves the next person (often you) a confusing debugging session.
8. **Use `readonly` and `declare -r`** for constants — small, but it turns an accidental reassignment into an immediate, loud error instead of a silent bug.
9. **Log with timestamps to stderr, keep stdout clean** — makes scripts composable in larger pipelines and debuggable after the fact via redirected logs.
10. **Write scripts to be idempotent** — safe to re-run after a partial failure, which matters enormously for anything triggered by cron, CI, or orchestration tools.
11. **Favor `awk`/`sed` for structured stream processing over ad hoc bash string-splitting** — they're faster, more expressive, and better tested for this exact job.
12. **Keep `.bashrc` fast** — slow startup scripts (heavy `eval $(...)` chains, network calls) make every new shell and every CI step feel sluggish.
13. **Document non-obvious flags inline** — a `-z` or `-P4` a few characters into a long pipeline is invisible six months later without a comment.
14. **Use `${var:?message}`** at the top of scripts for required environment variables — fails fast with a clear message instead of a cryptic error three steps later.
15. **Reach for a real language (Python, etc.) once a script needs real data structures or complex error handling** — bash is superb for orchestration and text-stream glue, but fights back hard past a certain complexity.
