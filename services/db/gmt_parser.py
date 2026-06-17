"""
GMT file parser - extracted from maayanlab-bioinformatics.

Source: https://github.com/MaayanLab/maayanlab-bioinformatics
File: maayanlab_bioinformatics/parse/gmt.py

Code is local instead of importing maayanlab-bioinformatics
because the library has a dependency chain (qnorm -> numba -> llvmlite) that doesn't
support Python 3.14.
"""

import re
import io
import gzip
import pathlib
import contextlib
from typing import Union, Iterator


@contextlib.contextmanager
def _ensure_fp(fp, mode='rt'):
    """Context manager to handle file paths (including .gz) or file objects."""
    if type(fp) == str or isinstance(fp, pathlib.Path):
        opener = gzip.open if str(fp).endswith('.gz') else open
        with opener(fp, mode) as fh:
            yield fh
    else:
        yield fp


def read_gmt(gmtfile: Union[io.TextIOBase, str, pathlib.Path]) -> Iterator[tuple[tuple[str, str], list[str]]]:
    """
    Read a GMT file, yielding ((term, description), [genes]) tuples.

    Accepts file objects, paths, or .gz compressed paths.
    Handles gene names with optional weights (e.g., "GENE:0.5" -> "GENE").
    """
    gene_expr = re.compile(r'^([^:;,]+?)([:;,].+)?$')
    with _ensure_fp(gmtfile) as fr:
        for line in fr:
            line_split = [cell.strip() for cell in line.strip().split('\t')]
            if len(line_split) < 3:
                continue
            term, desc, *genes = line_split
            genes = [
                m.group(1)
                for gene in genes
                if gene
                for m in (gene_expr.match(gene),)
                if m
            ]
            yield (term, desc), genes
