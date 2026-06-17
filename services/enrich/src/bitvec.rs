use uuid::Uuid;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

// Representing indexes in a larger vector (background)
#[derive(Serialize, Deserialize, Clone)]
pub struct SparseBitVec{pub v:Vec<u32>}
impl SparseBitVec {
    pub fn new(background: &HashMap<Uuid, u32>, gene_set: &Vec<Uuid>) -> Self {
        SparseBitVec{v:gene_set.iter().filter_map(|gene_id| Some(*background.get(gene_id)?)).collect()}
    }
}

// Storing a multi-hot encoded vector for the gene set
#[derive(Eq, PartialEq, PartialOrd, Ord, Clone, Serialize, Deserialize)]
pub struct DenseBitVec{pub v:Vec<u8>, pub n:usize}
impl DenseBitVec {
    pub fn new(background: &HashMap<Uuid, u32>, gene_set: &Vec<Uuid>) -> Self {
        let mut v: Vec<u8> = [0].repeat(background.len());
        let mut n = 0;
        for gene_id in gene_set {
            if let Some(gene_index) = background.get(&gene_id) {
                if v[*gene_index as usize] == 0 {
                    n += 1;
                    v[*gene_index as usize] = 1;
                }
            }
        }
        DenseBitVec{v, n}
    }

    /// Create an empty DenseBitVec with the given size
    pub fn empty(size: usize) -> Self {
        DenseBitVec { v: vec![0; size], n: 0 }
    }

    /// Create a DenseBitVec from a SparseBitVec
    pub fn from_sparse(sparse: &SparseBitVec, size: usize) -> Self {
        let mut v: Vec<u8> = vec![0; size];
        for idx in &sparse.v {
            v[*idx as usize] = 1;
        }
        DenseBitVec { v, n: sparse.v.len() }
    }

    /// OR this bitvec with another, returning a new bitvec (union of genes)
    pub fn union(&self, other: &DenseBitVec) -> Self {
        let mut v: Vec<u8> = Vec::with_capacity(self.v.len());
        let mut n = 0;
        for i in 0..self.v.len() {
            let val = self.v[i] | other.v[i];
            if val == 1 {
                n += 1;
            }
            v.push(val);
        }
        DenseBitVec { v, n }
    }

    /// OR another bitvec into this one (mutating)
    pub fn union_mut(&mut self, other: &DenseBitVec) {
        for i in 0..self.v.len() {
            if self.v[i] == 0 && other.v[i] == 1 {
                self.v[i] = 1;
                self.n += 1;
            }
        }
    }

    /// Count the number of set bits (genes in this set)
    pub fn count_ones(&self) -> usize {
        self.n
    }
}

// this exploits the sparse vector to compute this overlap rather quickly
//  and in a way that is independent of the input gene set size
pub fn compute_overlap(a: &DenseBitVec, b: &SparseBitVec) -> u32 {
    b.v.iter().map(|i| a.v[*i as usize] as u32).sum()
}

// AND two dense bit vectors and sum: "how many of the user's query genes exist in library X's background?"
// This is |Q ∩ B_lib| — the effective query size scoped to a specific library.
pub fn intersect_count(a: &DenseBitVec, b: &DenseBitVec) -> u32 {
    a.v.iter().zip(b.v.iter()).map(|(x, y)| (x & y) as u32).sum()
}
