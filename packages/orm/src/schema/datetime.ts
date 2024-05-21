import { FieldBuilder } from "./field-builder";

export function dateTimeOffset(name: string) {
  return new FieldBuilder<Date>(name, "Edm.DateTimeOffset");
}
