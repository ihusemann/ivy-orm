import { SecretClient } from "@azure/keyvault-secrets";

/**
 * Resolves a secret from the input string when applying migration. The input string can contain
 * placeholders in the format `@kv(<key>)` or `@env(<key>)`, which will be
 * replaced with the corresponding secret value.
 *
 * - `@kv(<key>)`: Placeholder for a key-value secret. (Not yet implemented)
 * - `@env(<key>)`: Placeholder for an environment variable.
 *
 * @param input - The input string containing the secret placeholders.
 * @returns The resolved secret string.
 * @throws Will throw an error if the environment variable specified in the
 *         `@env(<key>)` placeholder is not found.
 */
export async function resolveSecret(
  input?: string,
  secretClient?: SecretClient
): Promise<string | undefined> {
  if (!input) return undefined;

  // regex pattern to match `@kv(<key>)` or `@env(<key>)`
  const regex = /@(?<type>kv|env)\((?<key>[^\)]+)\)/;
  const match = input.match(regex);

  // doesn't follow secret syntax, return input
  if (!match || !match.groups) return input;

  const { type, key } = match.groups;

  if (type === "kv") {
    if (!secretClient)
      throw new Error(
        "Secret client not provided.  Add it to your ivy-kit.config.ts file."
      );

    const secret = await secretClient.getSecret(key);

    if (!secret) throw new Error(`Failed to fetch secret ${key}.`);

    return secret.value;
  }

  if (type === "env") {
    const secret = process.env[key];
    if (!secret) throw new Error(`Environment variable ${key} not found.`);
    return secret;
  }

  // fallback
  return input;
}
