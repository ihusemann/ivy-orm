import { FieldMapping } from "@azure/search-documents";
import { FieldBuilder } from "../core";

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
