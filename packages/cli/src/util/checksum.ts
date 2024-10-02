import {
  SearchField,
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
  SimpleField,
} from "@azure/search-documents";
import objectHash from "object-hash";
import cleanDeep from "clean-deep";
import { isSimpleField } from "@ivy-orm/core";

/**
 * Removes the indexer properties that are not managed by ivy-orm.
 * Changes to the unmanaged fields would not be detected as drift.
 */
function sanitizeIndexer(indexer: SearchIndexer): Partial<SearchIndexer> {
  return {
    name: indexer.name,
    dataSourceName: indexer.dataSourceName,
    description: indexer.description,
    encryptionKey: indexer.encryptionKey,
    fieldMappings: indexer.fieldMappings,
    isDisabled: indexer.isDisabled,
    outputFieldMappings: indexer.outputFieldMappings,
    parameters: indexer.parameters,
    schedule: indexer.schedule,
    skillsetName: indexer.skillsetName,
    targetIndexName: indexer.targetIndexName,
  };
}

/**
 * Deterministically generate a checksum for a SearchIndexer.
 * Ignores properties that are not managed by ivy-orm.
 * Object and array order does not affect checksum.
 */
export function generateIndexerChecksum(indexer: SearchIndexer): string {
  return objectHash(cleanDeep(sanitizeIndexer(indexer)), {
    unorderedArrays: true,
    unorderedObjects: true,
  });
}

/**
 * Removes the field properties that are not managed by ivy-orm.
 * Changes to the unmanaged fields would not be detected as drift.
 */
function sanitizeSimpleField(field: SimpleField): Partial<SimpleField> {
  return {
    name: field.name,
    type: field.type,
    key: field.key,
    hidden: field.hidden,
    filterable: field.filterable,
    facetable: field.facetable,
    sortable: field.sortable,
    searchable: field.searchable,
  };
}

/**
 * Deterministically generate a checksum for a SearchField.
 * Ignores properties that are not managed by ivy-orm.
 * Object and array order does not affect checksum.
 */
export function generateFieldChecksum(field: SearchField): string {
  if (isSimpleField(field)) {
    return objectHash(cleanDeep(sanitizeSimpleField(field)));
  }

  const complexField = {
    ...field,
    fields: field.fields.map(generateFieldChecksum),
  };

  return objectHash(complexField, {
    unorderedArrays: true,
    unorderedObjects: true,
  });
}

/**
 * Removes the index properties that are not managed by ivy-orm.
 * Changes to the unmanaged fields would not be detected as drift.
 */
function sanitizeIndex(index: SearchIndex): Partial<SearchIndex> {
  return {
    name: index.name,
    suggesters: index.suggesters,
    fields: index.fields,
  };
}

/**
 * Deterministically generate a checksum for a SearchIndex.
 * Ignores properties that are not managed by ivy-orm.
 * Object and array order does not affect checksum.
 */
export function generateIndexChecksum(index: SearchIndex): string {
  const sanitizedIndex = sanitizeIndex(index);

  return objectHash(
    cleanDeep({
      ...sanitizedIndex,
      fields: sanitizedIndex.fields?.map(generateFieldChecksum),
    }),
    {
      unorderedArrays: true,
      unorderedObjects: true,
    }
  );
}

/**
 * Removes the index properties that are not managed by ivy-orm.
 * Changes to the unmanaged fields would not be detected as drift.
 */
function sanitizeDataSource(
  dataSource: SearchIndexerDataSourceConnection
): Partial<SearchIndexerDataSourceConnection> {
  return {
    name: dataSource.name,
    description: dataSource.description,
    connectionString: dataSource.connectionString,
    container: dataSource.container,
    type: dataSource.type,
    dataChangeDetectionPolicy: dataSource.dataChangeDetectionPolicy,
    dataDeletionDetectionPolicy: dataSource.dataDeletionDetectionPolicy,
    encryptionKey: dataSource.encryptionKey,
  };
}

/**
 * Deterministically generate a checksum for a SearchIndexerDataSourceConnection.
 * Ignores properties that are not managed by ivy-orm.
 * Object and array order does not affect checksum.
 */
export function generateDataSourceChecksum(
  dataSource: SearchIndexerDataSourceConnection
): string {
  const sanitizedDataSource = sanitizeDataSource(dataSource);

  return objectHash(cleanDeep(sanitizedDataSource), {
    unorderedArrays: true,
    unorderedObjects: true,
  });
}
