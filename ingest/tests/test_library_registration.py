import gzip
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from perturbseqr_ingest.library_manager import build, read_remote_manifest, upload_public_bundle
from perturbseqr_ingest.library_registration import downloadable_artifacts, existing_manifests


class LibraryRegistrationTests(unittest.TestCase):
    def test_legacy_inventory_keeps_restricted_downloads_unlinked(self):
        root = Path(__file__).resolve().parents[2] / "libraries"
        inventory = {m["slug"]: m for m in existing_manifests(root)}
        self.assertEqual(len(inventory), 16)
        self.assertEqual(len({m["resource"]["key"] for m in inventory.values()}), 12)
        for slug, manifest in inventory.items():
            gmt, = (a for a in downloadable_artifacts(manifest) if a["kind"] == "gmt")
            if slug == "ginkgo-bioworks":
                self.assertEqual(gmt["status"], "restricted")
                self.assertNotIn("url", gmt)
            else:
                self.assertEqual(gmt["s3"], manifest["input"]["gmt"])
                self.assertGreater(gmt["bytes"], 0)
                self.assertTrue(gmt["url"].startswith("https://perturbseqr.s3.amazonaws.com/"))

    def test_upload_then_read_manifest_does_not_transfer_full_signatures_again(self):
        import requests
        from botocore.exceptions import ClientError

        objects = {}

        def head_object(Bucket, Key):
            if (Bucket, Key) not in objects:
                raise ClientError({"ResponseMetadata": {"HTTPStatusCode": 404}}, "HeadObject")
            data, metadata = objects[Bucket, Key]
            return {"ContentLength": len(data), "Metadata": metadata}

        def upload_file(path, bucket, key, ExtraArgs):
            objects[bucket, key] = (Path(path).read_bytes(), ExtraArgs["Metadata"])

        def head(url, **kwargs):
            data, metadata = objects["fixture-bucket", url.split(".amazonaws.com/", 1)[1]]
            return Mock(status_code=200, headers={"Content-Length": str(len(data)), "x-amz-meta-sha256": metadata["sha256"]})

        def get(url, **kwargs):
            self.assertFalse(url.endswith("full.h5ad"), "Full signature file is a link, not ingestion input")
            data, _ = objects["fixture-bucket", url.split(".amazonaws.com/", 1)[1]]
            response = requests.Response()
            response.status_code = 200
            response._content = data
            response._content_consumed = True
            return response

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "raw.gmt").write_text("5743::THP-1::::::10uM up\t\tSTAT3\n")
            (root / "full.h5ad").write_bytes(b"fake matrix for transport test")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({
                "schemaVersion": 1, "slug": "example", "displayName": "Example", "description": "Test data", "category": "drug", "license": None,
                "version": "1", "resource": {"key": "example"}, "input": {
                    "gmt": "raw.gmt", "organism": "human", "geneIdentifiers": "symbol", "compoundLabels": "names-and-pubchem-cids",
                }, "artifacts": [{"kind": "full_signatures", "path": "full.h5ad"}],
            }))
            bundle = build(manifest, root / "build", offline=True)
            storage = Mock(head_object=Mock(side_effect=head_object), upload_file=Mock(side_effect=upload_file))
            with patch("perturbseqr_ingest.library_manager.storage", return_value=(storage, "fixture-bucket")), patch("requests.head", head), patch("requests.get", get):
                uploaded = upload_public_bundle(bundle, "fixture-bucket")
                uploaded_count = storage.upload_file.call_count
                self.assertEqual(upload_public_bundle(bundle, "fixture-bucket"), uploaded)
                self.assertEqual(storage.upload_file.call_count, uploaded_count)
                remote, records, report, artifacts, compounds = read_remote_manifest(uploaded)
                self.assertEqual(remote["input"]["gmt"], "s3://fixture-bucket/example.gmt.gz")
                self.assertTrue(all("/" not in key for _, key in objects))
                self.assertFalse(any(key.endswith(("validation.json", "compounds.json")) for _, key in objects))
                self.assertIn(remote["input"]["compoundAnnotations"]["s3"], {a["s3"] for a in artifacts})
                self.assertEqual(report["geneSets"], 1)
                self.assertEqual(records[0]["genes"], ["STAT3"])
                self.assertEqual(compounds[0]["cid"], "5743")
                self.assertTrue(next(a for a in artifacts if a["kind"] == "full_signatures")["url"].endswith("/example-full.h5ad"))
                key = remote["input"]["gmt"].split("/", 3)[3]
                wrong_gmt = gzip.compress(b"5743::THP-1::::::10uM up\t\tTP53\n")
                objects["fixture-bucket", key] = (wrong_gmt, {"sha256": hashlib.sha256(wrong_gmt).hexdigest()})
                with self.assertRaisesRegex(ValueError, "differs from manifest"):
                    read_remote_manifest(uploaded)
