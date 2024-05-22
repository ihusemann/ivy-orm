import { SearchIndex } from "@azure/search-documents";
import { FieldBuilder } from "./field-builder";

export class Index<
  TIndexName extends string,
  TFields extends Record<string, FieldBuilder<any, any>>,
> {
  fields: TFields;

  constructor(
    public name: TIndexName,
    fields: TFields
  ) {
    this.fields = fields;
  }

  private build(): SearchIndex {
    return {
      name: this.name,
      fields: Object.entries(this.fields).map(([name, fieldBuilder]) =>
        fieldBuilder["build"](name)
      ),
      suggesters: Object.entries(this.fields)
        .filter(([_, fieldBuilder]) => fieldBuilder["hasSuggester"])
        .map(([_, fieldBuilder]) => ({
          name: `sg`,
          searchMode: "analyzingInfixMatching",
          sourceFields: [fieldBuilder.config.name],
        })),
    };
  }
}

export function index<
  TIndexName extends string,
  TFields extends Record<string, FieldBuilder>,
>(name: TIndexName, fieldConfig: TFields) {
  return new Index(name, fieldConfig);
}

export type AnyIndex<TName extends string = string> = Index<
  TName,
  Record<string, FieldBuilder>
>;
