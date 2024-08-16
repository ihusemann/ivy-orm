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
  FieldMappingFunction,
} from "@azure/search-documents";

export type Collection<T> = Array<T>;
export type Primitive = string | number | Date | boolean | null;
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

export class CollectionFieldBuilder<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
  TType extends ComplexDataType,
> extends FieldBuilder {
  override hasSuggester = false;

  constructor(name: TName, type: TType, fields: TFields) {
    super(name, type, fields);
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

export class Index<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
> {
  name: TName;
  fields: TFields;

  constructor(name: TName, fields: TFields) {
    this.name = name;
    this.fields = fields;
  }

  /* @internal */
  private build(): SearchIndex {
    return {
      name: this.name,
      fields: Object.entries(this.fields).map(([name, fieldBuilder]) =>
        fieldBuilder["build"](name)
      ),
      suggesters: Object.values(this.fields).some(
        (field) => field["hasSuggester"]
      )
        ? [
            {
              name: "sg",
              searchMode: "analyzingInfixMatching",
              sourceFields: Object.entries(this.fields)
                .filter(([_, fieldBuilder]) => fieldBuilder["hasSuggester"])
                .map(([name]) => name),
            },
          ]
        : undefined,
    };
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
 * generate an Azure AI Search FieldMapping to map the data source field names
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

export class Indexer<
  TIndexerName extends string,
  TIndexerConfig extends Omit<SearchIndexer, "name" | "targetIndexName"> & {
    targetIndex: Index<string, any>;
  },
> {
  private searchIndexer: SearchIndexer;

  constructor(name: TIndexerName, config: TIndexerConfig) {
    const { targetIndex, fieldMappings, ...rest } = config;

    // TODO: intelligently merage `generatedFieldMappings` and `fieldMappings` to avoid duplication
    // fieldMappings should supercede generatedFieldMappings
    const generatedFieldMappings = generateFieldMappings(targetIndex.fields);

    this.searchIndexer = {
      name,
      targetIndexName: targetIndex.name,
      fieldMappings: [...generatedFieldMappings, ...(fieldMappings || [])],
      ...rest,
    };
  }

  /* @internal */
  private build(): SearchIndexer {
    return this.searchIndexer;
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

export function collection<
  TName extends string,
  TFields extends Record<string, FieldBuilder>,
  TType extends ComplexDataType,
>(name: TName, fields: TFields) {
  return new CollectionFieldBuilder(
    name,
    "Collection(Edm.ComplexType)" as TType,
    fields
  );
}

export type InferFieldBuilderType<TField extends FieldBuilder> =
  TField extends SimpleFieldBuilder<infer TType, infer TNotNull>
    ? TNotNull extends true
      ? TType
      : TType | null
    : TField extends CollectionFieldBuilder<any, infer TFields, ComplexDataType>
      ? { [Key in keyof TFields]: InferFieldBuilderType<TFields[Key]> }[]
      : never;

export type InferType<TIndex extends AnyIndex> =
  TIndex extends Index<any, infer TFields>
    ? {
        [Key in keyof TFields]: InferFieldBuilderType<TFields[Key]>;
      }
    : never;

export type ConnectSchema<TSchema extends Record<string, AnyIndex>> = {
  [TIndex in keyof TSchema & string]: SearchClient<InferType<TSchema[TIndex]>>;
};

export function connect<TSchema extends Record<string, AnyIndex>>(
  client: SearchIndexClient,
  schema: TSchema
) {
  return Object.fromEntries(
    Object.entries(schema).map(([indexName, index]) => {
      return [indexName, client.getSearchClient(index.name)];
    })
  ) as ConnectSchema<TSchema>;
}
