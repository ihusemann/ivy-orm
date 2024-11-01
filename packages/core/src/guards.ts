import {
  ComplexDataType,
  SearchFieldDataType,
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
  SimpleField,
} from "@azure/search-documents";

// include `@azure/search-documents` types in the exports to avoid build errors in CLI
export type { SearchIndex, SearchIndexer, SearchIndexerDataSourceConnection };

/**
 * Determines whether a given data type is a simple search field data type.
 *
 * @param type - The data type to evaluate, which can be either a `ComplexDataType` or a `SearchFieldDataType`.
 * @returns A boolean indicating whether the provided type is a simple search field data type.
 */
export const isSimpleFieldDataType = (
  type: ComplexDataType | SearchFieldDataType
): type is SearchFieldDataType => {
  const simpleFieldTypes = [
    "Edm.String",
    "Edm.Int32",
    "Edm.Int64",
    "Edm.Double",
    "Edm.Boolean",
    "Edm.DateTimeOffset",
    "Edm.GeographyPoint",
    "Collection(Edm.String)",
    "Collection(Edm.Int32)",
    "Collection(Edm.Int64)",
    "Collection(Edm.Double)",
    "Collection(Edm.Boolean)",
    "Collection(Edm.DateTimeOffset)",
    "Collection(Edm.GeographyPoint)",
    "Collection(Edm.Single)",
  ];

  return simpleFieldTypes.includes(type);
};

/**
 * Determines whether a given data type is a complex field data type.
 *
 * @param type - The data type to evaluate, which can be either a `ComplexDataType` or a `SearchFieldDataType`.
 * @returns A boolean indicating whether the provided type is a complex field data type.
 */
export const isComplexFieldDataType = (
  type: ComplexDataType | SearchFieldDataType
): type is ComplexDataType => {
  return type === "Edm.ComplexType" || type === "Collection(Edm.ComplexType)";
};

/**
 * Checks if a given field is a simple field based on its type and name.
 *
 * @param field - The field object to evaluate.
 * @returns A boolean indicating whether the provided field is a simple field.
 */
export const isSimpleField = (field: any): field is SimpleField => {
  const { type, name } = field;
  if (!type || !name) return false;
  if (!isSimpleFieldDataType(type)) return false;

  return true;
};

/**
 * Checks if a variable fulfils SearchIndex
 * @param index - The index to evaluate.
 * @returns A boolean indicating whether the provided index is a SearchIndex
 */
export const isSearchIndex = (index: any): index is SearchIndex => {
  return index.name && index.fields;
};

/**
 * Checks if a variable fulfils SearchIndexer
 * @param indexer - The indexer to evaluate.
 * @returns A boolean indicating whether the provided indexer is a SearchIndexer
 */
export const isSearchIndexer = (indexer: any): indexer is SearchIndexer => {
  return indexer.name && indexer.dataSourceName;
};

/**
 * Checks if a variable fulfils SearchIndexerDataSourceConnection
 * @param dataSource - The dataSource to evaluate.
 * @returns A boolean indicating whether the provided dataSource is a SearchIndexerDataSourceConnection
 */
export const isDataSource = (
  dataSource: any
): dataSource is SearchIndexerDataSourceConnection => {
  return dataSource.name && dataSource.container.name;
};
