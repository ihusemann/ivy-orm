import { FieldMapping } from "@azure/search-documents";
import { FieldBuilder } from "./field-builder";
import { AnyIndex, Index } from "./search-index";

/**
 * generate an Azure AI Search FieldMapping to map the data source field names
 * to those in the schema.
 */
export function generateFieldMappings(
  fields: Record<string, FieldBuilder<any, any>>
): FieldMapping[] {
  return Object.entries<FieldBuilder>(fields)
    .filter(([t, f]) => t !== f.config.name)
    .map(([targetName, fieldBuilder]) => ({
      targetFieldName: targetName,
      sourceFieldName: fieldBuilder.config.name,
    }));
}

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
