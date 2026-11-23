"""Optional real S3/enrich smoke test; every URL must refer to disposable local services."""
import json
import os
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch


@unittest.skipUnless(os.environ.get("LIBRARY_TEST_S3_ENDPOINT") and os.environ.get("LIBRARY_TEST_ENRICH_URL")
                     and os.environ.get("LIBRARY_TEST_DATABASE_URL"), "Set all three LIBRARY_TEST_* service URLs for lifecycle smoke tests")
class LibraryLifecycleTests(unittest.TestCase):
    def test_stage_index_publish_replace_and_rollback(self):
        import psycopg2
        import requests
        from perturbseqr_ingest.library_manager import build, stage, index, publish, rollback, storage
        from perturbseqr_ingest.library_manifest import load_manifest
        for variable in ('LIBRARY_TEST_S3_ENDPOINT', 'LIBRARY_TEST_ENRICH_URL', 'LIBRARY_TEST_DATABASE_URL'):
            self.assertTrue('127.0.0.1' in os.environ[variable] or 'localhost' in os.environ[variable], "Smoke tests require local services")
        environment = {"DATABASE_URL": os.environ['LIBRARY_TEST_DATABASE_URL'],
                       "INGEST_S3_ENDPOINT": os.environ['LIBRARY_TEST_S3_ENDPOINT'],
                       "ENRICH_URL": os.environ['LIBRARY_TEST_ENRICH_URL'],
                       "LIBRARY_S3_BUCKET": "library-workflow-test", "AWS_REGION": "us-east-1",
                       "AWS_ACCESS_KEY_ID": "library-tests", "AWS_SECRET_ACCESS_KEY": "library-tests-password"}
        with patch.dict(os.environ, environment), tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            client, bucket = storage()
            if bucket not in [b['Name'] for b in client.list_buckets()['Buckets']]:
                client.create_bucket(Bucket=bucket)
            slug = 'lifecycle-' + uuid.uuid4().hex[:12]
            manifest = {"schemaVersion": 1, "slug": slug, "displayName": 'Lifecycle ' + slug, "license": None,
                        "category": "drug", "resource": {"key": "lifecycle"}, "description": "Synthetic lifecycle fixture",
                        "version": "1", "input": {"gmt": "input.gmt", "organism": "human", "geneIdentifiers": "symbol",
                                                  "compoundLabels": "names-and-pubchem-cids"},
                        "artifacts": [{"kind": "full_signatures", "status": "template", "path": "fake.tsv"}]}
            path = root / 'manifest.json'
            path.write_text(json.dumps(manifest))
            load_manifest(path)
            (root / 'input.gmt').write_text('5743::THP-1::::::10uM up\t\tSTAT3\tMYC\n5743::THP-1::::::10uM down\t\tTP53\nUnpaired::THP-1::::::10uM up\t\tMYC\n')
            bundle = build(path, root / 'out', offline=True)
            revision = stage(bundle)
            self.assertEqual(stage(bundle), revision)
            def read(sql, args=()):
                with psycopg2.connect(environment['DATABASE_URL']) as db, db.cursor() as cur:
                    cur.execute('SET LOCAL ROLE guest')
                    cur.execute(sql, args)
                    return cur.fetchall()
            previous = read('SELECT id FROM app_public.current_background()')[0][0]
            self.assertEqual(read('SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s', [revision])[0][0], 0)
            generation = index(revision)
            self.assertEqual(str(read('SELECT id FROM app_public.current_background()')[0][0]), str(previous))
            self.assertEqual(str(publish(generation)), generation)
            self.assertEqual(read('SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s', [revision])[0][0], 3)
            self.assertEqual(index(revision), generation)
            self.assertEqual(str(publish(generation)), generation)
            catalog = read('SELECT app_public.library_catalog()')[0][0]
            entry = next(l for l in catalog['libraries'] if l['slug'] == slug)
            self.assertEqual(entry['counts']['pairedSignatures'], 1)
            self.assertNotIn('input', entry['manifest'])
            template = next(a for a in entry['artifacts'] if a['kind'] == 'full_signatures')
            self.assertFalse(template.get('objectKey'))
            public = next(a for a in entry['artifacts'] if a['kind'] == 'gmt')
            self.assertEqual(read('SELECT count FROM app_public.increment_file_download(%s)', [public['objectKey']])[0][0], 1)
            self.assertEqual(client.get_object(Bucket=bucket, Key=public['objectKey'])['Body'].read(),
                             (bundle.parent / (slug + '.gmt.gz')).read_bytes())
            manifest['version'] = '2'
            path.write_text(json.dumps(manifest))
            (root / 'input.gmt').write_text('5743::THP-1::::::10uM up\t\tSTAT3\n5743::THP-1::::::10uM down\t\tTP53\n')
            replacement = stage(build(path, root / 'out', offline=True))
            self.assertEqual(read('SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s', [revision])[0][0], 3)
            newer = index(replacement)
            publish(newer)
            self.assertEqual(read('SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s', [revision])[0][0], 0)
            self.assertEqual(read('SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s', [replacement])[0][0], 2)
            rollback(generation)
            self.assertEqual(read('SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s', [revision])[0][0], 3)
            text = requests.get(environment['ENRICH_URL'] + '/latest/gmt', timeout=30)
            text.raise_for_status()
            self.assertIn('Unpaired::THP-1', text.text)
            # Leave only the seeded baseline active for other test runs.
            rollback(str(previous))


if __name__ == '__main__':
    unittest.main()
