import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigFloat: { input: any; output: any; }
  BigInt: { input: any; output: any; }
  Cursor: { input: any; output: any; }
  Datetime: { input: any; output: any; }
  JSON: { input: any; output: any; }
  UUID: { input: any; output: any; }
};

/** All input for the `addUserGeneSet` mutation. */
export type AddUserGeneSetInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  genes?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

/** The output of our `addUserGeneSet` mutation. */
export type AddUserGeneSetPayload = {
  __typename?: 'AddUserGeneSetPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  userGeneSet?: Maybe<UserGeneSet>;
  /** An edge for our `UserGeneSet`. May be used by Relay 1. */
  userGeneSetEdge?: Maybe<UserGeneSetsEdge>;
};


/** The output of our `addUserGeneSet` mutation. */
export type AddUserGeneSetPayloadUserGeneSetEdgeArgs = {
  orderBy?: InputMaybe<Array<UserGeneSetsOrderBy>>;
};

export type Background = Node & {
  __typename?: 'Background';
  created?: Maybe<Scalars['Datetime']['output']>;
  enrich?: Maybe<PaginatedEnrichResult>;
  geneIds: Scalars['JSON']['output'];
  id: Scalars['UUID']['output'];
  nGeneIds: Scalars['Int']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  overlap: BackgroundOverlapConnection;
  pairedEnrich?: Maybe<PaginatedPairedEnrichResult>;
};


export type BackgroundEnrichArgs = {
  adjPvalueLe?: InputMaybe<Scalars['Float']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genes?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  overlapGe?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
  sortby?: InputMaybe<Scalars['String']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
};


export type BackgroundOverlapArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genes: Array<InputMaybe<Scalars['String']['input']>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  overlapGreaterThan?: InputMaybe<Scalars['Int']['input']>;
};


