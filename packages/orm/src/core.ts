/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-constructor */
/* eslint-disable dot-notation */
/* eslint-disable no-use-before-define */

import type {
  ComplexDataType,
  ComplexField,
  FieldMapping,
  SearchClient,
  SearchField,
  SearchFieldDataType,
  SearchIndex,
  SearchIndexClient,
  SearchIndexer,
  SimpleField,
  SearchResourceEncryptionKey,
  IndexingParameters,
  IndexingSchedule,
  SearchIndexerDataSourceConnection,
  SearchIndexerDataContainer,
  DataChangeDetectionPolicy,
  SoftDeleteColumnDeletionDetectionPolicy,
  SearchIndexerDataSourceType,
  LexicalAnalyzer,
  CharFilter,
  CorsOptions,
  ScoringProfile,
  SemanticSearch,
  SimilarityAlgorithm,
  TokenFilter,
  SearchSuggester,
  LexicalTokenizer,
  VectorSearch,
} from "@azure/search-documents";

export type Collection<T> = Array<T>;
export type Primitive =
  | string
  | number
  | Date
  | boolean
  | null
  | string[]
  | number[]
  | Date[]
  | boolean[];
export type PlainObject = { [property: string]: Primitive };
export type FieldType =
  | Primitive
  | Collection<Primitive>
  | Collection<PlainObject>;

const isComplexFieldDataType = (
  type: ComplexDataType | SearchFieldDataType
): type is ComplexDataType => {
  return type === "Edm.ComplexType" || type === "Collection(Edm.ComplexType)";
};

export abstract class FieldBuilder {
  protected config: SearchField;
  protected fields: Record<string, FieldBuilder> = {};
  protected hasSuggester: boolean = false;

  constructor(
    name: string,
    type: ComplexDataType | SearchFieldDataType,
    fields: Record<string, FieldBuilder> = {}
  ) {
    if (!isComplexFieldDataType(type)) {
      this.config = {
        name,
        type,
        analyzerName: undefined,
        facetable: false,
        filterable: false,
        hidden: false,
        indexAnalyzerName: undefined,
        key: false,
        searchable: false,
        searchAnalyzerName: undefined,
        sortable: false,
        synonymMapNames: [],
        vectorSearchDimensions: undefined,
        vectorSearchProfileName: undefined,

        // seemingly doesn't exist in docs?  But the index returned from Azure
        // includes it.  Adding for differencing.
        synonymMaps: [],
      } as SimpleField;

      return;
    }

    if (Object.keys(fields).length === 0) {
      throw new Error(`Collection ${name} cannot be empty.`);
    }

    this.config = {
      name,
      type,
      fields: [],
    } as ComplexField;

    this.fields = fields;
  }

  /* @internal */
  abstract build(name?: string): SearchField;

  /* @internal */
  abstract getDatasourceFieldName(): string;

  /* @internal */
  abstract getType(): SearchFieldDataType | ComplexDataType;
}

export class SimpleFieldBuilder<
  TType extends Primitive = Primitive,
  TNotNull extends boolean = boolean,
> extends FieldBuilder {
  key() {
    (this.config as SimpleField).key = true;
    return this as SimpleFieldBuilder<TType, true>;
  }

  searchable() {
    (this.config as SimpleField).searchable = true;

    return this as SimpleFieldBuilder<TType, TNotNull>;
  }

  filterable() {
    (this.config as SimpleField).filterable = true;

    return this as SimpleFieldBuilder<TType, TNotNull>;
  }

  facetable() {
    (this.config as SimpleField).facetable = true;

    return this as SimpleFieldBuilder<TType, TNotNull>;
  }

  sortable() {
    (this.config as SimpleField).sortable = true;

    return this as SimpleFieldBuilder<TType, TNotNull>;
  }

  hidden() {
    (this.config as SimpleField).hidden = true;

    return this as SimpleFieldBuilder<TType, TNotNull>;
  }

  notNull() {
    return this as SimpleFieldBuilder<TType, true>;
  }

  suggester() {
    this.hasSuggester = true;
    (this.config as SimpleField).searchable = true;

    return this as SimpleFieldBuilder<TType, TNotNull>;
  }

  /* @internal */
  getType() {
    return this.config.type;
  }

  /* @internal */
  getDatasourceFieldName(): string {
    return this.config.name;
  }

  // /* @internal */
  // getHasSuggseter() {
  //   return this.hasSuggester;
  // }

  /* @internal */
  build(name?: string) {
    return {
      ...this.config,
      name: name || this.config.name,
    } as SimpleField;
  }
}

