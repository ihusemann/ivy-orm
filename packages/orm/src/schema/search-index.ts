import { FieldBuilder } from "../core";

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
}

export function index<
  TIndexName extends string,
  TFields extends Record<string, FieldBuilder>,
>(name: TIndexName, fieldConfig: TFields) {
  return new Index(name, fieldConfig);
}
