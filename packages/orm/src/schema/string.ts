import { FieldBuilder } from "../core";

export function string(name: string) {
  return new FieldBuilder<string>(name, "Edm.String");
}
