import { FieldBuilder } from "./field-builder";

export function int32(name: string) {
  return new FieldBuilder<number>(name, "Edm.Int32");
}

export function int64(name: string) {
  return new FieldBuilder<number>(name, "Edm.Int64");
}

export function double(name: string) {
  return new FieldBuilder<number>(name, "Edm.Double");
}
