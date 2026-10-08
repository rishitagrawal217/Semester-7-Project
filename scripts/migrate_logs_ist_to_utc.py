"""One-off migration: shift old log timestamps from IST to UTC.

Before the UTC change, the app wrote `datetime.now(Asia/Kolkata)` into SQLite.
SQLite drops the timezone, so those rows hold IST wall-clock times with no
marker. The app now treats every stored timestamp as UTC, so old rows read
5h30m too late until they are shifted back by 5h30m. This script does that.

Safety:
  - Run it ONCE. A `schema_migrations` row is written on success and a second
    run refuses to start, since shifting twice would corrupt the data.
  - A copy of the database is saved next to it (`<db>.pre-utc.bak`) first.
  - Everything runs in one transaction; any error rolls it all back.
  - `--dry-run` reports what would change without touching anything.

Run it BEFORE the new version writes any rows. If it already has, tell the
script where the new rows start so only the older IST rows are shifted:
    --first-new-id detection_logs=120 --first-new-id qr_detection_logs=40
Row ids are used, not timestamps: IST wall-clock values run 5h30m ahead of
UTC ones, so a timestamp cutoff cannot separate old rows from new ones.

Usage (from the repo root):
    python scripts/migrate_logs_ist_to_utc.py --dry-run
    python scripts/migrate_logs_ist_to_utc.py
    python scripts/migrate_logs_ist_to_utc.py --db path/to/phishing_logs.db
"""
import argparse
import shutil
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

MIGRATION_NAME = "logs_ist_to_utc"
IST_OFFSET = timedelta(hours=5, minutes=30)
TABLES = ("detection_logs", "qr_detection_logs")
# SQLAlchemy's SQLite DateTime format; writing it back keeps rows readable by the ORM.
STORED_FORMAT = "%Y-%m-%d %H:%M:%S.%f"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--db", default="logs/phishing_logs.db", help="SQLite file (default: %(default)s)")
    parser.add_argument("--dry-run", action="store_true", help="show what would change, modify nothing")
    parser.add_argument(
        "--first-new-id", action="append", default=[], metavar="TABLE=ID",
        help="leave rows with id >= ID untouched in TABLE (already written as UTC); repeatable",
    )
    return parser.parse_args()


def table_exists(conn, name):
    row = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone()
    return row is not None


def main():
    args = parse_args()
    db_path = Path(args.db)
    if not db_path.exists():
        sys.exit(f"No database at {db_path} - nothing to migrate.")

    first_new_id = {}
    for spec in args.first_new_id:
        table, _, value = spec.partition("=")
        if table not in TABLES or not value.isdigit():
            sys.exit(f"Bad --first-new-id '{spec}': expected one of {TABLES} as TABLE=ID")
        first_new_id[table] = int(value)

    conn = sqlite3.connect(db_path)
    try:
        if table_exists(conn, "schema_migrations"):
            done = conn.execute(
                "SELECT applied_at FROM schema_migrations WHERE name=?", (MIGRATION_NAME,)
            ).fetchone()
            if done:
                sys.exit(f"Already applied on {done[0]}. Refusing to shift timestamps a second time.")

        plan = {}
        for table in TABLES:
            if not table_exists(conn, table):
                continue
            rows = conn.execute(f"SELECT id, timestamp FROM {table} WHERE timestamp IS NOT NULL").fetchall()
            updates = []
            for row_id, stored in rows:
                if row_id >= first_new_id.get(table, float("inf")):
                    continue
                original = datetime.fromisoformat(stored)
                updates.append((row_id, (original - IST_OFFSET).strftime(STORED_FORMAT), stored))
            plan[table] = (updates, len(rows))

        for table, (updates, total) in plan.items():
            print(f"{table}: {len(updates)} of {total} rows will be shifted by -5h30m")
            if updates:
                _, new, old = updates[0]
                print(f"    e.g. {old}  ->  {new}")

        if args.dry_run:
            print("Dry run - nothing was changed.")
            return

        backup = db_path.with_name(db_path.name + ".pre-utc.bak")
        if backup.exists():
            sys.exit(f"Backup {backup} already exists - move it aside first so it isn't overwritten.")
        shutil.copy2(db_path, backup)
        print(f"Backup saved to {backup}")

        with conn:  # one transaction: commit on success, roll back on any error
            for table, (updates, _) in plan.items():
                conn.executemany(
                    f"UPDATE {table} SET timestamp=? WHERE id=?",
                    [(new, row_id) for row_id, new, _ in updates],
                )
            conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT)"
            )
            conn.execute(
                "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
                (MIGRATION_NAME, datetime.now(timezone.utc).isoformat(timespec="seconds")),
            )
        print("Done. Timestamps are now UTC.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
