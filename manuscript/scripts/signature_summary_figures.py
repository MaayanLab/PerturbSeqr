#!/usr/bin/env python3
"""Create Perturb-Seqr signature summary manuscript figures"""

import matplotlib
matplotlib.use("Agg")

import requests
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from pathlib import Path
from collections import Counter
from maayanlab_bioinformatics.harmonization.ncbi_genes import ncbi_genes_fetch
import re
import warnings
import argparse
import os


warnings.filterwarnings("ignore")
# Directories
BASE_DIR = Path(__file__).parent.parent
METADATA_DIR = BASE_DIR.parent / "public" / "metadata"
FIG_DIR = BASE_DIR / "figures" / "summary"
# Libraries
DRUG_LIBS = ['LINCS L1000 CP', 'Tahoe-100M', 'RummaGEO Chem', 'NIBR DRUG-seq', 'Ginkgo Bioworks',
                'Microarrays CMap', 'SciPlex', 'CREEDS Chem', 'DeepCover MoA']
GENE_LIBS = ['LINCS L1000 XPR', 'Perturb Atlas Human', 'Perturb Atlas Mouse', 'RummaGEO Gene',
                'Replogle et al.', 'CREEDS Gene']

os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs('cache', exist_ok=True)

def query_perturbseqr():
    url = "https://perturbseqr.maayanlab.cloud/graphql"
    query = {"query":"query MyQuery {\n  geneSets {\n    edges {\n      node {\n        id\n        term\n        perturbation\n        library {\n          name\n        }\n      }\n    }\n  }\n}\n","variables":None,"operationName":"MyQuery"}
    response = requests.post(url, json=query)
    response.raise_for_status()
    res = response.json()
    data = res['data']['geneSets']['edges']
    ids = [x['node']['id'] for x in data]
    terms = [x['node']['term'] for x in data]
    perturbations = [x['node']['perturbation'] for x in data]
    libraries = [x['node']['library']['name'] for x in data]

    res_df = pd.DataFrame({
        'id': ids,
        'term': terms,
        'perturbation': perturbations,
        'library': libraries
    })

    return res_df


def pc_alias_map(organism: str, cache_dir: Path) -> dict[str, str]:

    df = ncbi_genes_fetch(organism=organism, cache_dir=str(cache_dir), filters=None)
    pairs = [(s.upper(), row["Symbol"].upper())
             for _, row in df.iterrows()
             for s in row["All_synonyms"]]
    counts = Counter(alias for alias, _ in pairs)
    return {alias: sym for alias, sym in pairs if counts[alias] == 1 or alias == sym}


def drug_metadata_lookup(key: str, value: str, drug_metadata: pd.DataFrame) -> dict:
    return dict(zip(drug_metadata[key].str.lower().to_list(), drug_metadata[value].str.lower().to_list()))


def resolve_drug_names(signature_perts: pd.Series, cid_lookup: dict, resolved_name_lookup: dict) -> list:
    pert_lower = list(set(signature_perts.str.lower()))
    cids = [s for s in pert_lower if s.isdigit()]
    cids.extend([cid_lookup[p] for p in pert_lower if p in cid_lookup])
    pert_left = [p for p in pert_lower if p not in cid_lookup]
    pert_resolved = [resolved_name_lookup[p] for p in pert_left if p in resolved_name_lookup]
    return list(set(cids + pert_resolved))

def resolve_drug_names_dict(signature_perts: pd.Series, cid_lookup: dict, resolved_name_lookup: dict) -> dict:
    pert_lower = list(set(signature_perts.str.lower()))
    return {p: cid_lookup.get(p, resolved_name_lookup.get(p)) for p in pert_lower if p in cid_lookup or p in resolved_name_lookup}

def clean_data(signature_df):
    def _extract_metadata(term):
        split_term = term.split('::')
        direction = term.split('::')[-1].split(' ')[1]
        if len(split_term) > 4:
            cell_line = split_term[1]
            cell_type = split_term[2]
            time_pt = split_term[3]
            concentration = split_term[4]
            return [cell_line, cell_type, time_pt, concentration, direction]
        else:
            return [None, None, None, None, direction]
    def _fix_novartis(row):
        if pd.isna(row['perturbation']):
            return row['term'].split('::')[5]
        else:
            return row['perturbation']
    signature_df['pert_type'] = signature_df['library'].apply(lambda x: 'drug' if x in DRUG_LIBS else 'gene')

    new_cols = signature_df['term'].apply(_extract_metadata)
    signature_df[['cell_line', 'cell_type', 'time_pt', 'concentration', 'direction']] = new_cols.apply(pd.Series)

    signature_df['perturbation'] = signature_df.apply(_fix_novartis, axis=1)
    signature_df = signature_df.replace(r'^\s*$', np.nan, regex=True)
    signature_df['direction'] = signature_df['direction'].apply(lambda x: 'down' if x == 'dn' else x)
    return signature_df

