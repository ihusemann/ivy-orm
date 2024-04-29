import { FieldBuilder } from "../core";

export function dateTimeOffset(name: string) {
  return new FieldBuilder<Date>(name, "Edm.DateTimeOffset");
}
