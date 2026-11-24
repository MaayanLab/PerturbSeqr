const assert = require('node:assert/strict')
const { test } = require('node:test')
const { resolveCompound, matchesCompoundQuery, pubChemCid } = require('../src/utils/drugAnnotations')
const { libraryFilterParam } = require('../src/utils/libraryCatalog')

const legacy = { atracurium: { cid: '62887', name: 'Cisatracurium', moa: 'legacy annotation' } }
const scoped = {
  reframe: {
    Atracurium: { cid: '47319', name: 'Atracurium', aliases: ['Atracurium besilate'] },
    '777': { cid: '777', name: 'Other compound', aliases: ['Shared name'] },
    'Shared name': { cid: '888', name: 'Distinct compound' },
  },
  anotherLibrary: { Atracurium: { cid: '62887', name: 'Cisatracurium' } },
}

test('reFRAME and legacy signatures with the same label keep their distinct CIDs, names and links', () => {
  const reframe = resolveCompound({ label: 'Atracurium', libraryId: 'reframe', cid: '47319' }, scoped, legacy)
  assert.equal(reframe.name, 'Atracurium')
  assert.equal(reframe.url, 'https://pubchem.ncbi.nlm.nih.gov/compound/47319')
  assert.equal(reframe.moa, '')
  assert.equal(matchesCompoundQuery(reframe, 'CID: 47319'), true)
  assert.equal(matchesCompoundQuery(reframe, 'atracurium BESILATE'), true)
  for (const query of ['62887', '7319', 'Cisatracurium']) assert.equal(matchesCompoundQuery(reframe, query), false)
  for (const libraryId of ['anotherLibrary', 'old-library']) {
    const other = resolveCompound({ label: 'Atracurium', libraryId }, scoped, legacy)
    assert.equal(other.name, 'Cisatracurium')
    assert.equal(other.url, 'https://pubchem.ncbi.nlm.nih.gov/compound/62887')
    assert.equal(other.moa, 'legacy annotation')
  }
})

test('the signature CID still wins if annotations have not loaded or describe a different CID', () => {
  for (const lookup of [{}, scoped]) {
    const compound = resolveCompound({ label: 'Atracurium', libraryId: 'anotherLibrary', cid: '47319' }, lookup, legacy)
    assert.equal(compound.name, 'Atracurium')
    assert.equal(compound.url, 'https://pubchem.ncbi.nlm.nih.gov/compound/47319')
    assert.equal(matchesCompoundQuery(compound, '47319'), true)
    assert.equal(matchesCompoundQuery(compound, '62887'), false)
  }
})

test('aliases can find multiple rows without overwriting an exact source label', () => {
  const aliased = resolveCompound({ label: '777', libraryId: 'reframe', cid: '777' }, scoped, legacy)
  const exact = resolveCompound({ label: 'Shared name', libraryId: 'reframe', cid: '888' }, scoped, legacy)
  assert.equal(matchesCompoundQuery(aliased, 'shared name'), true)
  assert.equal(matchesCompoundQuery(exact, 'shared name'), true)
  assert.equal(aliased.cid, '777')
  assert.equal(exact.cid, '888')
  assert.equal(pubChemCid('PCID: 000888'), '888')
})

test('empty, partial and all-library selections have distinct request semantics', () => {
  assert.equal(libraryFilterParam([], ['A', 'B']), '__none__')
  assert.equal(libraryFilterParam(['A'], ['A', 'B']), 'A')
  assert.equal(libraryFilterParam(['B', 'A'], ['A', 'B']), '')
  assert.equal(libraryFilterParam(['A', 'A'], ['A', 'B']), 'A,A')
})
