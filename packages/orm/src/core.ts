import type {
  AzureKeyCredential,
  SearchClient,
  SearchIndex,
  SearchIndexClient,
  SearchIndexerClient,
} from "@azure/search-documents";
import { Index } from "./schema/search-index";
import { FieldBuilder } from "./schema/field-builder";

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
