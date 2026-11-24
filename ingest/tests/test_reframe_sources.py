"""Scientific regression checks for the supplied DESeq2-to-GMT verification recipe."""
import importlib.util
import tempfile
import unittest
from pathlib import Path


@unittest.skipUnless(importlib.util.find_spec('h5py'), 'Use uv run --project etl --with h5py for H5AD verification tests')
class ReframeSourceTests(unittest.TestCase):
    def test_raw_pvalue_strict_effect_threshold_and_original_name_overwrites(self):
        import h5py
        import numpy as np
        script = Path(__file__).resolve().parents[2] / 'libraries' / 'ginkgo-reframe' / 'prepare_sources.py'
        specification = importlib.util.spec_from_file_location('reframe_source_verifier', script)
        module = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(module)
        obs = ['1::THP-1::24h::10000.0', '2::THP-1::24h::10000.0', '3::THP-1::24h::10000.0']
        effects = np.array([[2, -2, 1, -1, 3], [0, 0, 2, -2, 0], [1, -1, 2, -2, 3]], dtype=float)
        pvalues = np.array([[.01, .02, .001, .001, .05], [.01, .01, .03, .01, .01], [.01, .01, .05, .001, .04]])
        expected = {'Drug::THP-1::::10uM up': {'C'}, 'Drug::THP-1::::10uM down': {'D'},
                    '3::THP-1::::10uM up': {'E'}, '3::THP-1::::10uM down': {'D'}}
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'stats.h5ad'
            with h5py.File(path, 'w') as data:
                for group, names in [('obs', obs), ('var', list('ABCDE'))]:
                    data.create_group(group).attrs['_index'] = '_index'
                    data[group].create_dataset('_index', data=names, dtype=h5py.string_dtype())
                data.create_dataset('X', data=np.full((3, 5), .99))  # Adjusted p-values must NOT drive GMT selection.
                data.create_group('layers')
                data['layers'].create_dataset('logFC', data=effects)
                data['layers'].create_dataset('pValue', data=pvalues)
            report, provenance = module.verify_h5ad(path, expected, {'1': 'Drug', '2': 'Drug', '3': 'L' * 90}, dict.fromkeys(obs))
        self.assertTrue(report['gmtMatches'])
        self.assertEqual(report['overwrittenNameDirectionKeys'], 2)
        self.assertEqual({r['pubchem_cid'] for r in provenance if r['original_term'].startswith('Drug::')}, {'2'})


if __name__ == '__main__':
    unittest.main()
