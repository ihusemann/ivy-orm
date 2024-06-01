import { SearchFieldDataType, SimpleField } from "@azure/search-documents";

export type Primitive = string | number | Date | boolean | null;

export class FieldBuilder<
  TType extends Primitive = Primitive,
  TNotNull extends boolean = boolean
> {
  config: SimpleField;

  /* @internal */ hasSuggester: boolean = false;

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
    this.config.filterable = true;

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

  suggester(): FieldBuilder<TType, TNotNull> {
    this.hasSuggester = true;
    this.config.searchable = true;

    return this as FieldBuilder<TType, TNotNull>;
  }

  notNull() {
    return this as FieldBuilder<TType, true>;
  }

  /* @internal */
  private build(name?: string): SimpleField {
    return {
      ...this.config,
      name: name || this.config.name,
    };
  }
}