def signature_barplot(signature_df, colors):
    plot_df = (
        signature_df
        .groupby(['pert_type', 'library'])
        .size()
        .reset_index(name='count')
    )

    pivot_df = plot_df.pivot(index='pert_type', columns='library', values='count').fillna(0)

    fig = plt.figure(figsize=(10, 112))

    drug_order = pivot_df.loc['drug'].sort_values(ascending=False).index
    gene_order = pivot_df.loc['gene'].sort_values(ascending=False).index
    all_order = list(drug_order[drug_order.isin(DRUG_LIBS)]) + list(gene_order[gene_order.isin(GENE_LIBS)])
    pivot_df = pivot_df.loc[:, all_order]
    ax = pivot_df.plot(
        kind='bar',
        stacked=True,
        color=colors,
        figsize=(6, 4),
        width=0.6,
        linewidth=0,
    )
    totals = pivot_df.sum(axis=1)

    for i, total in enumerate(totals):
        ax.text(
            i,
            total,
            f'{int(total):,}',
            ha='center',
            va='bottom',
            fontsize=10,
            fontweight='normal'
        )
    ax.set_ylabel('Signatures')
    ax.set_xlabel('Perturbation Type')
    ax.set_xticklabels(labels=['Drug', 'Gene'], rotation=0)
    ax.set_yticklabels(labels=[f'{int(y):,}' for y in ax.get_yticks()])
    ax.legend(title='Library', bbox_to_anchor=(1.02, 1), loc='upper left')
    plt.grid(visible=False)
    plt.tight_layout()
    plt.savefig(FIG_DIR / 'signature_counts_barchar.png', dpi=400, format='png')
    plt.close()       
    print(f"Saved: {FIG_DIR}/signature_counts_barchar.png")

def perturbation_barplot(drug_signatures, gene_signatures, all_signatures, cid_lookup, symbol_map, resolved_name_lookup):
    all_drugs = resolve_drug_names(drug_signatures.perturbation, cid_lookup, resolved_name_lookup)
    n_drugs = len(all_drugs)
    cell_line_counts = all_signatures.clean_cell_line.value_counts().reset_index(name='count').rename(columns={'index': 'clean_cell_line'})
    all_cell_lines = cell_line_counts[cell_line_counts['count'] > 1]
    n_cell_lines = len(set(all_cell_lines.clean_cell_line.values))
    all_gene_kos = set([symbol_map.get(g, g) for g in gene_signatures.perturbation.str.upper()])
    n_gene_kos = len(all_gene_kos)
    plt_df = pd.DataFrame({
        'feature': ['Drugs', 'Gene KOs', 'Cell Lines'],
        'count': [n_drugs, n_gene_kos, n_cell_lines]
    }).sort_values('count', ascending=False)

    fig = plt.figure(figsize=(5, 4))
    ax = sns.barplot(
        plt_df,
        x='count',
        y='feature'
    )

    for i, total in enumerate(plt_df['count'].values):
        ax.text(
            total,
            i,
            f'{int(total):,}',
            va='center',
            ha='left',
            fontsize=12,
            fontweight='normal'
        )

    ax.tick_params(axis="both", labelsize=10)
    ax.set_ylabel(None)
    ax.set_xlabel(None)
    plt.xlim(0, 14200)
    ax.set_xticklabels(labels=[f'{int(x):,}' for x in ax.get_xticks()]) 
    plt.grid(visible=False)
    plt.tight_layout()
    plt.savefig(FIG_DIR / 'signature_features_barchart.png', dpi=400, format='png')
    plt.close()
    print(f"Saved: {FIG_DIR}/signature_features_barchart.png")

