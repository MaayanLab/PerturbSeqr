"""Integration tests against an explicitly provided disposable PostgreSQL database."""
import os
import unittest
import uuid
from pathlib import Path


@unittest.skipUnless(os.environ.get("LIBRARY_TEST_DATABASE_URL"), "Set LIBRARY_TEST_DATABASE_URL to an empty disposable *_test database")
class LibraryDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg2
        cls.conn = psycopg2.connect(os.environ["LIBRARY_TEST_DATABASE_URL"])
        with cls.conn.cursor() as cur:
            cur.execute("SELECT current_database()")
            if not cur.fetchone()[0].endswith("_test"):
                raise ValueError("Integration tests require a disposable database ending in _test")
            cur.execute("SELECT to_regclass('app_public.library_revision')")
            if not cur.fetchone()[0]:
                for migration in sorted((Path(__file__).resolve().parents[2] / "db" / "migrations").glob("*.sql")):
                    if migration.name == "20261123000000_library_catalog.sql":
                        # Exercise backfill on existing data, not just a fresh empty install.
                        cur.execute("""INSERT INTO app_public.gene_set_library(id,name,description)
                                    VALUES('00000000-0000-0000-0000-000000000001','Ginkgo Bioworks','Existing licensed library');
                                    INSERT INTO app_public.gene(id,symbol) VALUES('00000000-0000-0000-0000-000000000002','STAT3');
                                    INSERT INTO app_public.gene_set(id,term,hash,gene_ids,n_gene_ids,library_id,perturbation)
                                    VALUES('00000000-0000-0000-0000-000000000003','Original::A549::::24H::1uM up',uuid_generate_v4(),
                                    '{"00000000-0000-0000-0000-000000000002":0}',1,'00000000-0000-0000-0000-000000000001','Original');
                                    INSERT INTO app_public.background(id,gene_ids,n_gene_ids,created)
                                    VALUES('00000000-0000-0000-0000-000000000004','{"00000000-0000-0000-0000-000000000002":null}',1,now() - interval '1 day'),
                                          ('00000000-0000-0000-0000-000000000005','{"00000000-0000-0000-0000-000000000002":null}',1,now());""")
                    sql = migration.read_text().split("-- migrate:down")[0].replace("-- migrate:up", "")
                    cur.execute(sql)
        cls.conn.commit()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def tearDown(self):
        self.conn.rollback()

    def candidate(self):
        from psycopg2.extras import Json
        library, revision, background = [str(uuid.uuid4()) for _ in range(3)]
        cur = self.conn.cursor()
        cur.execute("INSERT INTO app_public.gene_set_library(id,name,description,slug,category) VALUES (%s,%s,'test',%s,'drug')",
                    [library, library, "test-" + library])
        manifest = {"displayName": "Fixture " + library, "description": "Test", "category": "drug", "resource": {"key": "fixture"}}
        cur.execute("INSERT INTO app_public.library_revision(id,library_id,version,checksum,manifest,status) VALUES(%s,%s,'1','test',%s,'staged')",
                    [revision, library, Json(manifest)])
        cur.execute("SELECT id FROM app_public.current_background()")
        parent_row = cur.fetchone()
        parent = parent_row[0] if parent_row else None
        if parent:
            cur.execute("SELECT active_revision_id FROM app_public.gene_set_library WHERE active_revision_id IS NOT NULL")
            previous = [str(row[0]) for row in cur.fetchall()]
            if previous:
                cur.execute("INSERT INTO app_public.library_generation(id,revision_ids,candidate_revision_id,status,published_at) VALUES(%s,%s::uuid[],%s,'published',now()) ON CONFLICT(id) DO NOTHING",
                            [parent, previous, previous[0]])
        cur.execute("INSERT INTO app_public.background(id,gene_ids,n_gene_ids) VALUES(%s,'{}',0)", [background])
        cur.execute("INSERT INTO app_public.library_generation(id,revision_ids,candidate_revision_id,parent_background_id,status) VALUES(%s,%s::uuid[],%s,%s,'ready')",
                    [background, [revision], revision, parent])
        cur.execute("UPDATE app_public.library_generation SET revision_ids=revision_ids||ARRAY(SELECT active_revision_id FROM app_public.gene_set_library WHERE active_revision_id IS NOT NULL) WHERE id=%s", [background])
        cur.execute("INSERT INTO app_public.gene_set(term,hash,gene_ids,n_gene_ids,library_id,revision_id,perturbation,cid) VALUES('5743::THP-1::::::10uM up',%s,'{}',0,%s,%s,'5743','5743')",
                    [str(uuid.uuid4()), library, revision])
        cur.execute("INSERT INTO app_public.library_compound(revision_id,label,cid,metadata) VALUES(%s,'5743','5743',%s)",
                    [revision, Json({"aliases": ["Dexamethasone", "5743"], "name": "Dexamethasone", "fda_approved": True})])
        return library, revision, background

    def test_staging_is_hidden_from_all_public_paths_but_indexable(self):
        library, revision, background = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM app_private.library_index_rows(%s) WHERE cid='5743'", [background])
            self.assertEqual(cur.fetchone()[0], 1)
            cur.execute("SET LOCAL ROLE guest")
            cur.execute("SELECT count(*) FROM app_public.gene_set WHERE revision_id=%s", [revision])
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("SELECT count(*) FROM app_public.gene_set_library WHERE id=%s", [library])
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("SELECT count(*) FROM app_public.gene_set_term_search(ARRAY['5743']::varchar[])")
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("SELECT count(*) FROM app_public.library_compound WHERE revision_id=%s", [revision])
            self.assertEqual(cur.fetchone()[0], 0)
            cur.execute("SELECT count(*) FROM app_public.background WHERE id=%s", [background])
            self.assertEqual(cur.fetchone()[0], 0)

    def test_migration_preserves_existing_identities_and_counts(self):
        with self.conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE guest")
            cur.execute("SELECT name,active_revision_id=id FROM app_public.gene_set_library WHERE id='00000000-0000-0000-0000-000000000001'")
            self.assertEqual(cur.fetchone(), ('Ginkgo Bioworks', True))
            cur.execute("SELECT revision_id FROM app_public.gene_set WHERE id='00000000-0000-0000-0000-000000000003'")
            self.assertEqual(cur.fetchone(), (None,))
            cur.execute("SELECT count,total_count FROM app_public.gene_set_fda_counts WHERE id='00000000-0000-0000-0000-000000000003'")
            self.assertEqual(cur.fetchone(), (1, 1))

    def test_existing_catalog_registration_keeps_active_generation_and_signature_identity(self):
        from perturbseqr_ingest.library_registration import backfill_existing, existing_manifests

        manifests = existing_manifests(Path(__file__).resolve().parents[2] / "libraries")
        with self.conn.cursor() as cur:
            cur.execute("SELECT id, revision_id FROM app_public.gene_set WHERE term LIKE 'Original::%'")
            original = cur.fetchone()
        for _ in range(2):
            result = backfill_existing(self.conn, manifests, verify=False)
            self.assertEqual(result["registered"], ["ginkgo-bioworks"])
        with self.conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE guest")
            cur.execute("SELECT id, revision_id FROM app_public.gene_set WHERE term LIKE 'Original::%'")
            self.assertEqual(cur.fetchone(), original)
            cur.execute("SELECT app_public.library_catalog()")
            catalog, = cur.fetchone()
            self.assertEqual(catalog["generation"], "00000000-0000-0000-0000-000000000004")
            ginkgo = next(l for l in catalog["libraries"] if l["slug"] == "ginkgo-bioworks")
            self.assertEqual(len(ginkgo["artifacts"]), 2)
            self.assertTrue(all(a["status"] == "restricted" and "url" not in a for a in ginkgo["artifacts"]))

    def test_publication_switches_catalog_search_aliases_and_background(self):
        library, revision, background = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("SELECT app_public.publish_library_generation(%s)", [background])
            self.assertEqual(str(cur.fetchone()[0]), background)
            cur.execute("SELECT app_public.publish_library_generation(%s)", [background])
            self.assertEqual(str(cur.fetchone()[0]), background)
            cur.execute("SET LOCAL ROLE guest")
            cur.execute("SELECT count(*) FROM app_public.gene_set_term_search(ARRAY['Dexamethasone']::varchar[])")
            self.assertEqual(cur.fetchone()[0], 1)
            cur.execute("SELECT id FROM app_public.current_background()")
            self.assertEqual(str(cur.fetchone()[0]), background)
            cur.execute("SELECT app_public.library_catalog()")
            catalog = cur.fetchone()[0]
            self.assertTrue(any(l["id"] == library for l in catalog["libraries"]))

    def test_stale_generation_cannot_overwrite_a_new_publication(self):
        _, _, first = self.candidate()
        _, _, second = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("SELECT app_public.publish_library_generation(%s)", [first])
            with self.assertRaisesRegex(Exception, "Catalog changed"):
                cur.execute("SELECT app_public.publish_library_generation(%s)", [second])

    def test_replacement_can_reuse_legacy_term_and_rollback_keeps_legacy_visible(self):
        library = '00000000-0000-0000-0000-000000000001'
        previous = '00000000-0000-0000-0000-000000000004'
        _, revision, background = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("DELETE FROM app_public.library_compound WHERE revision_id=%s", [revision])
            cur.execute("DELETE FROM app_public.gene_set WHERE revision_id=%s", [revision])
            cur.execute("UPDATE app_public.library_revision SET library_id=%s,manifest='{}' WHERE id=%s", [library, revision])
            cur.execute("UPDATE app_public.library_generation SET revision_ids=ARRAY[%s::uuid] WHERE id=%s", [revision, background])
            cur.execute("""INSERT INTO app_public.gene_set(term,hash,gene_ids,n_gene_ids,library_id,revision_id,perturbation)
                           SELECT term,hash,gene_ids,n_gene_ids,library_id,%s,perturbation
                           FROM app_public.gene_set WHERE library_id=%s AND revision_id IS NULL""", [revision, library])
            cur.execute("SELECT app_public.publish_library_generation(%s)", [background])
            cur.execute("SET LOCAL ROLE guest")
            cur.execute("SELECT revision_id::text FROM app_public.gene_set WHERE library_id=%s", [library])
            self.assertEqual(cur.fetchall(), [(revision,)])
            cur.execute("RESET ROLE")
            cur.execute("SELECT app_public.rollback_library_generation(%s)", [previous])
            cur.execute("SET LOCAL ROLE guest")
            cur.execute("SELECT revision_id FROM app_public.gene_set WHERE library_id=%s", [library])
            self.assertEqual(cur.fetchall(), [(None,)])

    def test_guest_cannot_query_a_constructed_candidate_background(self):
        _, _, background = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("SET LOCAL ROLE guest")
            for function, arguments in [('background_enrich', "ARRAY['STAT3']::varchar[]"),
                                        ('background_paired_enrich', "ARRAY['STAT3']::varchar[],ARRAY['STAT3']::varchar[]")]:
                cur.execute("SAVEPOINT guard_test")
                with self.assertRaisesRegex(Exception, "Only the published background"):
                    cur.execute(f"SELECT app_public.{function}(ROW(%s::uuid,'{{}}'::jsonb,0,now()::timestamp)::app_public.background,{arguments})", [background])
                cur.execute("ROLLBACK TO SAVEPOINT guard_test")

    def test_authoring_manifest_is_not_public(self):
        _, revision, background = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("SELECT app_public.publish_library_generation(%s)", [background])
            cur.execute("SET LOCAL ROLE guest")
            with self.assertRaisesRegex(Exception, "permission denied"):
                cur.execute("SELECT manifest FROM app_public.library_revision WHERE id=%s", [revision])

    def test_overlapping_index_completion_cannot_demote_published_generation(self):
        from unittest.mock import patch, Mock
        from perturbseqr_ingest.library_manager import index
        _, revision, background = self.candidate()
        with self.conn.cursor() as cur:
            cur.execute("UPDATE app_public.library_generation SET status='building' WHERE id=%s", [background])
        self.conn.commit()
        def other_worker_finishes(*args, **kwargs):
            with self.conn.cursor() as cur:
                cur.execute("UPDATE app_public.library_generation SET status='ready' WHERE id=%s", [background])
                cur.execute("SELECT app_public.publish_library_generation(%s)", [background])
                cur.execute("SELECT count(*) FROM app_private.library_index_rows(%s)", [background])
                count = cur.fetchone()[0]
            self.conn.commit()
            return Mock(raise_for_status=Mock(), json=lambda: {"index": count, "pairs": 0, "persisted": True})
        with patch.dict(os.environ, {"DATABASE_URL": os.environ["LIBRARY_TEST_DATABASE_URL"]}), patch('requests.get', other_worker_finishes):
            self.assertEqual(index(revision), background)
        with self.conn.cursor() as cur:
            cur.execute("SELECT status FROM app_public.library_generation WHERE id=%s", [background])
            self.assertEqual(cur.fetchone()[0], 'published')
            # This concurrency test commits real transitions; restore the seeded baseline.
            cur.execute("SELECT app_public.rollback_library_generation('00000000-0000-0000-0000-000000000004')")
        self.conn.commit()


if __name__ == "__main__":
    unittest.main()
