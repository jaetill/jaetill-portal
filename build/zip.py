#!/usr/bin/env python3
"""Build a Lambda deployment zip with POSIX paths.

Windows' Compress-Archive writes backslash-separated entry names, which the
Linux Lambda runtime cannot resolve ("Cannot find module"). This walks the
source tree and writes forward-slash entries explicitly.

Usage:
    python build/zip.py <out.zip> <src-dir> [<extra-path> ...]

Each <extra-path> may be a file or a directory; directories are added
recursively, rooted at their basename inside the archive.
"""

import os
import sys
import zipfile

EXCLUDE_DIRS = {".git", "__pycache__", ".pytest_cache"}
EXCLUDE_EXT = {".zip", ".pyc"}


def add_file(zf, abs_path, arc_name):
    zf.write(abs_path, arc_name.replace(os.sep, "/"))


def add_tree(zf, root, arc_root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if os.path.splitext(fn)[1] in EXCLUDE_EXT:
                continue
            abs_path = os.path.join(dirpath, fn)
            rel = os.path.relpath(abs_path, root)
            add_file(zf, abs_path, os.path.join(arc_root, rel) if arc_root else rel)


def main(argv):
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2

    out, src = argv[1], argv[2]
    extras = argv[3:]

    out_dir = os.path.dirname(os.path.abspath(out))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        if os.path.isdir(src):
            add_tree(zf, src, "")
        else:
            add_file(zf, src, os.path.basename(src))

        for extra in extras:
            if os.path.isdir(extra):
                add_tree(zf, extra, os.path.basename(os.path.normpath(extra)))
            else:
                add_file(zf, extra, os.path.basename(extra))

    size_mb = os.path.getsize(out) / (1024 * 1024)
    with zipfile.ZipFile(out) as zf:
        count = len(zf.namelist())
    print(f"{out}: {count} entries, {size_mb:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
