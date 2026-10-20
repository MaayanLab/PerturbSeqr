import contextlib
import io
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from perturbseqr_ingest import db_utils, ingest


class S3StorageTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.constructor = patch.object(db_utils, "Minio")
        self.minio = self.constructor.start()
        self.addCleanup(self.constructor.stop)

    def configure_aws(self):
        os.environ.update({
            "INGEST_S3_BUCKET": "perturbseqr",
            "AWS_ACCESS_KEY_ID": "test-access-key",
            "AWS_SECRET_ACCESS_KEY": "test-secret-key",
        })

    def test_legacy_minio_configuration_is_preserved(self):
        os.environ.update({
            "MINIO_ENDPOINT": "perturbseqr-minio:9000",
            "MINIO_ROOT_USER": "local-user",
            "MINIO_ROOT_PASSWORD": "local-password",
            "AWS_ACCESS_KEY_ID": "unrelated-access-key",
            "AWS_SECRET_ACCESS_KEY": "unrelated-secret-key",
        })
        db_utils.get_s3_client()
        self.minio.assert_called_once_with(
            "perturbseqr-minio:9000", access_key="local-user",
            secret_key="local-password", secure=False,
        )
        self.assertEqual(db_utils.get_s3_bucket(), "data")

    def test_aws_uses_explicit_bucket_tls_and_standard_credentials(self):
        self.configure_aws()
        os.environ["MINIO_ROOT_PASSWORD"] = "unused-local-password"
        db_utils.get_s3_client()
        self.minio.assert_called_once_with(
            "s3.us-east-1.amazonaws.com", access_key="test-access-key",
            secret_key="test-secret-key", session_token=None,
            secure=True, region="us-east-1",
        )
        self.assertEqual(db_utils.get_s3_bucket(), "perturbseqr")

    def test_custom_endpoint_region_and_temporary_credentials(self):
        self.configure_aws()
        os.environ.update({
            "INGEST_S3_ENDPOINT": "s3.example.test:9000",
            "INGEST_S3_SECURE": "false",
            "AWS_DEFAULT_REGION": "us-west-2",
            "AWS_SESSION_TOKEN": "test-session-token",
        })
        db_utils.get_s3_client()
        self.minio.assert_called_once_with(
            "s3.example.test:9000", access_key="test-access-key",
            secret_key="test-secret-key", session_token="test-session-token",
            secure=False, region="us-west-2",
        )

    def test_missing_aws_credentials_do_not_fall_back_to_minio(self):
        self.configure_aws()
        del os.environ["AWS_SECRET_ACCESS_KEY"]
        os.environ["MINIO_ROOT_PASSWORD"] = "local-password"
        with self.assertRaisesRegex(ValueError, "AWS_SECRET_ACCESS_KEY"):
            db_utils.get_s3_client()
        self.minio.assert_not_called()

    def test_explicit_endpoint_requires_an_explicit_bucket(self):
        os.environ["INGEST_S3_ENDPOINT"] = "s3.us-east-1.amazonaws.com"
        with self.assertRaisesRegex(ValueError, "INGEST_S3_BUCKET"):
            db_utils.discover_s3_gmt_files()
        self.minio.assert_not_called()

    def test_invalid_tls_setting_is_rejected(self):
        self.configure_aws()
        os.environ["INGEST_S3_SECURE"] = "invalid"
        with self.assertRaisesRegex(ValueError, "INGEST_S3_SECURE"):
            db_utils.get_s3_client()
        self.minio.assert_not_called()

    def test_discovery_uses_aws_bucket_and_only_supported_root_gmts(self):
        self.configure_aws()
        client = self.minio.return_value
        client.list_objects.return_value = [SimpleNamespace(object_name=name) for name in [
            "lincs-l1000-cp.gmt.gz", "enrich/index.bin", "unknown.gmt.gz",
            "nested/cm4ai.gmt.gz", "cm4ai.gmt.gz",
        ]]
        self.assertEqual(db_utils.discover_s3_gmt_files(), [
            ("cm4ai.gmt.gz", "cm4ai"),
            ("lincs-l1000-cp.gmt.gz", "lincs-l1000-cp"),
        ])
        client.list_objects.assert_called_once_with("perturbseqr")

    def test_legacy_discovery_alias_uses_the_local_bucket(self):
        os.environ["MINIO_ROOT_PASSWORD"] = "local-password"
        self.minio.return_value.list_objects.return_value = []
        self.assertEqual(db_utils.discover_minio_gmt_files(), [])
        self.minio.return_value.list_objects.assert_called_once_with("data")

    def test_download_uses_configured_bucket_and_preserves_extension(self):
        self.configure_aws()
        with patch.object(db_utils.tempfile, "NamedTemporaryFile") as temporary:
            temporary.return_value.name = "/tmp/test-ingest.gmt.gz"
            path = db_utils.download_s3_gmt_file("cm4ai.gmt.gz")
        self.assertEqual(path, Path("/tmp/test-ingest.gmt.gz"))
        temporary.assert_called_once_with(delete=False, suffix=".gmt.gz")
        self.minio.return_value.fget_object.assert_called_once_with(
            "perturbseqr", "cm4ai.gmt.gz", str(path),
        )

    def test_download_compatibility_alias_preserves_bucket_override(self):
        self.configure_aws()
        with patch.object(db_utils.tempfile, "NamedTemporaryFile") as temporary:
            temporary.return_value.name = "/tmp/test-ingest.gmt.gz"
            db_utils.download_minio_gmt_file("cm4ai.gmt.gz", bucket="override")
        self.minio.return_value.fget_object.assert_called_once_with(
            "override", "cm4ai.gmt.gz", "/tmp/test-ingest.gmt.gz",
        )


class S3CommandTests(unittest.TestCase):
    def test_both_storage_flags_support_dry_run_without_database_access(self):
        for flag in ("--s3", "--minio"):
            with self.subTest(flag=flag), \
                 patch("sys.argv", ["ingest", "--batch", flag, "--dry-run"]), \
                 patch.object(ingest, "get_s3_bucket", return_value="perturbseqr"), \
                 patch.object(ingest, "discover_s3_gmt_files", return_value=[("cm4ai.gmt.gz", "cm4ai")]) as discover, \
                 patch.object(ingest, "get_conn") as connect, \
                 patch.object(ingest, "download_s3_gmt_file") as download, \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                ingest.main()
                discover.assert_called_once_with("perturbseqr")
                connect.assert_not_called()
                download.assert_not_called()
                self.assertIn("[DRY RUN]", output.getvalue())


if __name__ == "__main__":
    unittest.main()
