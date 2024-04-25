import type {
  SearchClient,
  SearchFieldDataType,
  SearchIndexClient,
  SimpleField,
} from "@azure/search-documents";
import { Index } from "./schema/search-index";

export type Primitive = string | number | null;

export class FieldBuilder<
  TType extends Primitive = Primitive,
  TNotNull extends boolean = boolean,
> {
  config: SimpleField;

  constructor(name: string, type: SearchFieldDataType) {
    this.config = {
      name,
      type,
    };
  }

  key(): FieldBuilder<TType, true> {
    this.config.key = true;

    return this as FieldBuilder<TType, true>;
  }

  searchable() {
    this.config.searchable = true;

    return this as FieldBuilder<TType, TNotNull>;
  }

  filterable() {
    this.config.sortable = true;

    return this as FieldBuilder<TType, TNotNull>;
  }

  facetable() {
    this.config.facetable = true;

    return this as FieldBuilder<TType, TNotNull>;
  }

  sortable() {
    this.config.sortable = true;

    return this as FieldBuilder<TType, TNotNull>;
  }

  notNull() {
    return this as FieldBuilder<TType, true>;
  }
}

export type AnyIndex<TName extends string = string> = Index<
  TName,
  Record<string, FieldBuilder>
>;

export type InferFieldType<TField extends FieldBuilder> =
  TField extends FieldBuilder<infer TType, infer TNotNull>
    ? TNotNull extends true
      ? TType
      : TType | null
    : never;

export type InferType<TIndex extends AnyIndex> =
  TIndex extends Index<any, infer TFields>
    ? {
        [Key in keyof TFields]: InferFieldType<TFields[Key]>;
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