def drug_pert_barplot(drug_signatures, colors):
    pivot_df = drug_signatures.groupby(['library', 'resolved_pert']).agg('size')\
        .reset_index(name='n_sigs')\
        .pivot(index='resolved_pert', columns='library', values='n_sigs').fillna(0)

    order = pivot_df.sum(axis=1).sort_values(ascending=False).index.values[:20]
    totals = pivot_df.sum(axis=1).loc[order]
    pivot_df = pivot_df.loc[order]

    fig, ax = plt.subplots(figsize=(9, 6))
    for i, (idx, row) in enumerate(pivot_df.iterrows()):
        sorted_row = row.sort_values(ascending=False)
        bottom = 0
        for category, value in sorted_row.items():
            ax.bar(idx, value, bottom=bottom, color=colors[category], edgecolor='none', label=category if i == 0 else "")
            bottom += value

    for i, total in enumerate(totals):
        ax.text(
            i,
            total,
            f'{int(total):,}',
            ha='center',
            va='bottom',
            rotation=45,
            fontsize=10.5,
            fontweight='bold'
        )
    label_dict = drug_signatures[['resolved_pert', 'perturbation']].set_index('resolved_pert').to_dict()['perturbation']
    ax.set_xticklabels([label_dict.get(p, p) for p in pivot_df.index], rotation=45, ha='right')
    ax.set_ylabel('Signatures')
    ax.legend()
    ax.get_legend().remove()
    plt.ylim(0, 6600)
    ax.set_yticklabels(labels=[f'{int(y):,}' for y in ax.get_yticks()]) 
    plt.grid(visible=False)
    plt.tight_layout()
    plt.savefig(FIG_DIR / 'drug_pert_histogram.png', dpi=400, format='png')
    plt.close()
    print(f"Saved: {FIG_DIR}/drug_pert_histogram.png")

def gene_pert_barplot(gene_signatures, colors):
    pivot_df = gene_signatures.groupby(['library', 'resolved_pert']).agg('size')\
        .reset_index(name='n_sigs')\
        .pivot(index='resolved_pert', columns='library', values='n_sigs').fillna(0)

    order = pivot_df.sum(axis=1).sort_values(ascending=False).index.values[:20]
    pivot_df = pivot_df.loc[order]
    totals = pivot_df.sum(axis=1).loc[order]

    fig, ax = plt.subplots(figsize=(9, 6))
    for i, (idx, row) in enumerate(pivot_df.iterrows()):
        sorted_row = row.sort_values(ascending=False)
        bottom = 0
        for category, value in sorted_row.items():
            ax.bar(idx, value, bottom=bottom, color=colors[category], edgecolor='none', label=category if i == 0 else "")
            bottom += value

    for i, total in enumerate(totals):
        ax.text(
            i,
            total,
            f'{int(total):,}',
            ha='center',
            va='bottom',
            rotation=45,
            fontsize=10.5,
            fontweight='bold'
        )
    ax.set_xticklabels(ax.get_xticklabels(), rotation=45, ha='right')
    ax.set_ylabel('Signatures')
    ax.legend()
    ax.get_legend().remove()
    plt.ylim(0, 1200)
    ax.set_yticklabels(labels=[f'{int(y):,}' for y in ax.get_yticks()])
    plt.grid(visible=False)
    plt.tight_layout()
    plt.savefig(FIG_DIR / 'gene_pert_histogram.png', dpi=400, format='png')
    plt.close()
    print(f"Saved: {FIG_DIR}/gene_pert_histogram.png")

def cell_lines_barplot(all_signatures, colors):
    pivot_df = all_signatures.groupby(['library', 'clean_cell_line']).agg('size')\
        .reset_index(name='n_sigs')\
        .pivot(index='clean_cell_line', columns='library', values='n_sigs').fillna(0)

    order = pivot_df.sum(axis=1).sort_values(ascending=False).index.values[:20]
    totals = pivot_df.sum(axis=1).loc[order]
    pivot_df = pivot_df.loc[order]

    fig, ax = plt.subplots(figsize=(9, 6))
    for i, (idx, row) in enumerate(pivot_df.iterrows()):
        sorted_row = row.sort_values(ascending=False)
        bottom = 0
        for category, value in sorted_row.items():
            ax.bar(idx, value, bottom=bottom, color=colors[category], edgecolor='none', label=category if i == 0 else "")
            bottom += value

    for i, total in enumerate(totals):
        ax.text(
            i,
            total,
            f'{int(total):,}',
            ha='center',
            va='bottom',
            rotation=45,
            fontsize=10.5,
            fontweight='bold'
        )
    ax.set_xticklabels([p.upper() for p in pivot_df.index], rotation=45, ha='right')
    ax.set_ylabel('Signatures')
    ax.legend()
    ax.get_legend().remove()
    plt.ylim(0, 34000)
    ax.set_yticklabels(labels=[f'{int(y):,}' for y in ax.get_yticks()])
    plt.grid(visible=False)
    plt.tight_layout()
    plt.savefig(FIG_DIR / 'cell_line_histogram.png', dpi=400, format='png')
    plt.close()
    print(f"Saved: {FIG_DIR}/cell_line_histogram.png")