export type BackgroundPairedEnrichArgs = {
  adjPvalueLe?: InputMaybe<Scalars['Float']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genesDown?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  genesUp?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  overlapGe?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
  sortby?: InputMaybe<Scalars['String']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * A condition to be used against `Background` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type BackgroundCondition = {
  /** Checks for equality with the object’s `geneIds` field. */
  geneIds?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
};

/** A connection to a list of `BackgroundOverlapRecord` values. */
export type BackgroundOverlapConnection = {
  __typename?: 'BackgroundOverlapConnection';
  /** A list of edges which contains the `BackgroundOverlapRecord` and cursor to aid in pagination. */
  edges: Array<BackgroundOverlapEdge>;
  /** A list of `BackgroundOverlapRecord` objects. */
  nodes: Array<BackgroundOverlapRecord>;
  /** The count of *all* `BackgroundOverlapRecord` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `BackgroundOverlapRecord` edge in the connection. */
export type BackgroundOverlapEdge = {
  __typename?: 'BackgroundOverlapEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `BackgroundOverlapRecord` at the end of the edge. */
  node: BackgroundOverlapRecord;
};

/** The return type of our `overlap` query. */
export type BackgroundOverlapRecord = {
  __typename?: 'BackgroundOverlapRecord';
  geneSetId?: Maybe<Scalars['UUID']['output']>;
  nGsGeneIds?: Maybe<Scalars['Int']['output']>;
  nOverlapGeneIds?: Maybe<Scalars['Int']['output']>;
};

/** A connection to a list of `Background` values. */
export type BackgroundsConnection = {
  __typename?: 'BackgroundsConnection';
  /** A list of edges which contains the `Background` and cursor to aid in pagination. */
  edges: Array<BackgroundsEdge>;
  /** A list of `Background` objects. */
  nodes: Array<Background>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Background` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Background` edge in the connection. */
export type BackgroundsEdge = {
  __typename?: 'BackgroundsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Background` at the end of the edge. */
  node: Background;
};

/** Methods to use when ordering `Background`. */
export enum BackgroundsOrderBy {
  GeneIdsAsc = 'GENE_IDS_ASC',
  GeneIdsDesc = 'GENE_IDS_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type ConsensusResult = {
  __typename?: 'ConsensusResult';
  adjPvalue?: Maybe<Scalars['Float']['output']>;
  adjPvalueDown?: Maybe<Scalars['Float']['output']>;
  adjPvalueUp?: Maybe<Scalars['Float']['output']>;
  approved?: Maybe<Scalars['Boolean']['output']>;
  cid?: Maybe<Scalars['String']['output']>;
  contributingSignatures?: Maybe<Scalars['JSON']['output']>;
  countInsignificant?: Maybe<Scalars['Int']['output']>;
  countSignificant?: Maybe<Scalars['Int']['output']>;
  countUpSignificant?: Maybe<Scalars['Int']['output']>;
  drug?: Maybe<Scalars['String']['output']>;
  libraries?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  oddsRatio?: Maybe<Scalars['Float']['output']>;
  oddsRatioDown?: Maybe<Scalars['Float']['output']>;
  oddsRatioUp?: Maybe<Scalars['Float']['output']>;
  pvalue?: Maybe<Scalars['Float']['output']>;
  pvalueDown?: Maybe<Scalars['Float']['output']>;
  pvalueUp?: Maybe<Scalars['Float']['output']>;
};

export type EnrichResult = {
  __typename?: 'EnrichResult';
  adjPvalue?: Maybe<Scalars['Float']['output']>;
  geneSetHash?: Maybe<Scalars['UUID']['output']>;
  geneSetId?: Maybe<Scalars['UUID']['output']>;
  /** Reads and enables pagination through a set of `GeneSet`. */
  geneSets: GeneSetsConnection;
  libraryCount?: Maybe<Scalars['Int']['output']>;
  nOverlap?: Maybe<Scalars['Int']['output']>;
  oddsRatio?: Maybe<Scalars['Float']['output']>;
  pvalue?: Maybe<Scalars['Float']['output']>;
  supportingLibraries?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};


export type EnrichResultGeneSetsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type FdaCount = Node & {
  __typename?: 'FdaCount';
  approved?: Maybe<Scalars['Boolean']['output']>;
  cid?: Maybe<Scalars['String']['output']>;
  count?: Maybe<Scalars['Int']['output']>;
  moa?: Maybe<Scalars['String']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  perturbation: Scalars['String']['output'];
};

/**
 * A condition to be used against `FdaCount` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type FdaCountCondition = {
  /** Checks for equality with the object’s `perturbation` field. */
  perturbation?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `FdaCount` values. */
export type FdaCountsConnection = {
  __typename?: 'FdaCountsConnection';
  /** A list of edges which contains the `FdaCount` and cursor to aid in pagination. */
  edges: Array<FdaCountsEdge>;
  /** A list of `FdaCount` objects. */
  nodes: Array<FdaCount>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `FdaCount` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `FdaCount` edge in the connection. */
export type FdaCountsEdge = {
  __typename?: 'FdaCountsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `FdaCount` at the end of the edge. */
  node: FdaCount;
};

/** Methods to use when ordering `FdaCount`. */
export enum FdaCountsOrderBy {
  Natural = 'NATURAL',
  PerturbationAsc = 'PERTURBATION_ASC',
  PerturbationDesc = 'PERTURBATION_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type Gene = Node & {
  __typename?: 'Gene';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  ncbiGeneId?: Maybe<Scalars['Int']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  summary?: Maybe<Scalars['String']['output']>;
  symbol: Scalars['String']['output'];
  synonyms?: Maybe<Scalars['JSON']['output']>;
};

/** A condition to be used against `Gene` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type GeneCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `symbol` field. */
  symbol?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `synonyms` field. */
  synonyms?: InputMaybe<Scalars['JSON']['input']>;
};

export type GeneMapping = {
  __typename?: 'GeneMapping';
  gene?: Maybe<Scalars['String']['output']>;
  geneId?: Maybe<Scalars['UUID']['output']>;
  geneInfo?: Maybe<Gene>;
};

/** A connection to a list of `GeneMapping` values. */
export type GeneMappingsConnection = {
  __typename?: 'GeneMappingsConnection';
  /** A list of edges which contains the `GeneMapping` and cursor to aid in pagination. */
  edges: Array<GeneMappingsEdge>;
  /** A list of `GeneMapping` objects. */
  nodes: Array<GeneMapping>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GeneMapping` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GeneMapping` edge in the connection. */
export type GeneMappingsEdge = {
  __typename?: 'GeneMappingsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GeneMapping` at the end of the edge. */
  node: GeneMapping;
};

export type GeneSet = Node & {
  __typename?: 'GeneSet';
  cid?: Maybe<Scalars['String']['output']>;
  created: Scalars['Datetime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  geneIds: Scalars['JSON']['output'];
  /** Reads and enables pagination through a set of `GeneSetFdaCount`. */
  geneSetFdaCountsById: GeneSetFdaCountsConnection;
  /** Reads and enables pagination through a set of `Gene`. */
  genes: GenesConnection;
  hash: Scalars['UUID']['output'];
  id: Scalars['UUID']['output'];
  /** Reads a single `GeneSetLibrary` that is related to this `GeneSet`. */
  library?: Maybe<GeneSetLibrary>;
  libraryId?: Maybe<Scalars['UUID']['output']>;
  nGeneIds: Scalars['Int']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads and enables pagination through a set of `Gene`. */
  overlap: GenesConnection;
  perturbation?: Maybe<Scalars['String']['output']>;
  term: Scalars['String']['output'];
};


export type GeneSetGeneSetFdaCountsByIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GeneSetFdaCountCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GeneSetFdaCountsOrderBy>>;
};


export type GeneSetGenesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type GeneSetOverlapArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genes: Array<InputMaybe<Scalars['String']['input']>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

/** A condition to be used against `GeneSet` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type GeneSetCondition = {
  /** Checks for equality with the object’s `geneIds` field. */
  geneIds?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `hash` field. */
  hash?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `libraryId` field. */
  libraryId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `term` field. */
  term?: InputMaybe<Scalars['String']['input']>;
};

export type GeneSetFdaCount = {
  __typename?: 'GeneSetFdaCount';
  approved?: Maybe<Scalars['Boolean']['output']>;
  cid?: Maybe<Scalars['String']['output']>;
  count?: Maybe<Scalars['BigInt']['output']>;
  /** Reads a single `GeneSet` that is related to this `GeneSetFdaCount`. */
  geneSetById?: Maybe<GeneSet>;
  id?: Maybe<Scalars['UUID']['output']>;
  moa?: Maybe<Scalars['String']['output']>;
  perturbation?: Maybe<Scalars['String']['output']>;
  /** Total stored signatures for this perturbation across all libraries; up and down gene sets count separately. */
  totalCount?: Maybe<Scalars['BigInt']['output']>;
};

/**
 * A condition to be used against `GeneSetFdaCount` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type GeneSetFdaCountCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
};

/** A connection to a list of `GeneSetFdaCount` values. */
export type GeneSetFdaCountsConnection = {
  __typename?: 'GeneSetFdaCountsConnection';
  /** A list of edges which contains the `GeneSetFdaCount` and cursor to aid in pagination. */
  edges: Array<GeneSetFdaCountsEdge>;
  /** A list of `GeneSetFdaCount` objects. */
  nodes: Array<GeneSetFdaCount>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GeneSetFdaCount` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GeneSetFdaCount` edge in the connection. */
export type GeneSetFdaCountsEdge = {
  __typename?: 'GeneSetFdaCountsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GeneSetFdaCount` at the end of the edge. */
  node: GeneSetFdaCount;
};

/** Methods to use when ordering `GeneSetFdaCount`. */
export enum GeneSetFdaCountsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL'
}

/** A connection to a list of `GeneSetLibrary` values. */
export type GeneSetLibrariesConnection = {
  __typename?: 'GeneSetLibrariesConnection';
  /** A list of edges which contains the `GeneSetLibrary` and cursor to aid in pagination. */
  edges: Array<GeneSetLibrariesEdge>;
  /** A list of `GeneSetLibrary` objects. */
  nodes: Array<GeneSetLibrary>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GeneSetLibrary` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GeneSetLibrary` edge in the connection. */
export type GeneSetLibrariesEdge = {
  __typename?: 'GeneSetLibrariesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GeneSetLibrary` at the end of the edge. */
  node: GeneSetLibrary;
};

/** Methods to use when ordering `GeneSetLibrary`. */
export enum GeneSetLibrariesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type GeneSetLibrary = Node & {
  __typename?: 'GeneSetLibrary';
  created: Scalars['Datetime']['output'];
  description: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `GeneSet`. */
  geneSetsByLibraryId: GeneSetsConnection;
  id: Scalars['UUID']['output'];
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};


export type GeneSetLibraryGeneSetsByLibraryIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GeneSetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GeneSetsOrderBy>>;
};

/**
 * A condition to be used against `GeneSetLibrary` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type GeneSetLibraryCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `GeneSet` values. */
export type GeneSetsConnection = {
  __typename?: 'GeneSetsConnection';
  /** A list of edges which contains the `GeneSet` and cursor to aid in pagination. */
  edges: Array<GeneSetsEdge>;
  /** A list of `GeneSet` objects. */
  nodes: Array<GeneSet>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GeneSet` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GeneSet` edge in the connection. */
export type GeneSetsEdge = {
  __typename?: 'GeneSetsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GeneSet` at the end of the edge. */
  node: GeneSet;
};

/** Methods to use when ordering `GeneSet`. */
export enum GeneSetsOrderBy {
  GeneIdsAsc = 'GENE_IDS_ASC',
  GeneIdsDesc = 'GENE_IDS_DESC',
  HashAsc = 'HASH_ASC',
  HashDesc = 'HASH_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LibraryIdAsc = 'LIBRARY_ID_ASC',
  LibraryIdDesc = 'LIBRARY_ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  TermAsc = 'TERM_ASC',
  TermDesc = 'TERM_DESC'
}

/** A connection to a list of `Gene` values. */
export type GenesConnection = {
  __typename?: 'GenesConnection';
  /** A list of edges which contains the `Gene` and cursor to aid in pagination. */
  edges: Array<GenesEdge>;
  /** A list of `Gene` objects. */
  nodes: Array<Gene>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Gene` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Gene` edge in the connection. */
export type GenesEdge = {
  __typename?: 'GenesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Gene` at the end of the edge. */
  node: Gene;
};

/** Methods to use when ordering `Gene`. */
export enum GenesOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SymbolAsc = 'SYMBOL_ASC',
  SymbolDesc = 'SYMBOL_DESC',
  SynonymsAsc = 'SYNONYMS_ASC',
  SynonymsDesc = 'SYNONYMS_DESC'
}

/** The root mutation type which contains root level fields which mutate data. */
export type Mutation = {
  __typename?: 'Mutation';
  addUserGeneSet?: Maybe<AddUserGeneSetPayload>;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddUserGeneSetArgs = {
  input: AddUserGeneSetInput;
};

/** An object with a globally unique `ID`. */
export type Node = {
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};

/** Information about pagination in a connection. */
export type PageInfo = {
  __typename?: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  endCursor?: Maybe<Scalars['Cursor']['output']>;
  /** When paginating forwards, are there more items? */
  hasNextPage: Scalars['Boolean']['output'];
  /** When paginating backwards, are there more items? */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** When paginating backwards, the cursor to continue. */
  startCursor?: Maybe<Scalars['Cursor']['output']>;
};

export type PaginatedEnrichResult = {
  __typename?: 'PaginatedEnrichResult';
  consensus?: Maybe<Array<Maybe<ConsensusResult>>>;
  consensusCount?: Maybe<Scalars['Int']['output']>;
  geneSetCount?: Maybe<Scalars['Int']['output']>;
  moas?: Maybe<Array<Maybe<ConsensusResult>>>;
  moasCount?: Maybe<Scalars['Int']['output']>;
  nodes?: Maybe<Array<Maybe<EnrichResult>>>;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type PaginatedPairedEnrichResult = {
  __typename?: 'PaginatedPairedEnrichResult';
  consensus?: Maybe<Array<Maybe<ConsensusResult>>>;
  consensusCount?: Maybe<Scalars['Int']['output']>;
  geneSetCount?: Maybe<Scalars['Int']['output']>;
  moas?: Maybe<Array<Maybe<ConsensusResult>>>;
  moasCount?: Maybe<Scalars['Int']['output']>;
  nodes?: Maybe<Array<Maybe<PairedEnrichResult>>>;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type PairedEnrichResult = {
  __typename?: 'PairedEnrichResult';
  adjPvalueMimic?: Maybe<Scalars['Float']['output']>;
  adjPvalueReverse?: Maybe<Scalars['Float']['output']>;
  /** Reads and enables pagination through a set of `GeneSet`. */
  geneSet: GeneSetsConnection;
  geneSetHashDown?: Maybe<Scalars['UUID']['output']>;
  geneSetHashUp?: Maybe<Scalars['UUID']['output']>;
  geneSetIdDown?: Maybe<Scalars['UUID']['output']>;
  geneSetIdUp?: Maybe<Scalars['UUID']['output']>;
  libraryCount?: Maybe<Scalars['Int']['output']>;
  mimickerOverlap?: Maybe<Scalars['Int']['output']>;
  oddsRatioMimic?: Maybe<Scalars['Float']['output']>;
  oddsRatioReverse?: Maybe<Scalars['Float']['output']>;
  pvalueMimic?: Maybe<Scalars['Float']['output']>;
  pvalueReverse?: Maybe<Scalars['Float']['output']>;
  reverserOverlap?: Maybe<Scalars['Int']['output']>;
  supportingLibraries?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};


export type PairedEnrichResultGeneSetArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type PmcStat = {
  __typename?: 'PmcStat';
  nPublicationsProcessed?: Maybe<Scalars['BigFloat']['output']>;
};

/** The root query type which gives access points into the data universe. */
export type Query = Node & {
  __typename?: 'Query';
  background?: Maybe<Background>;
  /** Reads a single `Background` using its globally unique `ID`. */
  backgroundByNodeId?: Maybe<Background>;
  /** Reads and enables pagination through a set of `Background`. */
  backgrounds?: Maybe<BackgroundsConnection>;
  currentBackground?: Maybe<Background>;
  fdaCount?: Maybe<FdaCount>;
  /** Reads a single `FdaCount` using its globally unique `ID`. */
  fdaCountByNodeId?: Maybe<FdaCount>;
  /** Reads and enables pagination through a set of `FdaCount`. */
  fdaCounts?: Maybe<FdaCountsConnection>;
  gene?: Maybe<Gene>;
  /** Reads a single `Gene` using its globally unique `ID`. */
  geneByNodeId?: Maybe<Gene>;
  geneBySymbol?: Maybe<Gene>;
  /** Reads and enables pagination through a set of `GeneMapping`. */
  geneMap?: Maybe<GeneMappingsConnection>;
  /** Reads and enables pagination through a set of `GeneMapping`. */
  geneMap2?: Maybe<GeneMappingsConnection>;
  geneSet?: Maybe<GeneSet>;
  /** Reads a single `GeneSet` using its globally unique `ID`. */
  geneSetByNodeId?: Maybe<GeneSet>;
  /** Lookup a gene set by its term string. Returns the first match if term exists in multiple libraries. */
  geneSetByTerm?: Maybe<GeneSet>;
  geneSetByTermAndLibraryId?: Maybe<GeneSet>;
  /** Reads and enables pagination through a set of `GeneSetFdaCount`. */
  geneSetFdaCounts?: Maybe<GeneSetFdaCountsConnection>;
  /** Reads and enables pagination through a set of `GeneSet`. */
  geneSetGeneSearch?: Maybe<GeneSetsConnection>;
  /** Reads and enables pagination through a set of `GeneSetLibrary`. */
  geneSetLibraries?: Maybe<GeneSetLibrariesConnection>;
  geneSetLibrary?: Maybe<GeneSetLibrary>;
  geneSetLibraryByName?: Maybe<GeneSetLibrary>;
  /** Reads a single `GeneSetLibrary` using its globally unique `ID`. */
  geneSetLibraryByNodeId?: Maybe<GeneSetLibrary>;
  /** Reads and enables pagination through a set of `GeneSet`. */
  geneSetTermSearch?: Maybe<GeneSetsConnection>;
  /** Reads and enables pagination through a set of `GeneSet`. */
  geneSets?: Maybe<GeneSetsConnection>;
  /** Reads and enables pagination through a set of `Gene`. */
  genes?: Maybe<GenesConnection>;
  /** Fetches an object given its globally unique `ID`. */
  node?: Maybe<Node>;
  /** The root query type must be a `Node` to work well with Relay 1 mutations. This just resolves to `query`. */
  nodeId: Scalars['ID']['output'];
  pmcStats?: Maybe<PmcStat>;
  /**
   * Exposes the root query type nested one level down. This is helpful for Relay 1
   * which can only query top level fields if they are in a particular form.
   */
  query: Query;
  release?: Maybe<Release>;
  /** Reads a single `Release` using its globally unique `ID`. */
  releaseByNodeId?: Maybe<Release>;
  /** Reads and enables pagination through a set of `Release`. */
  releases?: Maybe<ReleasesConnection>;
  userGeneSet?: Maybe<UserGeneSet>;
  /** Reads a single `UserGeneSet` using its globally unique `ID`. */
  userGeneSetByNodeId?: Maybe<UserGeneSet>;
  /** Reads and enables pagination through a set of `UserGeneSet`. */
  userGeneSets?: Maybe<UserGeneSetsConnection>;
};


/** The root query type which gives access points into the data universe. */
export type QueryBackgroundArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBackgroundByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBackgroundsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<BackgroundCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BackgroundsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryFdaCountArgs = {
  perturbation: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFdaCountByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryFdaCountsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<FdaCountCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<FdaCountsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneBySymbolArgs = {
  symbol: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneMapArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genes: Array<InputMaybe<Scalars['String']['input']>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneMap2Args = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genes: Array<InputMaybe<Scalars['String']['input']>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetByTermArgs = {
  term?: InputMaybe<Scalars['String']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetByTermAndLibraryIdArgs = {
  libraryId: Scalars['UUID']['input'];
  term: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetFdaCountsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GeneSetFdaCountCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GeneSetFdaCountsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetGeneSearchArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  genes?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  last?: InputMaybe<Scalars['Int']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetLibrariesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GeneSetLibraryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GeneSetLibrariesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetLibraryArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetLibraryByNameArgs = {
  name: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetLibraryByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetTermSearchArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  terms?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGeneSetsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GeneSetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GeneSetsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGenesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GeneCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GenesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryNodeArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryReleaseArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryReleaseByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryReleasesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ReleaseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ReleasesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryUserGeneSetArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryUserGeneSetByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryUserGeneSetsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<UserGeneSetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<UserGeneSetsOrderBy>>;
};

export type Release = Node & {
  __typename?: 'Release';
  created?: Maybe<Scalars['Datetime']['output']>;
  id: Scalars['UUID']['output'];
  nPublicationsProcessed?: Maybe<Scalars['BigInt']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};

/** A condition to be used against `Release` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ReleaseCondition = {
  /** Checks for equality with the object’s `created` field. */
  created?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
};

/** A connection to a list of `Release` values. */
export type ReleasesConnection = {
  __typename?: 'ReleasesConnection';
  /** A list of edges which contains the `Release` and cursor to aid in pagination. */
  edges: Array<ReleasesEdge>;
  /** A list of `Release` objects. */
  nodes: Array<Release>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Release` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Release` edge in the connection. */
export type ReleasesEdge = {
  __typename?: 'ReleasesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Release` at the end of the edge. */
  node: Release;
};

/** Methods to use when ordering `Release`. */
export enum ReleasesOrderBy {
  CreatedAsc = 'CREATED_ASC',
  CreatedDesc = 'CREATED_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type UserGeneSet = Node & {
  __typename?: 'UserGeneSet';
  created: Scalars['Datetime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  genes?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};

/**
 * A condition to be used against `UserGeneSet` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type UserGeneSetCondition = {
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
};

/** A connection to a list of `UserGeneSet` values. */
export type UserGeneSetsConnection = {
  __typename?: 'UserGeneSetsConnection';
  /** A list of edges which contains the `UserGeneSet` and cursor to aid in pagination. */
  edges: Array<UserGeneSetsEdge>;
  /** A list of `UserGeneSet` objects. */
  nodes: Array<UserGeneSet>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `UserGeneSet` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `UserGeneSet` edge in the connection. */
export type UserGeneSetsEdge = {
  __typename?: 'UserGeneSetsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `UserGeneSet` at the end of the edge. */
  node: UserGeneSet;
};

/** Methods to use when ordering `UserGeneSet`. */
export enum UserGeneSetsOrderBy {
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type StatsQueryVariables = Exact<{ [key: string]: never; }>;


export type StatsQuery = { __typename?: 'Query', userGeneSets?: { __typename?: 'UserGeneSetsConnection', totalCount: number } | null, geneSets?: { __typename?: 'GeneSetsConnection', totalCount: number } | null };

export type FetchUserGeneSetQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type FetchUserGeneSetQuery = { __typename?: 'Query', userGeneSet?: { __typename?: 'UserGeneSet', genes?: Array<string | null> | null, description?: string | null } | null };

export type EnrichmentQueryQueryVariables = Exact<{
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type EnrichmentQueryQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', enrich?: { __typename?: 'PaginatedEnrichResult', totalCount?: number | null, consensusCount?: number | null, moasCount?: number | null, geneSetCount?: number | null, nodes?: Array<{ __typename?: 'EnrichResult', geneSetId?: any | null, geneSetHash?: any | null, libraryCount?: number | null, supportingLibraries?: Array<string | null> | null, pvalue?: number | null, adjPvalue?: number | null, oddsRatio?: number | null, nOverlap?: number | null, geneSets: { __typename?: 'GeneSetsConnection', totalCount: number, nodes: Array<{ __typename?: 'GeneSet', id: any, term: string, description?: string | null, nGeneIds: number, library?: { __typename?: 'GeneSetLibrary', name: string } | null, geneSetFdaCountsById: { __typename?: 'GeneSetFdaCountsConnection', nodes: Array<{ __typename?: 'GeneSetFdaCount', approved?: boolean | null, count?: any | null, totalCount?: any | null, moa?: string | null }> } }> } } | null> | null, consensus?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null, moas?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null } | null } | null };

export type EnrichmentQuerySingleQueryVariables = Exact<{
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type EnrichmentQuerySingleQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', enrich?: { __typename?: 'PaginatedEnrichResult', nodes?: Array<{ __typename?: 'EnrichResult', geneSetId?: any | null, geneSetHash?: any | null, libraryCount?: number | null, supportingLibraries?: Array<string | null> | null, pvalue?: number | null, adjPvalue?: number | null, oddsRatio?: number | null, nOverlap?: number | null, geneSets: { __typename?: 'GeneSetsConnection', totalCount: number, nodes: Array<{ __typename?: 'GeneSet', id: any, term: string, description?: string | null, nGeneIds: number, library?: { __typename?: 'GeneSetLibrary', name: string } | null, geneSetFdaCountsById: { __typename?: 'GeneSetFdaCountsConnection', nodes: Array<{ __typename?: 'GeneSetFdaCount', approved?: boolean | null, count?: any | null, totalCount?: any | null, moa?: string | null }> } }> } } | null> | null } | null } | null };

export type EnrichmentQueryConsensusQueryVariables = Exact<{
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type EnrichmentQueryConsensusQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', enrich?: { __typename?: 'PaginatedEnrichResult', consensusCount?: number | null, consensus?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null } | null } | null };

export type EnrichmentQueryMoAsQueryVariables = Exact<{
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type EnrichmentQueryMoAsQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', enrich?: { __typename?: 'PaginatedEnrichResult', moasCount?: number | null, moas?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null } | null } | null };

export type PairEnrichmentQueryQueryVariables = Exact<{
  genesUp: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  genesDown: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type PairEnrichmentQueryQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', pairedEnrich?: { __typename?: 'PaginatedPairedEnrichResult', totalCount?: number | null, consensusCount?: number | null, moasCount?: number | null, geneSetCount?: number | null, consensus?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null, moas?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null, nodes?: Array<{ __typename?: 'PairedEnrichResult', geneSetIdUp?: any | null, geneSetIdDown?: any | null, adjPvalueMimic?: number | null, adjPvalueReverse?: number | null, geneSetHashDown?: any | null, geneSetHashUp?: any | null, libraryCount?: number | null, supportingLibraries?: Array<string | null> | null, mimickerOverlap?: number | null, oddsRatioMimic?: number | null, oddsRatioReverse?: number | null, pvalueMimic?: number | null, pvalueReverse?: number | null, reverserOverlap?: number | null, geneSet: { __typename?: 'GeneSetsConnection', nodes: Array<{ __typename?: 'GeneSet', description?: string | null, id: any, nGeneIds: number, term: string, library?: { __typename?: 'GeneSetLibrary', name: string } | null, geneSetFdaCountsById: { __typename?: 'GeneSetFdaCountsConnection', nodes: Array<{ __typename?: 'GeneSetFdaCount', count?: any | null, totalCount?: any | null, approved?: boolean | null, moa?: string | null }> } }> } } | null> | null } | null } | null };

export type PairEnrichmentQuerySingleQueryVariables = Exact<{
  genesUp: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  genesDown: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type PairEnrichmentQuerySingleQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', pairedEnrich?: { __typename?: 'PaginatedPairedEnrichResult', totalCount?: number | null, nodes?: Array<{ __typename?: 'PairedEnrichResult', geneSetIdUp?: any | null, geneSetIdDown?: any | null, adjPvalueMimic?: number | null, adjPvalueReverse?: number | null, geneSetHashDown?: any | null, geneSetHashUp?: any | null, libraryCount?: number | null, supportingLibraries?: Array<string | null> | null, mimickerOverlap?: number | null, oddsRatioMimic?: number | null, oddsRatioReverse?: number | null, pvalueMimic?: number | null, pvalueReverse?: number | null, reverserOverlap?: number | null, geneSet: { __typename?: 'GeneSetsConnection', nodes: Array<{ __typename?: 'GeneSet', description?: string | null, id: any, nGeneIds: number, term: string, library?: { __typename?: 'GeneSetLibrary', name: string } | null, geneSetFdaCountsById: { __typename?: 'GeneSetFdaCountsConnection', nodes: Array<{ __typename?: 'GeneSetFdaCount', count?: any | null, totalCount?: any | null, approved?: boolean | null, moa?: string | null }> } }> } } | null> | null } | null } | null };

export type PairEnrichmentQueryConsensusQueryVariables = Exact<{
  genesUp: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  genesDown: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type PairEnrichmentQueryConsensusQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', pairedEnrich?: { __typename?: 'PaginatedPairedEnrichResult', consensusCount?: number | null, consensus?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null } | null } | null };

export type PairEnrichmentQueryMoAsQueryVariables = Exact<{
  genesUp: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  genesDown: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  filterTerm?: InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  filterFda?: InputMaybe<Scalars['Boolean']['input']>;
  sortBy?: InputMaybe<Scalars['String']['input']>;
  filterKo?: InputMaybe<Scalars['Boolean']['input']>;
  topN?: InputMaybe<Scalars['Int']['input']>;
  pvalueLe?: InputMaybe<Scalars['Float']['input']>;
}>;


export type PairEnrichmentQueryMoAsQuery = { __typename?: 'Query', currentBackground?: { __typename?: 'Background', pairedEnrich?: { __typename?: 'PaginatedPairedEnrichResult', moasCount?: number | null, moas?: Array<{ __typename?: 'ConsensusResult', drug?: string | null, cid?: string | null, oddsRatio?: number | null, pvalue?: number | null, adjPvalue?: number | null, approved?: boolean | null, countSignificant?: number | null, countInsignificant?: number | null, countUpSignificant?: number | null, pvalueUp?: number | null, adjPvalueUp?: number | null, oddsRatioUp?: number | null, pvalueDown?: number | null, adjPvalueDown?: number | null, oddsRatioDown?: number | null, libraries?: Array<string | null> | null, contributingSignatures?: any | null } | null> | null } | null } | null };

export type AllLibrariesQueryVariables = Exact<{ [key: string]: never; }>;


export type AllLibrariesQuery = { __typename?: 'Query', geneSetLibraries?: { __typename?: 'GeneSetLibrariesConnection', nodes: Array<{ __typename?: 'GeneSetLibrary', id: any, name: string, geneSetsByLibraryId: { __typename?: 'GeneSetsConnection', totalCount: number } }> } | null };

export type GeneSearchQueryVariables = Exact<{
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GeneSearchQuery = { __typename?: 'Query', geneSetGeneSearch?: { __typename?: 'GeneSetsConnection', totalCount: number, nodes: Array<{ __typename?: 'GeneSet', term: string }> } | null };

export type TermSearchQueryVariables = Exact<{
  terms: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type TermSearchQuery = { __typename?: 'Query', geneSetTermSearch?: { __typename?: 'GeneSetsConnection', totalCount: number, nodes: Array<{ __typename?: 'GeneSet', id: any, term: string, nGeneIds: number, library?: { __typename?: 'GeneSetLibrary', name: string } | null }> } | null };

export type AddUserGeneSetMutationVariables = Exact<{
  genes?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type AddUserGeneSetMutation = { __typename?: 'Mutation', addUserGeneSet?: { __typename?: 'AddUserGeneSetPayload', userGeneSet?: { __typename?: 'UserGeneSet', id: any } | null } | null };

export type GeneSetGenesByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type GeneSetGenesByIdQuery = { __typename?: 'Query', geneSet?: { __typename?: 'GeneSet', genes: { __typename?: 'GenesConnection', nodes: Array<{ __typename?: 'Gene', symbol: string, ncbiGeneId?: number | null, description?: string | null, summary?: string | null }> } } | null };

export type GeneSetDetailsByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type GeneSetDetailsByIdQuery = { __typename?: 'Query', geneSet?: { __typename?: 'GeneSet', term: string, description?: string | null, genes: { __typename?: 'GenesConnection', nodes: Array<{ __typename?: 'Gene', symbol: string, ncbiGeneId?: number | null, description?: string | null, summary?: string | null }> } } | null };

export type GeneSetDetailsByTermQueryVariables = Exact<{
  term: Scalars['String']['input'];
}>;


export type GeneSetDetailsByTermQuery = { __typename?: 'Query', geneSetByTerm?: { __typename?: 'GeneSet', term: string, description?: string | null, genes: { __typename?: 'GenesConnection', nodes: Array<{ __typename?: 'Gene', symbol: string, ncbiGeneId?: number | null, description?: string | null, summary?: string | null }> } } | null };

export type OverlapQueryQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
}>;


export type OverlapQueryQuery = { __typename?: 'Query', geneSet?: { __typename?: 'GeneSet', overlap: { __typename?: 'GenesConnection', nodes: Array<{ __typename?: 'Gene', symbol: string, ncbiGeneId?: number | null, description?: string | null, summary?: string | null }> } } | null };

export type FetchGeneInfoQueryVariables = Exact<{
  genes: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
}>;


export type FetchGeneInfoQuery = { __typename?: 'Query', geneMap2?: { __typename?: 'GeneMappingsConnection', nodes: Array<{ __typename?: 'GeneMapping', gene?: string | null, geneInfo?: { __typename?: 'Gene', symbol: string, ncbiGeneId?: number | null, description?: string | null, summary?: string | null } | null }> } | null };

export type LatestReleaseQueryVariables = Exact<{ [key: string]: never; }>;


export type LatestReleaseQuery = { __typename?: 'Query', releases?: { __typename?: 'ReleasesConnection', nodes: Array<{ __typename?: 'Release', created?: any | null }> } | null };

export type TermSearchGeneSetsQueryVariables = Exact<{
  filterTerm: Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>;
  libraryNames?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>> | InputMaybe<Scalars['String']['input']>>;
}>;


export type TermSearchGeneSetsQuery = { __typename?: 'Query', geneSetTermSearch?: { __typename?: 'GeneSetsConnection', totalCount: number, nodes: Array<{ __typename?: 'GeneSet', term: string, genes: { __typename?: 'GenesConnection', nodes: Array<{ __typename?: 'Gene', symbol: string }> } }>, pageInfo: { __typename?: 'PageInfo', endCursor?: any | null, hasNextPage: boolean, hasPreviousPage: boolean, startCursor?: any | null } } | null };


export const StatsDocument = gql`
    query Stats {
  userGeneSets {
    totalCount
  }
  geneSets {
    totalCount
  }
}
    `;

/**
 * __useStatsQuery__
 *
 * To run a query within a React component, call `useStatsQuery` and pass it any options that fit your needs.
 * When your component renders, `useStatsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useStatsQuery({
 *   variables: {
 *   },
 * });
 */
export function useStatsQuery(baseOptions?: Apollo.QueryHookOptions<StatsQuery, StatsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<StatsQuery, StatsQueryVariables>(StatsDocument, options);
      }
export function useStatsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<StatsQuery, StatsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<StatsQuery, StatsQueryVariables>(StatsDocument, options);
        }
export type StatsQueryHookResult = ReturnType<typeof useStatsQuery>;
export type StatsLazyQueryHookResult = ReturnType<typeof useStatsLazyQuery>;
export type StatsQueryResult = Apollo.QueryResult<StatsQuery, StatsQueryVariables>;
export const FetchUserGeneSetDocument = gql`
    query FetchUserGeneSet($id: UUID!) {
  userGeneSet(id: $id) {
    genes
    description
  }
}
    `;

/**
 * __useFetchUserGeneSetQuery__
 *
 * To run a query within a React component, call `useFetchUserGeneSetQuery` and pass it any options that fit your needs.
 * When your component renders, `useFetchUserGeneSetQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useFetchUserGeneSetQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useFetchUserGeneSetQuery(baseOptions: Apollo.QueryHookOptions<FetchUserGeneSetQuery, FetchUserGeneSetQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<FetchUserGeneSetQuery, FetchUserGeneSetQueryVariables>(FetchUserGeneSetDocument, options);
      }
export function useFetchUserGeneSetLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<FetchUserGeneSetQuery, FetchUserGeneSetQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<FetchUserGeneSetQuery, FetchUserGeneSetQueryVariables>(FetchUserGeneSetDocument, options);
        }
export type FetchUserGeneSetQueryHookResult = ReturnType<typeof useFetchUserGeneSetQuery>;
export type FetchUserGeneSetLazyQueryHookResult = ReturnType<typeof useFetchUserGeneSetLazyQuery>;
export type FetchUserGeneSetQueryResult = Apollo.QueryResult<FetchUserGeneSetQuery, FetchUserGeneSetQueryVariables>;
export const EnrichmentQueryDocument = gql`
    query EnrichmentQuery($genes: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    enrich(
      genes: $genes
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
    ) {
      nodes {
        geneSetId
        geneSetHash
        libraryCount
        supportingLibraries
        pvalue
        adjPvalue
        oddsRatio
        nOverlap
        geneSets {
          nodes {
            id
            term
            description
            nGeneIds
            library {
              name
            }
            geneSetFdaCountsById {
              nodes {
                approved
                count
                totalCount
                moa
              }
            }
          }
          totalCount
        }
      }
      totalCount
      consensusCount
      moasCount
      geneSetCount
      consensus {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
      moas {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
    }
  }
}
    `;

/**
 * __useEnrichmentQueryQuery__
 *
 * To run a query within a React component, call `useEnrichmentQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `useEnrichmentQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useEnrichmentQueryQuery({
 *   variables: {
 *      genes: // value for 'genes'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function useEnrichmentQueryQuery(baseOptions: Apollo.QueryHookOptions<EnrichmentQueryQuery, EnrichmentQueryQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<EnrichmentQueryQuery, EnrichmentQueryQueryVariables>(EnrichmentQueryDocument, options);
      }
export function useEnrichmentQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<EnrichmentQueryQuery, EnrichmentQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<EnrichmentQueryQuery, EnrichmentQueryQueryVariables>(EnrichmentQueryDocument, options);
        }
export type EnrichmentQueryQueryHookResult = ReturnType<typeof useEnrichmentQueryQuery>;
export type EnrichmentQueryLazyQueryHookResult = ReturnType<typeof useEnrichmentQueryLazyQuery>;
export type EnrichmentQueryQueryResult = Apollo.QueryResult<EnrichmentQueryQuery, EnrichmentQueryQueryVariables>;
export const EnrichmentQuerySingleDocument = gql`
    query EnrichmentQuerySingle($genes: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    enrich(
      genes: $genes
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
    ) {
      nodes {
        geneSetId
        geneSetHash
        libraryCount
        supportingLibraries
        pvalue
        adjPvalue
        oddsRatio
        nOverlap
        geneSets {
          nodes {
            id
            term
            description
            nGeneIds
            library {
              name
            }
            geneSetFdaCountsById {
              nodes {
                approved
                count
                totalCount
                moa
              }
            }
          }
          totalCount
        }
      }
    }
  }
}
    `;

/**
 * __useEnrichmentQuerySingleQuery__
 *
 * To run a query within a React component, call `useEnrichmentQuerySingleQuery` and pass it any options that fit your needs.
 * When your component renders, `useEnrichmentQuerySingleQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useEnrichmentQuerySingleQuery({
 *   variables: {
 *      genes: // value for 'genes'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function useEnrichmentQuerySingleQuery(baseOptions: Apollo.QueryHookOptions<EnrichmentQuerySingleQuery, EnrichmentQuerySingleQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<EnrichmentQuerySingleQuery, EnrichmentQuerySingleQueryVariables>(EnrichmentQuerySingleDocument, options);
      }
export function useEnrichmentQuerySingleLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<EnrichmentQuerySingleQuery, EnrichmentQuerySingleQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<EnrichmentQuerySingleQuery, EnrichmentQuerySingleQueryVariables>(EnrichmentQuerySingleDocument, options);
        }
export type EnrichmentQuerySingleQueryHookResult = ReturnType<typeof useEnrichmentQuerySingleQuery>;
export type EnrichmentQuerySingleLazyQueryHookResult = ReturnType<typeof useEnrichmentQuerySingleLazyQuery>;
export type EnrichmentQuerySingleQueryResult = Apollo.QueryResult<EnrichmentQuerySingleQuery, EnrichmentQuerySingleQueryVariables>;
export const EnrichmentQueryConsensusDocument = gql`
    query EnrichmentQueryConsensus($genes: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    enrich(
      genes: $genes
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
    ) {
      consensus {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
      consensusCount
    }
  }
}
    `;

/**
 * __useEnrichmentQueryConsensusQuery__
 *
 * To run a query within a React component, call `useEnrichmentQueryConsensusQuery` and pass it any options that fit your needs.
 * When your component renders, `useEnrichmentQueryConsensusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useEnrichmentQueryConsensusQuery({
 *   variables: {
 *      genes: // value for 'genes'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function useEnrichmentQueryConsensusQuery(baseOptions: Apollo.QueryHookOptions<EnrichmentQueryConsensusQuery, EnrichmentQueryConsensusQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<EnrichmentQueryConsensusQuery, EnrichmentQueryConsensusQueryVariables>(EnrichmentQueryConsensusDocument, options);
      }
export function useEnrichmentQueryConsensusLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<EnrichmentQueryConsensusQuery, EnrichmentQueryConsensusQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<EnrichmentQueryConsensusQuery, EnrichmentQueryConsensusQueryVariables>(EnrichmentQueryConsensusDocument, options);
        }
export type EnrichmentQueryConsensusQueryHookResult = ReturnType<typeof useEnrichmentQueryConsensusQuery>;
export type EnrichmentQueryConsensusLazyQueryHookResult = ReturnType<typeof useEnrichmentQueryConsensusLazyQuery>;
export type EnrichmentQueryConsensusQueryResult = Apollo.QueryResult<EnrichmentQueryConsensusQuery, EnrichmentQueryConsensusQueryVariables>;
export const EnrichmentQueryMoAsDocument = gql`
    query EnrichmentQueryMoAs($genes: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    enrich(
      genes: $genes
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
    ) {
      moas {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
      moasCount
    }
  }
}
    `;

/**
 * __useEnrichmentQueryMoAsQuery__
 *
 * To run a query within a React component, call `useEnrichmentQueryMoAsQuery` and pass it any options that fit your needs.
 * When your component renders, `useEnrichmentQueryMoAsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useEnrichmentQueryMoAsQuery({
 *   variables: {
 *      genes: // value for 'genes'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function useEnrichmentQueryMoAsQuery(baseOptions: Apollo.QueryHookOptions<EnrichmentQueryMoAsQuery, EnrichmentQueryMoAsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<EnrichmentQueryMoAsQuery, EnrichmentQueryMoAsQueryVariables>(EnrichmentQueryMoAsDocument, options);
      }
export function useEnrichmentQueryMoAsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<EnrichmentQueryMoAsQuery, EnrichmentQueryMoAsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<EnrichmentQueryMoAsQuery, EnrichmentQueryMoAsQueryVariables>(EnrichmentQueryMoAsDocument, options);
        }
export type EnrichmentQueryMoAsQueryHookResult = ReturnType<typeof useEnrichmentQueryMoAsQuery>;
export type EnrichmentQueryMoAsLazyQueryHookResult = ReturnType<typeof useEnrichmentQueryMoAsLazyQuery>;
export type EnrichmentQueryMoAsQueryResult = Apollo.QueryResult<EnrichmentQueryMoAsQuery, EnrichmentQueryMoAsQueryVariables>;
export const PairEnrichmentQueryDocument = gql`
    query PairEnrichmentQuery($genesUp: [String]!, $genesDown: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    pairedEnrich(
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
      genesDown: $genesDown
      genesUp: $genesUp
    ) {
      totalCount
      consensusCount
      moasCount
      geneSetCount
      consensus {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
      moas {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
      nodes {
        geneSetIdUp
        geneSetIdDown
        adjPvalueMimic
        adjPvalueReverse
        geneSetHashDown
        geneSetHashUp
        libraryCount
        supportingLibraries
        mimickerOverlap
        oddsRatioMimic
        geneSetHashUp
        oddsRatioReverse
        pvalueMimic
        pvalueReverse
        reverserOverlap
        geneSet {
          nodes {
            description
            id
            nGeneIds
            term
            library {
              name
            }
            geneSetFdaCountsById {
              nodes {
                count
                totalCount
                approved
                moa
              }
            }
          }
        }
      }
    }
  }
}
    `;

/**
 * __usePairEnrichmentQueryQuery__
 *
 * To run a query within a React component, call `usePairEnrichmentQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `usePairEnrichmentQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePairEnrichmentQueryQuery({
 *   variables: {
 *      genesUp: // value for 'genesUp'
 *      genesDown: // value for 'genesDown'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function usePairEnrichmentQueryQuery(baseOptions: Apollo.QueryHookOptions<PairEnrichmentQueryQuery, PairEnrichmentQueryQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PairEnrichmentQueryQuery, PairEnrichmentQueryQueryVariables>(PairEnrichmentQueryDocument, options);
      }
export function usePairEnrichmentQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PairEnrichmentQueryQuery, PairEnrichmentQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PairEnrichmentQueryQuery, PairEnrichmentQueryQueryVariables>(PairEnrichmentQueryDocument, options);
        }
export type PairEnrichmentQueryQueryHookResult = ReturnType<typeof usePairEnrichmentQueryQuery>;
export type PairEnrichmentQueryLazyQueryHookResult = ReturnType<typeof usePairEnrichmentQueryLazyQuery>;
export type PairEnrichmentQueryQueryResult = Apollo.QueryResult<PairEnrichmentQueryQuery, PairEnrichmentQueryQueryVariables>;
export const PairEnrichmentQuerySingleDocument = gql`
    query PairEnrichmentQuerySingle($genesUp: [String]!, $genesDown: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    pairedEnrich(
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
      genesDown: $genesDown
      genesUp: $genesUp
    ) {
      totalCount
      nodes {
        geneSetIdUp
        geneSetIdDown
        adjPvalueMimic
        adjPvalueReverse
        geneSetHashDown
        geneSetHashUp
        libraryCount
        supportingLibraries
        mimickerOverlap
        oddsRatioMimic
        geneSetHashUp
        oddsRatioReverse
        pvalueMimic
        pvalueReverse
        reverserOverlap
        geneSet {
          nodes {
            description
            id
            nGeneIds
            term
            library {
              name
            }
            geneSetFdaCountsById {
              nodes {
                count
                totalCount
                approved
                moa
              }
            }
          }
        }
      }
    }
  }
}
    `;

/**
 * __usePairEnrichmentQuerySingleQuery__
 *
 * To run a query within a React component, call `usePairEnrichmentQuerySingleQuery` and pass it any options that fit your needs.
 * When your component renders, `usePairEnrichmentQuerySingleQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePairEnrichmentQuerySingleQuery({
 *   variables: {
 *      genesUp: // value for 'genesUp'
 *      genesDown: // value for 'genesDown'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function usePairEnrichmentQuerySingleQuery(baseOptions: Apollo.QueryHookOptions<PairEnrichmentQuerySingleQuery, PairEnrichmentQuerySingleQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PairEnrichmentQuerySingleQuery, PairEnrichmentQuerySingleQueryVariables>(PairEnrichmentQuerySingleDocument, options);
      }
export function usePairEnrichmentQuerySingleLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PairEnrichmentQuerySingleQuery, PairEnrichmentQuerySingleQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PairEnrichmentQuerySingleQuery, PairEnrichmentQuerySingleQueryVariables>(PairEnrichmentQuerySingleDocument, options);
        }
export type PairEnrichmentQuerySingleQueryHookResult = ReturnType<typeof usePairEnrichmentQuerySingleQuery>;
export type PairEnrichmentQuerySingleLazyQueryHookResult = ReturnType<typeof usePairEnrichmentQuerySingleLazyQuery>;
export type PairEnrichmentQuerySingleQueryResult = Apollo.QueryResult<PairEnrichmentQuerySingleQuery, PairEnrichmentQuerySingleQueryVariables>;
export const PairEnrichmentQueryConsensusDocument = gql`
    query PairEnrichmentQueryConsensus($genesUp: [String]!, $genesDown: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    pairedEnrich(
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
      genesDown: $genesDown
      genesUp: $genesUp
    ) {
      consensusCount
      consensus {
        drug
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
    }
  }
}
    `;

/**
 * __usePairEnrichmentQueryConsensusQuery__
 *
 * To run a query within a React component, call `usePairEnrichmentQueryConsensusQuery` and pass it any options that fit your needs.
 * When your component renders, `usePairEnrichmentQueryConsensusQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePairEnrichmentQueryConsensusQuery({
 *   variables: {
 *      genesUp: // value for 'genesUp'
 *      genesDown: // value for 'genesDown'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function usePairEnrichmentQueryConsensusQuery(baseOptions: Apollo.QueryHookOptions<PairEnrichmentQueryConsensusQuery, PairEnrichmentQueryConsensusQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PairEnrichmentQueryConsensusQuery, PairEnrichmentQueryConsensusQueryVariables>(PairEnrichmentQueryConsensusDocument, options);
      }
export function usePairEnrichmentQueryConsensusLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PairEnrichmentQueryConsensusQuery, PairEnrichmentQueryConsensusQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PairEnrichmentQueryConsensusQuery, PairEnrichmentQueryConsensusQueryVariables>(PairEnrichmentQueryConsensusDocument, options);
        }
export type PairEnrichmentQueryConsensusQueryHookResult = ReturnType<typeof usePairEnrichmentQueryConsensusQuery>;
export type PairEnrichmentQueryConsensusLazyQueryHookResult = ReturnType<typeof usePairEnrichmentQueryConsensusLazyQuery>;
export type PairEnrichmentQueryConsensusQueryResult = Apollo.QueryResult<PairEnrichmentQueryConsensusQuery, PairEnrichmentQueryConsensusQueryVariables>;
export const PairEnrichmentQueryMoAsDocument = gql`
    query PairEnrichmentQueryMoAs($genesUp: [String]!, $genesDown: [String]!, $filterTerm: String = "", $libraryNames: [String], $offset: Int = 0, $first: Int = 10, $filterFda: Boolean = false, $sortBy: String = "", $filterKo: Boolean = false, $topN: Int = 10000, $pvalueLe: Float = 0.05) {
  currentBackground {
    pairedEnrich(
      filterTerm: $filterTerm
      libraryNames: $libraryNames
      offset: $offset
      first: $first
      filterFda: $filterFda
      sortby: $sortBy
      filterKo: $filterKo
      topN: $topN
      pvalueLe: $pvalueLe
      genesDown: $genesDown
      genesUp: $genesUp
    ) {
      moasCount
      moas {
        drug
        cid
        oddsRatio
        pvalue
        adjPvalue
        approved
        countSignificant
        countInsignificant
        countUpSignificant
        pvalueUp
        adjPvalueUp
        oddsRatioUp
        pvalueDown
        adjPvalueDown
        oddsRatioDown
        libraries
        contributingSignatures
      }
    }
  }
}
    `;

/**
 * __usePairEnrichmentQueryMoAsQuery__
 *
 * To run a query within a React component, call `usePairEnrichmentQueryMoAsQuery` and pass it any options that fit your needs.
 * When your component renders, `usePairEnrichmentQueryMoAsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePairEnrichmentQueryMoAsQuery({
 *   variables: {
 *      genesUp: // value for 'genesUp'
 *      genesDown: // value for 'genesDown'
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *      filterFda: // value for 'filterFda'
 *      sortBy: // value for 'sortBy'
 *      filterKo: // value for 'filterKo'
 *      topN: // value for 'topN'
 *      pvalueLe: // value for 'pvalueLe'
 *   },
 * });
 */
export function usePairEnrichmentQueryMoAsQuery(baseOptions: Apollo.QueryHookOptions<PairEnrichmentQueryMoAsQuery, PairEnrichmentQueryMoAsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PairEnrichmentQueryMoAsQuery, PairEnrichmentQueryMoAsQueryVariables>(PairEnrichmentQueryMoAsDocument, options);
      }
export function usePairEnrichmentQueryMoAsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PairEnrichmentQueryMoAsQuery, PairEnrichmentQueryMoAsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PairEnrichmentQueryMoAsQuery, PairEnrichmentQueryMoAsQueryVariables>(PairEnrichmentQueryMoAsDocument, options);
        }
export type PairEnrichmentQueryMoAsQueryHookResult = ReturnType<typeof usePairEnrichmentQueryMoAsQuery>;
export type PairEnrichmentQueryMoAsLazyQueryHookResult = ReturnType<typeof usePairEnrichmentQueryMoAsLazyQuery>;
export type PairEnrichmentQueryMoAsQueryResult = Apollo.QueryResult<PairEnrichmentQueryMoAsQuery, PairEnrichmentQueryMoAsQueryVariables>;
export const AllLibrariesDocument = gql`
    query AllLibraries {
  geneSetLibraries {
    nodes {
      id
      name
      geneSetsByLibraryId {
        totalCount
      }
    }
  }
}
    `;

/**
 * __useAllLibrariesQuery__
 *
 * To run a query within a React component, call `useAllLibrariesQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllLibrariesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllLibrariesQuery({
 *   variables: {
 *   },
 * });
 */
export function useAllLibrariesQuery(baseOptions?: Apollo.QueryHookOptions<AllLibrariesQuery, AllLibrariesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllLibrariesQuery, AllLibrariesQueryVariables>(AllLibrariesDocument, options);
      }
export function useAllLibrariesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllLibrariesQuery, AllLibrariesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllLibrariesQuery, AllLibrariesQueryVariables>(AllLibrariesDocument, options);
        }
export type AllLibrariesQueryHookResult = ReturnType<typeof useAllLibrariesQuery>;
export type AllLibrariesLazyQueryHookResult = ReturnType<typeof useAllLibrariesLazyQuery>;
export type AllLibrariesQueryResult = Apollo.QueryResult<AllLibrariesQuery, AllLibrariesQueryVariables>;
export const GeneSearchDocument = gql`
    query GeneSearch($genes: [String]!, $libraryNames: [String], $offset: Int = 0, $first: Int = 10) {
  geneSetGeneSearch(
    genes: $genes
    libraryNames: $libraryNames
    offset: $offset
    first: $first
  ) {
    nodes {
      term
    }
    totalCount
  }
}
    `;

/**
 * __useGeneSearchQuery__
 *
 * To run a query within a React component, call `useGeneSearchQuery` and pass it any options that fit your needs.
 * When your component renders, `useGeneSearchQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGeneSearchQuery({
 *   variables: {
 *      genes: // value for 'genes'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *   },
 * });
 */
export function useGeneSearchQuery(baseOptions: Apollo.QueryHookOptions<GeneSearchQuery, GeneSearchQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GeneSearchQuery, GeneSearchQueryVariables>(GeneSearchDocument, options);
      }
export function useGeneSearchLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GeneSearchQuery, GeneSearchQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GeneSearchQuery, GeneSearchQueryVariables>(GeneSearchDocument, options);
        }
export type GeneSearchQueryHookResult = ReturnType<typeof useGeneSearchQuery>;
export type GeneSearchLazyQueryHookResult = ReturnType<typeof useGeneSearchLazyQuery>;
export type GeneSearchQueryResult = Apollo.QueryResult<GeneSearchQuery, GeneSearchQueryVariables>;
export const TermSearchDocument = gql`
    query TermSearch($terms: [String]!, $libraryNames: [String], $offset: Int = 0, $first: Int = 10) {
  geneSetTermSearch(
    terms: $terms
    libraryNames: $libraryNames
    offset: $offset
    first: $first
  ) {
    nodes {
      id
      term
      nGeneIds
      library {
        name
      }
    }
    totalCount
  }
}
    `;

/**
 * __useTermSearchQuery__
 *
 * To run a query within a React component, call `useTermSearchQuery` and pass it any options that fit your needs.
 * When your component renders, `useTermSearchQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTermSearchQuery({
 *   variables: {
 *      terms: // value for 'terms'
 *      libraryNames: // value for 'libraryNames'
 *      offset: // value for 'offset'
 *      first: // value for 'first'
 *   },
 * });
 */
export function useTermSearchQuery(baseOptions: Apollo.QueryHookOptions<TermSearchQuery, TermSearchQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TermSearchQuery, TermSearchQueryVariables>(TermSearchDocument, options);
      }
export function useTermSearchLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TermSearchQuery, TermSearchQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TermSearchQuery, TermSearchQueryVariables>(TermSearchDocument, options);
        }
export type TermSearchQueryHookResult = ReturnType<typeof useTermSearchQuery>;
export type TermSearchLazyQueryHookResult = ReturnType<typeof useTermSearchLazyQuery>;
export type TermSearchQueryResult = Apollo.QueryResult<TermSearchQuery, TermSearchQueryVariables>;
export const AddUserGeneSetDocument = gql`
    mutation AddUserGeneSet($genes: [String], $description: String = "") {
  addUserGeneSet(input: {genes: $genes, description: $description}) {
    userGeneSet {
      id
    }
  }
}
    `;
export type AddUserGeneSetMutationFn = Apollo.MutationFunction<AddUserGeneSetMutation, AddUserGeneSetMutationVariables>;

/**
 * __useAddUserGeneSetMutation__
 *
 * To run a mutation, you first call `useAddUserGeneSetMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddUserGeneSetMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addUserGeneSetMutation, { data, loading, error }] = useAddUserGeneSetMutation({
 *   variables: {
 *      genes: // value for 'genes'
 *      description: // value for 'description'
 *   },
 * });
 */
export function useAddUserGeneSetMutation(baseOptions?: Apollo.MutationHookOptions<AddUserGeneSetMutation, AddUserGeneSetMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddUserGeneSetMutation, AddUserGeneSetMutationVariables>(AddUserGeneSetDocument, options);
      }
export type AddUserGeneSetMutationHookResult = ReturnType<typeof useAddUserGeneSetMutation>;
export type AddUserGeneSetMutationResult = Apollo.MutationResult<AddUserGeneSetMutation>;
export type AddUserGeneSetMutationOptions = Apollo.BaseMutationOptions<AddUserGeneSetMutation, AddUserGeneSetMutationVariables>;
export const GeneSetGenesByIdDocument = gql`
    query GeneSetGenesById($id: UUID!) {
  geneSet(id: $id) {
    genes {
      nodes {
        symbol
        ncbiGeneId
        description
        summary
      }
    }
  }
}
    `;

/**
 * __useGeneSetGenesByIdQuery__
 *
 * To run a query within a React component, call `useGeneSetGenesByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGeneSetGenesByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGeneSetGenesByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGeneSetGenesByIdQuery(baseOptions: Apollo.QueryHookOptions<GeneSetGenesByIdQuery, GeneSetGenesByIdQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GeneSetGenesByIdQuery, GeneSetGenesByIdQueryVariables>(GeneSetGenesByIdDocument, options);
      }
export function useGeneSetGenesByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GeneSetGenesByIdQuery, GeneSetGenesByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GeneSetGenesByIdQuery, GeneSetGenesByIdQueryVariables>(GeneSetGenesByIdDocument, options);
        }
export type GeneSetGenesByIdQueryHookResult = ReturnType<typeof useGeneSetGenesByIdQuery>;
export type GeneSetGenesByIdLazyQueryHookResult = ReturnType<typeof useGeneSetGenesByIdLazyQuery>;
export type GeneSetGenesByIdQueryResult = Apollo.QueryResult<GeneSetGenesByIdQuery, GeneSetGenesByIdQueryVariables>;
export const GeneSetDetailsByIdDocument = gql`
    query GeneSetDetailsById($id: UUID!) {
  geneSet(id: $id) {
    term
    description
    genes {
      nodes {
        symbol
        ncbiGeneId
        description
        summary
      }
    }
  }
}
    `;

/**
 * __useGeneSetDetailsByIdQuery__
 *
 * To run a query within a React component, call `useGeneSetDetailsByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGeneSetDetailsByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGeneSetDetailsByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGeneSetDetailsByIdQuery(baseOptions: Apollo.QueryHookOptions<GeneSetDetailsByIdQuery, GeneSetDetailsByIdQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GeneSetDetailsByIdQuery, GeneSetDetailsByIdQueryVariables>(GeneSetDetailsByIdDocument, options);
      }
export function useGeneSetDetailsByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GeneSetDetailsByIdQuery, GeneSetDetailsByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GeneSetDetailsByIdQuery, GeneSetDetailsByIdQueryVariables>(GeneSetDetailsByIdDocument, options);
        }
export type GeneSetDetailsByIdQueryHookResult = ReturnType<typeof useGeneSetDetailsByIdQuery>;
export type GeneSetDetailsByIdLazyQueryHookResult = ReturnType<typeof useGeneSetDetailsByIdLazyQuery>;
export type GeneSetDetailsByIdQueryResult = Apollo.QueryResult<GeneSetDetailsByIdQuery, GeneSetDetailsByIdQueryVariables>;
export const GeneSetDetailsByTermDocument = gql`
    query GeneSetDetailsByTerm($term: String!) {
  geneSetByTerm(term: $term) {
    term
    description
    genes {
      nodes {
        symbol
        ncbiGeneId
        description
        summary
      }
    }
  }
}
    `;

/**
 * __useGeneSetDetailsByTermQuery__
 *
 * To run a query within a React component, call `useGeneSetDetailsByTermQuery` and pass it any options that fit your needs.
 * When your component renders, `useGeneSetDetailsByTermQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGeneSetDetailsByTermQuery({
 *   variables: {
 *      term: // value for 'term'
 *   },
 * });
 */
export function useGeneSetDetailsByTermQuery(baseOptions: Apollo.QueryHookOptions<GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables>(GeneSetDetailsByTermDocument, options);
      }
export function useGeneSetDetailsByTermLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables>(GeneSetDetailsByTermDocument, options);
        }
export type GeneSetDetailsByTermQueryHookResult = ReturnType<typeof useGeneSetDetailsByTermQuery>;
export type GeneSetDetailsByTermLazyQueryHookResult = ReturnType<typeof useGeneSetDetailsByTermLazyQuery>;
export type GeneSetDetailsByTermQueryResult = Apollo.QueryResult<GeneSetDetailsByTermQuery, GeneSetDetailsByTermQueryVariables>;
export const OverlapQueryDocument = gql`
    query OverlapQuery($id: UUID!, $genes: [String]!) {
  geneSet(id: $id) {
    overlap(genes: $genes) {
      nodes {
        symbol
        ncbiGeneId
        description
        summary
      }
    }
  }
}
    `;

/**
 * __useOverlapQueryQuery__
 *
 * To run a query within a React component, call `useOverlapQueryQuery` and pass it any options that fit your needs.
 * When your component renders, `useOverlapQueryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOverlapQueryQuery({
 *   variables: {
 *      id: // value for 'id'
 *      genes: // value for 'genes'
 *   },
 * });
 */
export function useOverlapQueryQuery(baseOptions: Apollo.QueryHookOptions<OverlapQueryQuery, OverlapQueryQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OverlapQueryQuery, OverlapQueryQueryVariables>(OverlapQueryDocument, options);
      }
export function useOverlapQueryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OverlapQueryQuery, OverlapQueryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OverlapQueryQuery, OverlapQueryQueryVariables>(OverlapQueryDocument, options);
        }
export type OverlapQueryQueryHookResult = ReturnType<typeof useOverlapQueryQuery>;
export type OverlapQueryLazyQueryHookResult = ReturnType<typeof useOverlapQueryLazyQuery>;
export type OverlapQueryQueryResult = Apollo.QueryResult<OverlapQueryQuery, OverlapQueryQueryVariables>;
export const FetchGeneInfoDocument = gql`
    query FetchGeneInfo($genes: [String]!) {
  geneMap2(genes: $genes) {
    nodes {
      gene
      geneInfo {
        symbol
        ncbiGeneId
        description
        summary
      }
    }
  }
}
    `;

/**
 * __useFetchGeneInfoQuery__
 *
 * To run a query within a React component, call `useFetchGeneInfoQuery` and pass it any options that fit your needs.
 * When your component renders, `useFetchGeneInfoQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useFetchGeneInfoQuery({
 *   variables: {
 *      genes: // value for 'genes'
 *   },
 * });
 */
export function useFetchGeneInfoQuery(baseOptions: Apollo.QueryHookOptions<FetchGeneInfoQuery, FetchGeneInfoQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<FetchGeneInfoQuery, FetchGeneInfoQueryVariables>(FetchGeneInfoDocument, options);
      }
export function useFetchGeneInfoLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<FetchGeneInfoQuery, FetchGeneInfoQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<FetchGeneInfoQuery, FetchGeneInfoQueryVariables>(FetchGeneInfoDocument, options);
        }
export type FetchGeneInfoQueryHookResult = ReturnType<typeof useFetchGeneInfoQuery>;
export type FetchGeneInfoLazyQueryHookResult = ReturnType<typeof useFetchGeneInfoLazyQuery>;
export type FetchGeneInfoQueryResult = Apollo.QueryResult<FetchGeneInfoQuery, FetchGeneInfoQueryVariables>;
export const LatestReleaseDocument = gql`
    query LatestRelease {
  releases(orderBy: CREATED_DESC, first: 1) {
    nodes {
      created
    }
  }
}
    `;

/**
 * __useLatestReleaseQuery__
 *
 * To run a query within a React component, call `useLatestReleaseQuery` and pass it any options that fit your needs.
 * When your component renders, `useLatestReleaseQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLatestReleaseQuery({
 *   variables: {
 *   },
 * });
 */
export function useLatestReleaseQuery(baseOptions?: Apollo.QueryHookOptions<LatestReleaseQuery, LatestReleaseQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<LatestReleaseQuery, LatestReleaseQueryVariables>(LatestReleaseDocument, options);
      }
export function useLatestReleaseLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<LatestReleaseQuery, LatestReleaseQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<LatestReleaseQuery, LatestReleaseQueryVariables>(LatestReleaseDocument, options);
        }
export type LatestReleaseQueryHookResult = ReturnType<typeof useLatestReleaseQuery>;
export type LatestReleaseLazyQueryHookResult = ReturnType<typeof useLatestReleaseLazyQuery>;
export type LatestReleaseQueryResult = Apollo.QueryResult<LatestReleaseQuery, LatestReleaseQueryVariables>;
export const TermSearchGeneSetsDocument = gql`
    query TermSearchGeneSets($filterTerm: [String]!, $libraryNames: [String]) {
  geneSetTermSearch(terms: $filterTerm, libraryNames: $libraryNames) {
    nodes {
      term
      genes {
        nodes {
          symbol
        }
      }
    }
    totalCount
    pageInfo {
      endCursor
      hasNextPage
      hasPreviousPage
      startCursor
    }
  }
}
    `;

/**
 * __useTermSearchGeneSetsQuery__
 *
 * To run a query within a React component, call `useTermSearchGeneSetsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTermSearchGeneSetsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTermSearchGeneSetsQuery({
 *   variables: {
 *      filterTerm: // value for 'filterTerm'
 *      libraryNames: // value for 'libraryNames'
 *   },
 * });
 */
export function useTermSearchGeneSetsQuery(baseOptions: Apollo.QueryHookOptions<TermSearchGeneSetsQuery, TermSearchGeneSetsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TermSearchGeneSetsQuery, TermSearchGeneSetsQueryVariables>(TermSearchGeneSetsDocument, options);
      }
export function useTermSearchGeneSetsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TermSearchGeneSetsQuery, TermSearchGeneSetsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TermSearchGeneSetsQuery, TermSearchGeneSetsQueryVariables>(TermSearchGeneSetsDocument, options);
        }
export type TermSearchGeneSetsQueryHookResult = ReturnType<typeof useTermSearchGeneSetsQuery>;
export type TermSearchGeneSetsLazyQueryHookResult = ReturnType<typeof useTermSearchGeneSetsLazyQuery>;
export type TermSearchGeneSetsQueryResult = Apollo.QueryResult<TermSearchGeneSetsQuery, TermSearchGeneSetsQueryVariables>;