export class ComplexFieldBuilder<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
> extends FieldBuilder {
  override hasSuggester = false;

  constructor(name: TName, fields: TFields) {
    super(name, "Edm.ComplexType", fields);
  }

  /* @internal */
  getDatasourceFieldName(): string {
    return this.config.name;
  }

  /* @internal */
  getType() {
    return this.config.type;
  }

  /* @internal */
  build(name?: TName): ComplexField {
    return {
      name: name || this.config.name,
      type: this.config.type as ComplexDataType,
      fields: Object.entries(this.fields).map(([name, fieldBuilder]) =>
        fieldBuilder["build"](name)
      ),
    };
  }
}

export class CollectionFieldBuilder<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
> extends FieldBuilder {
  protected override hasSuggester: boolean = false;

  constructor(name: TName, fields: TFields) {
    super(name, "Collection(Edm.ComplexType)", fields);
  }

  /* @internal */
  getDatasourceFieldName(): string {
    return this.config.name;
  }

  /* @internal */
  getType() {
    return this.config.type;
  }

  /* @internal */
  build(name?: TName): ComplexField {
    return {
      name: name || this.config.name,
      type: this.config.type as ComplexDataType,
      fields: Object.entries(this.fields).map(([name, fieldBuilder]) =>
        fieldBuilder["build"](name)
      ),
    };
  }
}

export function isIndex(index: any): index is AnyIndex {
  return !!index.fields;
}

export class Index<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
> implements SearchIndex
{
  name: TName;
  fields: SearchField[];
  analyzers?: LexicalAnalyzer[] | undefined;
  charFilters?: CharFilter[] | undefined;
  corsOptions?: CorsOptions | undefined;
  defaultScoringProfile?: string | undefined;
  encryptionKey?: SearchResourceEncryptionKey | undefined;
  etag?: string | undefined;
  scoringProfiles?: ScoringProfile[] | undefined;
  semanticSearch?: SemanticSearch | undefined;
  similarity?: SimilarityAlgorithm | undefined;
  tokenFilters?: TokenFilter[] | undefined;
  suggesters?: SearchSuggester[] | undefined;
  tokenizers?: LexicalTokenizer[] | undefined;
  vectorSearch?: VectorSearch | undefined;

  implicitFieldMappings: FieldMapping[];

  constructor(name: TName, fields: TFields) {
    this.name = name;
    this.fields = Object.entries(fields).map(([name, fieldBuilder]) =>
      fieldBuilder["build"](name)
    );
    this.suggesters = Object.values(fields).some(
      (field) => field["hasSuggester"]
    )
      ? [
          {
            name: "sg",
            searchMode: "analyzingInfixMatching",
            sourceFields: Object.entries(fields)
              .filter(([_, fieldBuilder]) => fieldBuilder["hasSuggester"])
              .map(([name]) => name),
          },
        ]
      : [];

    this.implicitFieldMappings = generateFieldMappings(fields);

    this.analyzers = [];
    this.charFilters = [];
    this.tokenFilters = [];
    this.scoringProfiles = [];
    this.tokenizers = [];
  }

  /* @internal */
  private build(): SearchIndex {
    const { implicitFieldMappings: _, ...index } = this;
    return index;
  }
}

export type AnyIndex<TName extends string = string> = Index<
  TName,
  Record<string, FieldBuilder>
>;

export function index<
  TIndexName extends string,
  TFields extends Record<string, FieldBuilder>,
>(name: TIndexName, fields: TFields) {
  return new Index(name, fields);
}

/**
 * Generates Azure AI Search FieldMapping to map the data source field names
 * to those in the schema.
 */
export function generateFieldMappings(
  fields: Record<string, FieldBuilder>
): FieldMapping[] {
  return Object.entries<FieldBuilder>(fields)
    .filter(([_, f]) => !isComplexFieldDataType(f.getType()))
    .filter(([t, f]) => t !== f.getDatasourceFieldName())
    .map(([targetName, fieldBuilder]) => ({
      targetFieldName: targetName,
      sourceFieldName: fieldBuilder.getDatasourceFieldName(),
    }));
}

