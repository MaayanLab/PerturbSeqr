"""Exercise job behavior at the database, migration, storage and enrichment boundaries."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

from perturbseqr_ingest import library_setup


class LibrarySetupTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = self.root / "release.json"
        self.path.write_text(json.dumps({
            "schemaVersion": 1, "slug": "example", "displayName": "Example",
            "category": "drug", "resource": {"key": "example"}, "version": "1",
            "description": "Fixture", "license": None,
            "input": {"gmt": "s3://example-bucket/release.gmt.gz", "sha256": "1" * 64,
                      "organism": "human", "geneIdentifiers": "symbol"},
        }))
        self.conn = MagicMock()
        self.cursor = self.conn.cursor.return_value.__enter__.return_value
        self.cursor.fetchone.return_value = (True,)
        self.steps = Mock()
        patches = {
            "connection": Mock(return_value=self.conn), "existing_manifests": Mock(return_value=[{"slug": "legacy"}]),
            "backfill_existing": self.steps.backfill, "check_enrichment": self.steps.compatibility,
            "stage_remote": self.steps.stage, "index": self.steps.index, "publish": self.steps.publish,
        }
        patcher = patch.multiple(library_setup, **patches)
        patcher.start()
        self.addCleanup(patcher.stop)
        for patcher in (patch("subprocess.run", self.steps.migrate),
                        patch.dict("os.environ", {"ENRICH_URL": "http://enrich:8000"}), patch("builtins.print")):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.steps.backfill.return_value = {"registered": ["legacy"], "skipped": []}
        self.steps.stage.return_value = "revision"
        self.steps.index.return_value = "candidate"

    def test_catalog_only_supports_the_legacy_enrichment_service(self):
        library_setup.run_setup(self.root, self.root, [])
        self.assertEqual([call[0] for call in self.steps.mock_calls], ["migrate", "backfill"])
        self.conn.close.assert_called_once()

    def test_migration_failure_stops_before_backfill_and_publication(self):
        self.steps.migrate.side_effect = subprocess.CalledProcessError(1, "dbmate")
        with self.assertRaises(subprocess.CalledProcessError):
            library_setup.run_setup(self.root, self.root, [self.path])
        self.steps.backfill.assert_not_called()
        self.steps.publish.assert_not_called()

    def test_release_is_gated_by_service_compatibility_and_verified_index(self):
        self.steps.compatibility.side_effect = ValueError("old service")
        with self.assertRaisesRegex(ValueError, "old service"):
            library_setup.run_setup(self.root, self.root, [self.path])
        self.steps.stage.assert_not_called()

        self.steps.reset_mock()
        self.steps.compatibility.side_effect = None
        self.cursor.fetchone.side_effect = [(True,), ("staged", "previous")]
        self.steps.index.side_effect = ValueError("index verification failed")
        with self.assertRaisesRegex(ValueError, "index verification failed"):
            library_setup.run_setup(self.root, self.root, [self.path])
        self.assertEqual([call[0] for call in self.steps.mock_calls], ["migrate", "backfill", "compatibility", "stage", "index"])
        self.steps.publish.assert_not_called()

        self.steps.reset_mock()
        self.steps.index.side_effect = None
        self.cursor.fetchone.side_effect = [(True,), ("staged", "previous")]
        library_setup.run_setup(self.root, self.root, [self.path])
        self.steps.publish.assert_called_once_with("candidate")

    def test_retry_keeps_the_existing_active_generation(self):
        self.cursor.fetchone.side_effect = [(True,), ("published", "revision")]
        library_setup.run_setup(self.root, self.root, [self.path])
        self.steps.index.assert_not_called()
        self.steps.publish.assert_not_called()
