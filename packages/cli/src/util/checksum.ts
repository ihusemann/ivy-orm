import { createHash } from "crypto";

export function generateChecksum(input: string): string {
  const hash = createHash("sha1");
  hash.update(input);

  return hash.digest("hex");
}