function mergeArraysUniqueByProperty<T extends object>(
  array1: T[],
  array2: T[],
  property: keyof T
): T[] {
  const map = new Map<T[keyof T], T>();

  // Add all objects from the first array to the map
  array1.forEach((item) => {
    map.set(item[property], item);
  });

  // Add objects from the second array, avoiding duplicates
  array2.forEach((item) => {
    if (!map.has(item[property])) {
      map.set(item[property], item);
    }
  });

  // Convert map values back to an array
  return Array.from(map.values());
}

export function isIndexer(indexer: any): indexer is AnyIndexer {
  return !!(
    indexer.name &&
    indexer.targetIndexName &&
    indexer.dataSourceName != null
  );
}

export class Indexer<
  TIndexerName extends string,
  TIndexerConfig extends Omit<SearchIndexer, "name" | "targetIndexName"> & {
    targetIndex: Index<string, any>;
  },
> implements SearchIndexer
{
  name: TIndexerName;
  dataSourceName: string;
  description?: string | undefined;
  encryptionKey?: SearchResourceEncryptionKey | undefined;
  etag?: string | undefined;
  fieldMappings?: FieldMapping[] | undefined;
  isDisabled?: boolean | undefined;
  outputFieldMappings?: FieldMapping[] | undefined;
  parameters?: IndexingParameters | undefined;
  schedule?: IndexingSchedule | undefined;
  skillsetName?: string | undefined;
  targetIndexName: string;

  constructor(name: TIndexerName, config: TIndexerConfig) {
    const {
      targetIndex,
      fieldMappings: userSetFieldMappings,
      description,
      dataSourceName,
      encryptionKey,
      etag,
      isDisabled,
      outputFieldMappings,
      parameters,
      schedule,
    } = config;

    // deduplicate fieldMappings, prioritizing those set explicityly in `fieldMappings` in the indexer
    const fieldMappings = mergeArraysUniqueByProperty(
      userSetFieldMappings || [],
      targetIndex.implicitFieldMappings,
      "targetFieldName"
    );

    this.name = name;
    this.description = description;
    this.dataSourceName = dataSourceName;
    this.encryptionKey = encryptionKey;
    this.etag = etag;
    this.fieldMappings = fieldMappings;
    this.isDisabled = isDisabled;
    this.outputFieldMappings = outputFieldMappings;
    this.parameters = parameters;
    this.schedule = schedule;
    this.targetIndexName = targetIndex.name;
  }

  /* @internal */
  private build(): SearchIndexer {
    return this;
  }
}

export type AnyIndexer<TIndexerName extends string = string> = Indexer<
  TIndexerName,
  Omit<SearchIndexer, "name" | "targetIndexName"> & {
    targetIndex: Index<string, any>;
  }
>;

export function indexer<
  TIndexerName extends string,
  TIndexerConfig extends Omit<SearchIndexer, "name" | "targetIndexName"> & {
    targetIndex: Index<string, any>;
  },
>(name: TIndexerName, config: TIndexerConfig) {
  return new Indexer(name, config);
}

function isValidDataSourceType(type: any): type is SearchIndexerDataSourceType {
  const validTypes: SearchIndexerDataSourceType[] = [
    "adlsgen2",
    "azureblob",
    "azuresql",
    "azuretable",
    "cosmosdb",
    "mysql",
  ];

  return validTypes.includes(type);
}

export function isDataSource(
  dataSource: any
): dataSource is AnyDataSourceConnection {
  return !!dataSource.name && isValidDataSourceType(dataSource.type);
}

export class DataSourceConnection<
  TName extends string,
  TType extends SearchIndexerDataSourceType,
  TConfig extends Omit<SearchIndexerDataSourceConnection, "name" | "type">,
> implements SearchIndexerDataSourceConnection
{
  name: string;
  type: SearchIndexerDataSourceType;
  connectionString?: string | undefined;
  container: SearchIndexerDataContainer;
  dataChangeDetectionPolicy?: DataChangeDetectionPolicy | undefined;
  dataDeletionDetectionPolicy?:
    | SoftDeleteColumnDeletionDetectionPolicy
    | undefined;
  description?: string | undefined;
  encryptionKey?: SearchResourceEncryptionKey | undefined;
  etag?: string | undefined;

  constructor(
    name: TName,
    type: TType,
    {
      connectionString,
      container,
      dataChangeDetectionPolicy,
      dataDeletionDetectionPolicy,
      description,
      encryptionKey,
      etag,
    }: TConfig
  ) {
    this.name = name;
    this.type = type;
    this.connectionString = connectionString;
    this.container = container;
    this.dataChangeDetectionPolicy = dataChangeDetectionPolicy;
    this.dataDeletionDetectionPolicy = dataDeletionDetectionPolicy;
    this.description = description;
    this.encryptionKey = encryptionKey;
    this.etag = etag;
  }

  /* @internal */
  private build(): SearchIndexerDataSourceConnection {
    return this;
  }
}

