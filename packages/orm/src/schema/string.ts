import { FieldBuilder } from "./field-builder";

export function string(name: string) {
  return new FieldBuilder<string>(name, "Edm.String");
}
