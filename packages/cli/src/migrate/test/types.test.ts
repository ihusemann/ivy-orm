import { describe, test, expectTypeOf } from "vitest";
import { Migration } from "../types";
import { z } from "zod";
import { migrationSchema } from "../schemas";

describe("Types", () => {
  test("the inferred type of the migrationSchema matches the Migration type", () => {
    expectTypeOf<Migration>(<z.infer<typeof migrationSchema>>{});
  });
});