export type AnyDataSourceConnection = DataSourceConnection<
  string,
  SearchIndexerDataSourceType,
  Omit<SearchIndexerDataSourceConnection, "name" | "type">
>;

export function dataSource<
  TName extends string,
  TType extends SearchIndexerDataSourceType,
  TConfig extends Omit<SearchIndexerDataSourceConnection, "name" | "type">,
>(name: TName, type: TType, config: TConfig) {
  return new DataSourceConnection(name, type, config);
}

/**
 * --------------------------------
 * ------------ SCHEMA ------------
 * --------------------------------
 */

//
export const string = (name: string) => {
  return new SimpleFieldBuilder<string>(name, "Edm.String");
};

export const int32 = (name: string) => {
  return new SimpleFieldBuilder<number>(name, "Edm.Int32");
};

export const int64 = (name: string) => {
  return new SimpleFieldBuilder<number>(name, "Edm.Int64");
};

export const double = (name: string) => {
  return new SimpleFieldBuilder<number>(name, "Edm.Double");
};

export const boolean = (name: string) => {
  return new SimpleFieldBuilder<boolean>(name, "Edm.Boolean");
};

export const date = (name: string) => {
  return new SimpleFieldBuilder<Date>(name, "Edm.DateTimeOffset");
};

export const stringCollection = (name: string) => {
  return new SimpleFieldBuilder<string[]>(name, "Collection(Edm.String)");
};

export const int32Collection = (name: string) => {
  return new SimpleFieldBuilder<number[]>(name, "Collection(Edm.Int32)");
};

export const int64Collection = (name: string) => {
  return new SimpleFieldBuilder<number[]>(name, "Collection(Edm.Int64)");
};

export const doubleCollection = (name: string) => {
  return new SimpleFieldBuilder<number[]>(name, "Collection(Edm.Double)");
};

export const dateCollection = (name: string) => {
  return new SimpleFieldBuilder<Date[]>(name, "Collection(Edm.DateTimeOffset)");
};

export const booleanCollection = (name: string) => {
  return new SimpleFieldBuilder<boolean[]>(name, "Collection(Edm.Boolean)");
};

export function collection<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
>(name: TName, fields: TFields): CollectionFieldBuilder<TName, TFields> {
  return new CollectionFieldBuilder(name, fields);
}

export function complex<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
>(name: TName, fields: TFields): ComplexFieldBuilder<TName, TFields> {
  return new ComplexFieldBuilder(name, fields);
}

export type InferFieldBuilderType<TField extends FieldBuilder> =
  TField extends SimpleFieldBuilder<infer TType, infer TNotNull>
    ? TNotNull extends true
      ? TType
      : TType | null
    : TField extends ComplexFieldBuilder<any, infer TFields>
      ? { [Key in keyof TFields]: InferFieldBuilderType<TFields[Key]> }
      : TField extends CollectionFieldBuilder<any, infer TFields>
        ? { [Key in keyof TFields]: InferFieldBuilderType<TFields[Key]> }[]
        : never;

export type InferType<TIndex extends AnyIndex> =
  TIndex extends Index<any, infer TFields>
    ? {
        [Key in keyof TFields]: InferFieldBuilderType<TFields[Key]>;
      }
    : never;

// only include Indexes in the schema output
type FilteredSchema<TSchema> = {
  [TIndex in keyof TSchema]: TSchema[TIndex] extends AnyIndex ? TIndex : never;
}[keyof TSchema];

export type ConnectSchema<TSchema extends Record<string, any>> = {
  [TIndex in FilteredSchema<TSchema>]: SearchClient<InferType<TSchema[TIndex]>>;
};

export function connect<
  TSchema extends Record<
    string,
    AnyIndex | AnyIndexer | AnyDataSourceConnection
  >,
>(client: SearchIndexClient, schema: TSchema) {
  return Object.fromEntries(
    Object.entries(schema)
      // only inclde indexes in the output
      .filter(([_, item]) => isIndex(item))
      .map(([indexName, index]) => {
        return [indexName, client.getSearchClient(index.name)];
      })
  ) as unknown as ConnectSchema<TSchema>;
}