def main():
    parser = argparse.ArgumentParser(
        description="Generate Perturb-Seqr signature summary figures for manuscript",
        formatter_class=argparse.RawDescriptionHelpFormatter,    
    )

    parser.add_argument(
        "--fetch-signatures",
        action="store_true",
        help="Retrieve signature metadata via Perturb-Seqr GraphQL API"
    )

    args = parser.parse_args()

    if args.fetch_signatures:
        print("Retrieving signatures...")
        all_signatures = query_perturbseqr()
        all_signatures = clean_data(all_signatures)
        all_signatures.to_csv('cache/perturb-seqr-sigs.tsv', sep='\t', index=False)
    else:
        if not os.path.exists('cache/perturb-seqr-sigs.tsv'):
            print("Signature file not found")
            return()
        all_signatures = pd.read_csv('cache/perturb-seqr-sigs.tsv', sep='\t')
    
    print(f"Signatures: {all_signatures.shape[0]}")
    
    # Plotting colors
    exclude = ['#7f7f7f', '#c7c7c7']
    tab20_colors = [x for x in list(sns.color_palette('tab20').as_hex()) if x not in exclude][:all_signatures.library.nunique()]
    COLORS = dict(zip(all_signatures.library.unique(), tab20_colors))
    # Plotting aesthetics
    sns.set_theme(
    context='paper',
    style='white',
        rc={
            "axes.titlesize": 14,
            "axes.labelsize": 14,
            "xtick.labelsize": 12,
            "ytick.labelsize": 12
        }
    )

    ########## SIGNATURE BARPLOT ##########
    signature_barplot(all_signatures, colors=COLORS)

    ########## FEATURE SUMMARY BARPLOT ##########
    drug_signatures = all_signatures[all_signatures['pert_type'] == 'drug']
    gene_signatures = all_signatures[all_signatures['pert_type'] == 'gene']

    symbol_map = pc_alias_map(organism='Mammalia/Homo_sapiens', cache_dir=Path('.') / 'cache')

    drug_metadata = pd.read_json(METADATA_DIR / "drug_lookup.json").T
    drug_metadata = drug_metadata.reset_index(names='name')

    cid_lookup = drug_metadata_lookup('name', 'cid', drug_metadata)
    resolved_name_lookup = drug_metadata_lookup('name', 'resolved_name', drug_metadata)

    all_signatures['clean_cell_line'] = all_signatures['cell_line'].apply(
        lambda x: re.sub(r'(,|\.311)+', '', x.split(' ')[0].strip().lower()) if pd.notna(x) else x
    )
    perturbation_barplot(drug_signatures, gene_signatures, all_signatures, cid_lookup, symbol_map, resolved_name_lookup)
    
    ########## DRUG PERTURBATION SUMMARY BARPLOT ##########
    drug_dict = resolve_drug_names_dict(drug_signatures.perturbation, cid_lookup, resolved_name_lookup)

    drug_signatures['resolved_pert'] = drug_signatures['perturbation'].str.lower().map(drug_dict)
    drug_signatures['resolved_pert'] = drug_signatures['resolved_pert'].fillna(drug_signatures['perturbation'].str.lower())

    drug_pert_barplot(drug_signatures, colors=COLORS)

    ########## GENE PERTURBATION SUMMARY BARPLOT ##########
    gene_signatures['resolved_pert'] = gene_signatures['perturbation'].str.upper().map(symbol_map)
    gene_signatures['resolved_pert'] = gene_signatures['resolved_pert'].fillna(gene_signatures['perturbation'].str.upper())

    gene_pert_barplot(gene_signatures, colors=COLORS)    

    ########## CELL LINES SUMMARY BARPLOT ##########
    cell_lines_barplot(all_signatures, colors=COLORS)
    

if __name__ == "__main__":
    main()