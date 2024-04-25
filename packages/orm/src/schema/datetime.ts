import { FieldBuilder } from "../core";

export function dateTimeOffset(name: string) {
  return new FieldBuilder(name, "Edm.DateTimeOffset");
}
