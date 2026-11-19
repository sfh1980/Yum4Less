#!/usr/bin/env python3
"""No-network checks for osm-refresh. Run inside the yum4less-osm image."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
import urllib.parse
from pathlib import Path

FIXTURE_XML = Path(__file__).resolve().parent / "fixtures" / "grocery-places.osm"
SCRIPT = Path(os.environ.get("OSM_REFRESH_BIN", "/usr/local/bin/osm-refresh"))
SOURCE_TIMESTAMP = "2024-06-01T00:00:00Z"
PEAK_RSS_KB: dict[str, int] = {}

KEPT_NAMES = (
    "Fixture Market",
    "Fixture Greens",
    "Fixture Bakery",
    "Fixture Butcher",
    "Fixture Seafood",
    "Fixture Deli",
    "Fixture Wholesale",
    "Fixture Department",
)
DROPPED_NAMES = (
    "Fixture Convenience",
    "Fixture Convenience Way",
    "Fixture Fuel",
)


def write_executable(path: Path, body: str) -> None:
    path.write_text(textwrap.dedent(body).lstrip("\n"), encoding="utf-8")
    path.chmod(0o755)


def build_fixture_pbf(directory: Path) -> Path:
    pbf = directory / "fixture.osm.pbf"
    subprocess.run(
        [
            "osmium",
            "cat",
            str(FIXTURE_XML),
            "-o",
            str(pbf),
            "--overwrite",
            "--output-header",
            f"osmosis_replication_timestamp={SOURCE_TIMESTAMP}",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    digest = hashlib.md5(pbf.read_bytes()).hexdigest()
    (directory / "fixture.osm.pbf.md5").write_text(f"{digest}  fixture.osm.pbf\n", encoding="utf-8")
    return pbf


def file_url(path: Path) -> str:
    return "file://" + urllib.parse.quote(str(path))


def base_env(data_dir: Path, source_pbf: Path) -> dict[str, str]:
    env = os.environ.copy()
    for key in ("http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"):
        env.pop(key, None)
    env.update(
        {
            "OSM_DATA_DIR": str(data_dir),
            "OSM_SOURCE_URL": file_url(source_pbf),
            "OSM_SOURCE_MD5_URL": file_url(source_pbf.with_name(source_pbf.name + ".md5")),
            "OSM_FULL_REFRESH_DAYS": "60",
            "OSM_UPDATE_MAX_MB": "2048",
            "OSM_PYOSMIUM_BIN": "pyosmium-up-to-date",
            "OSM_OSMIUM_BIN": "osmium",
        }
    )
    return env


def run_refresh(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        env=env,
        capture_output=True,
        text=True,
    )


def grocery_text(path: Path) -> str:
    completed = subprocess.run(
        ["osmium", "cat", "-f", "osm", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def measure_filter_peak(source_pbf: Path, work: Path) -> int:
    output = work / "peak-grocery.osm.pbf"
    command = [
        "osmium",
        "tags-filter",
        "--overwrite",
        "-o",
        str(output),
        str(source_pbf),
        "nwr/shop=supermarket",
        "nwr/shop=greengrocer",
        "nwr/shop=bakery",
        "nwr/shop=butcher",
        "nwr/shop=seafood",
        "nwr/shop=deli",
        "nwr/shop=wholesale",
        "nwr/shop=department_store",
    ]
    pid = os.fork()
    if pid == 0:
        os.execvp(command[0], command)
    _pid, status, usage = os.wait4(pid, 0)
    if os.waitstatus_to_exitcode(status) != 0:
        raise RuntimeError("peak-memory filter failed")
    PEAK_RSS_KB["value"] = int(usage.ru_maxrss)
    return int(usage.ru_maxrss)


class OsmRefreshTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.fixture_dir = self.root / "fixture"
        self.fixture_dir.mkdir()
        self.source_pbf = build_fixture_pbf(self.fixture_dir)
        self.data = self.root / "data"
        self.data.mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_download_keeps_grocery_and_drops_convenience_and_fuel(self) -> None:
        if "value" not in PEAK_RSS_KB:
            measure_filter_peak(self.source_pbf, self.root)
        completed = run_refresh(base_env(self.data, self.source_pbf))
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        grocery = self.data / "grocery" / "us-grocery.osm.pbf"
        self.assertTrue(grocery.is_file())
        self.assertFalse((self.data / "grocery" / "us-grocery.osm.pbf.tmp").exists())
        self.assertFalse((self.data / "us-latest.osm.pbf.partial").exists())
        text = grocery_text(grocery)
        for name in KEPT_NAMES:
            self.assertIn(name, text)
        for name in DROPPED_NAMES:
            self.assertNotIn(name, text)
        status = json.loads((self.data / "grocery" / "status.json").read_text(encoding="utf-8"))
        self.assertEqual(status["source_timestamp"], SOURCE_TIMESTAMP)
        self.assertIsNone(status["last_error"])
        self.assertTrue(status["last_success"])
        self.assertGreater(status["sizes"]["source_bytes"], 0)
        self.assertGreater(status["sizes"]["grocery_bytes"], 0)
        self.assertGreater(status["object_counts"]["grocery"]["nodes"], 0)
        self.assertGreaterEqual(status["duration_seconds"], 0)
        self.assertEqual(status["mode"], "download")

    def test_failed_filter_leaves_the_old_grocery_file(self) -> None:
        first = run_refresh(base_env(self.data, self.source_pbf))
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        grocery = self.data / "grocery" / "us-grocery.osm.pbf"
        original = grocery.read_bytes()
        full = self.data / "us-latest.osm.pbf"
        os.utime(full, None)
        fake = self.root / "fail-osmium"
        write_executable(
            fake,
            """
            #!/usr/bin/env python3
            import sys
            from pathlib import Path
            args = sys.argv[1:]
            if "tags-filter" in args and "-o" in args:
                Path(args[args.index("-o") + 1]).write_bytes(b"partial-grocery")
            sys.exit(1)
            """,
        )
        env = base_env(self.data, self.source_pbf)
        env["OSM_OSMIUM_BIN"] = str(fake)
        env["OSM_PYOSMIUM_BIN"] = str(self._pyosmium_that_copies(exit_code=0))
        completed = run_refresh(env)
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(grocery.read_bytes(), original)
        self.assertFalse((self.data / "grocery" / "us-grocery.osm.pbf.tmp").exists())
        self.assertIn("old grocery file left in place", completed.stdout)
        status = json.loads((self.data / "grocery" / "status.json").read_text(encoding="utf-8"))
        self.assertIsNotNone(status["last_error"])
        self.assertTrue(status["last_success"])

    def test_failed_update_keeps_the_old_grocery_file(self) -> None:
        first = run_refresh(base_env(self.data, self.source_pbf))
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        grocery = self.data / "grocery" / "us-grocery.osm.pbf"
        original = grocery.read_bytes()
        os.utime(self.data / "us-latest.osm.pbf", None)
        env = base_env(self.data, self.source_pbf)
        env["OSM_PYOSMIUM_BIN"] = str(self._pyosmium_that_exits(2))
        env["OSM_SOURCE_URL"] = "file:///tmp/yum4less-osm-missing.osm.pbf"
        env["OSM_SOURCE_MD5_URL"] = "file:///tmp/yum4less-osm-missing.osm.pbf.md5"
        completed = run_refresh(env)
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("falling back to one fresh download", completed.stdout)
        self.assertEqual(grocery.read_bytes(), original)
        self.assertFalse((self.data / "us-latest.osm.pbf.partial").exists())
        self.assertFalse((self.data / "us-latest.osm.pbf.updating").exists())
        status = json.loads((self.data / "grocery" / "status.json").read_text(encoding="utf-8"))
        self.assertIn("fallback download failed", status["last_error"])

    def test_update_failure_falls_back_to_one_local_download(self) -> None:
        shutil.copyfile(self.source_pbf, self.data / "us-latest.osm.pbf")
        os.utime(self.data / "us-latest.osm.pbf", None)
        env = base_env(self.data, self.source_pbf)
        env["OSM_PYOSMIUM_BIN"] = str(self._pyosmium_that_exits(2))
        env["OSM_UPDATE_MAX_MB"] = "32"
        completed = run_refresh(env)
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertEqual(completed.stdout.count("falling back to one fresh download"), 1)
        self.assertIn("Fixture Market", grocery_text(self.data / "grocery" / "us-grocery.osm.pbf"))
        self.assertNotIn(
            "Fixture Convenience",
            grocery_text(self.data / "grocery" / "us-grocery.osm.pbf"),
        )

    def test_size_cap_is_passed_and_a_partial_update_is_kept(self) -> None:
        shutil.copyfile(self.source_pbf, self.data / "us-latest.osm.pbf")
        os.utime(self.data / "us-latest.osm.pbf", None)
        seen = self.root / "seen-size.txt"
        fake = self.root / "partial-pyosmium"
        write_executable(
            fake,
            f"""
            #!/usr/bin/env python3
            import sys
            from pathlib import Path
            args = sys.argv[1:]
            size = args[args.index("--size") + 1]
            outfile = args[args.index("--outfile") + 1]
            source = args[-1]
            Path({str(seen)!r}).write_text(size, encoding="utf-8")
            Path(outfile).write_bytes(Path(source).read_bytes())
            sys.exit(1)
            """,
        )
        env = base_env(self.data, self.source_pbf)
        env["OSM_PYOSMIUM_BIN"] = str(fake)
        env["OSM_UPDATE_MAX_MB"] = "32"
        env["OSM_SOURCE_URL"] = "file:///tmp/yum4less-osm-should-not-download.osm.pbf"
        env["OSM_SOURCE_MD5_URL"] = "file:///tmp/yum4less-osm-should-not-download.osm.pbf.md5"
        completed = run_refresh(env)
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertEqual(seen.read_text(encoding="utf-8"), "32")
        self.assertIn("download cap", completed.stdout)
        self.assertNotIn("falling back", completed.stdout)

    def test_lock_prevents_a_second_run(self) -> None:
        import fcntl

        lock = (self.data / ".osm-refresh.lock").open("a+", encoding="utf-8")
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            completed = run_refresh(base_env(self.data, self.source_pbf))
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
            lock.close()
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("lock held", completed.stdout)
        self.assertFalse((self.data / "grocery" / "us-grocery.osm.pbf").exists())

    def _pyosmium_that_exits(self, exit_code: int) -> Path:
        path = self.root / f"pyosmium-exit-{exit_code}"
        write_executable(
            path,
            f"""
            #!/usr/bin/env python3
            import sys
            sys.exit({exit_code})
            """,
        )
        return path

    def _pyosmium_that_copies(self, exit_code: int) -> Path:
        path = self.root / "pyosmium-copy"
        write_executable(
            path,
            f"""
            #!/usr/bin/env python3
            import sys
            from pathlib import Path
            args = sys.argv[1:]
            outfile = args[args.index("--outfile") + 1]
            source = args[-1]
            Path(outfile).write_bytes(Path(source).read_bytes())
            sys.exit({exit_code})
            """,
        )
        return path


if __name__ == "__main__":
    program = unittest.main(exit=False, verbosity=2)
    peak = PEAK_RSS_KB.get("value")
    if peak is not None:
        print(f"filter_peak_rss_kb={peak}")
    sys.exit(0 if program.result.wasSuccessful() else 1)
