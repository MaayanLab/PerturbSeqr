import gzip
import json
import tempfile
import unittest
from pathlib import Path

from perturbseqr_ingest.library_manifest import compound_cid, content_hash, inspect_input, validate_manifest
from perturbseqr_ingest.library_manager import build, verify_bundle


class LibraryIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.manifest = {"schemaVersion": 1, "slug": "test-library", "displayName": "Test Library", "license": None,
                         "category": "drug", "resource": {"key": "test"}, "version": "1", "description": "Fixture",
                         "input": {"gmt": "input.gmt", "organism": "human", "geneIdentifiers": "symbol",
                                   "compoundLabels": "names-and-pubchem-cids"}}

    def write(self, text):
        (self.root / "input.gmt").write_text(text)

    def test_preparation_and_pair_accounting_preserve_small_unpaired_sets(self):
        self.manifest["input"]["preparation"] = {"fields": ["perturbation", "cell_line", "cell_type", "concentration"],
                                                 "defaults": {"timepoint": ""}}
        self.write("5743::THP-1::::10uM up\t\tStat3\tSTAT3\n5743::THP-1::::10uM down\t\tTP53\nDrug::THP-1::::10uM up\t\tMYC\n")
        records, report = inspect_input(self.manifest, self.root)
        self.assertEqual(records[0]["term"], "5743::THP-1::::::10uM up")
        self.assertEqual(records[0]["genes"], ["STAT3"])
        self.assertEqual((report["geneSets"], report["pairedSignatures"], report["unpairedSignatures"]), (3, 1, 1))
        self.assertEqual(report["duplicateGenesRemoved"], 1)
        self.manifest["pairing"] = "require-complete"
        with self.assertRaisesRegex(ValueError, "one-direction"):
            inspect_input(self.manifest, self.root)

    def test_cid_interpretation_is_contextual(self):
        self.assertIsNone(compound_cid("5743", "names"))
        self.assertEqual(compound_cid("5743", "names-and-pubchem-cids"), "5743")
        self.assertEqual(compound_cid("CID:5743", "names"), "5743")
        self.assertIsNone(compound_cid("0", "names-and-pubchem-cids"))
        self.assertIsNone(compound_cid("5743-salt", "names-and-pubchem-cids"))

    def test_content_hash_remains_compatible_with_legacy_ingestion(self):
        import uuid
        expected = str(uuid.uuid5(uuid.UUID(int=0), 'MYC\tSTAT3'))
        self.assertEqual(content_hash(['STAT3', 'MYC', 'STAT3']), expected)

    def test_supplied_compound_identity_is_used_without_reference_lookups(self):
        self.write("Drug::THP-1::::::10uM up\t\tSTAT3\n5743::THP-1::::::10uM down\t\tMYC\n")
        mapping = self.root / 'compounds.csv'
        mapping.write_text('label,cid,name\nDrug,1234,Readable drug\n5743,5743,Dexamethasone\n')
        self.manifest['input']['compoundMetadata'] = {
            'path': 'compounds.csv', 'labelColumn': 'label', 'cidColumn': 'cid', 'nameColumn': 'name'}
        path = self.root / 'manifest.json'
        path.write_text(json.dumps(self.manifest))
        bundle = verify_bundle(build(path, self.root / 'out', offline=True))
        self.assertEqual(bundle['report']['sourceMappedCompounds'], 2)
        drug = next(row for row in bundle['compounds'] if row['label'] == 'Drug')
        self.assertEqual((drug['cid'], drug['name'], drug['resolution']), ('1234', 'Readable drug', 'supplied-metadata'))
        self.assertIn('CID:1234', drug['aliases'])
        # Mapping content participates in revision identity even without an explicit checksum.
        mapping.write_text('label,cid,name\nDrug,4321,Other drug\n5743,5743,Dexamethasone\n')
        replacement = verify_bundle(build(path, self.root / 'out', offline=True))
        self.assertNotEqual(bundle['identity'], replacement['identity'])

    def test_source_cids_cannot_conflict_with_explicit_numeric_labels(self):
        self.write('5743::THP-1::::::10uM up\t\tSTAT3\n')
        (self.root / 'compounds.csv').write_text('label,cid\n5743,1234\n')
        self.manifest['input']['compoundMetadata'] = {'path': 'compounds.csv', 'labelColumn': 'label', 'cidColumn': 'cid'}
        with self.assertRaisesRegex(ValueError, 'Explicit CID conflicts'):
            inspect_input(self.manifest, self.root)

    def test_companion_checksum_and_declared_container_format(self):
        import hashlib
        self.write('5743::THP-1::::::10uM up\t\tSTAT3\n')
        payload = self.root / 'stats.bin'
        payload.write_bytes(b'synthetic binary artifact for format preservation')
        self.manifest['artifacts'] = [{'kind': 'full_signatures', 'path': 'stats.bin', 'format': 'h5ad.zip',
                                      'sha256': hashlib.sha256(payload.read_bytes()).hexdigest()}]
        path = self.root / 'manifest.json'
        path.write_text(json.dumps(self.manifest))
        bundle = verify_bundle(build(path, self.root / 'out', offline=True))
        self.assertEqual(next(a for a in bundle['artifacts'] if a['kind'] == 'full_signatures')['format'], 'h5ad.zip')
        payload.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'Companion artifact checksum'):
            inspect_input(self.manifest, self.root)

    def test_rejects_duplicate_canonical_terms_and_malformed_input(self):
        term = "Drug::THP-1::::::10uM up"
        self.write(f"{term}\t\tSTAT3\n{term}\t\tMYC\n")
        with self.assertRaisesRegex(ValueError, "Duplicate canonical"):
            inspect_input(self.manifest, self.root)
        self.write("Drug::THP-1::::10uM up\t\tSTAT3\n")
        with self.assertRaisesRegex(ValueError, "canonical fields"):
            inspect_input(self.manifest, self.root)
        self.write("")
        with self.assertRaisesRegex(ValueError, "no gene sets"):
            inspect_input(self.manifest, self.root)

    def test_checksum_and_explicit_default_provenance(self):
        self.write("Drug::THP-1::::::10uM up\t\tSTAT3\n")
        self.manifest["input"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "checksum"):
            inspect_input(self.manifest, self.root)
        self.manifest["input"]["preparation"] = {"fields": ["perturbation"], "defaults": {
            "cell_line": "THP-1", "cell_type": "", "timepoint": "", "concentration": ""}}
        with self.assertRaisesRegex(ValueError, "provenance"):
            validate_manifest(self.manifest)

    def test_build_is_verified_idempotent_and_templates_never_become_files(self):
        self.write("5743::THP-1::::::10uM up\t\tSTAT3\n")
        self.manifest["artifacts"] = [{"kind": "full_signatures", "status": "template", "path": "fake-does-not-exist.tsv"}]
        manifest_path = self.root / "manifest.json"
        manifest_path.write_text(json.dumps(self.manifest))
        resolved = build(manifest_path, self.root / "out", offline=True)
        bundle = verify_bundle(resolved)
        self.assertEqual(build(manifest_path, self.root / "out", offline=True), resolved)
        self.assertEqual(bundle["compounds"][0]["cid"], "5743")
        template = next(a for a in bundle["artifacts"] if a["kind"] == "full_signatures")
        self.assertIsNone(template["path"])
        gmt = next(a for a in bundle["artifacts"] if a["kind"] == "gmt")
        self.assertEqual(gzip.decompress((resolved.parent / gmt["path"]).read_bytes()), b"5743::THP-1::::::10uM up\t\tSTAT3\n")
        (resolved.parent / gmt["path"]).write_bytes(b"corrupt")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            verify_bundle(resolved)

    def test_retry_cannot_reclassify_a_restricted_companion_as_public(self):
        self.write("Drug::THP-1::::::10uM up\t\tSTAT3\n")
        (self.root / "private.csv").write_text("gene,logFC\nSTAT3,1\n")
        self.manifest["artifacts"] = [
            {"kind": "full_signatures", "path": "private.csv", "distribution": "restricted"},
            {"kind": "full_signatures", "url": "https://example.org/private.csv", "distribution": "restricted"},
        ]
        path = self.root / "manifest.json"
        path.write_text(json.dumps(self.manifest))
        resolved = build(path, self.root / "out", offline=True)
        original = verify_bundle(resolved)
        resolved.unlink()  # Simulate interruption after copying companions but before final receipt.
        retry = verify_bundle(build(path, self.root / "out", offline=True))
        self.assertEqual(original["identity"], retry["identity"])
        self.assertEqual(len(original["artifacts"]), len(retry["artifacts"]))
        private = [a for a in retry["artifacts"] if a["kind"] == "full_signatures"]
        self.assertEqual([a["status"] for a in private], ["restricted", "restricted"])
        self.assertNotIn("url", private[1])


if __name__ == "__main__":
    unittest.main()
