# Ivy Kit

Ivy Kit is a CLI migrator tool for [Ivy ORM](https://www.npmjs.com/package/ivy-orm), a fully type-safe "ORM" for Azure AI Search. Use Ivy Kit to manage your AI Search data plane, like creating indexes and indexers.

# Documentation

`ivy-kit` will traverse the schema file you define in `ivy-kit.config.ts`, and prompt you to create/update the indexes and indexers defined therein.

See [IvyORM](https://www.npmjs.com/package/ivy-orm) for more on defining a schema.

### Installation

```bash
npm install -D ivy-kit
```

### Configuration

Create a file `ivy-kit.config.ts` in the root of your project to define the endpoint and credential of your AI Search resource. Specify the path (relative to the cwd) of the schema file containing your indexes and indexers.

```ts
import { defineConfig } from "ivy-kit";
import { DefaultAzureCredential } from "@azure/identity";

export default defineConfig({
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT,
  credential: new DefaultAzureCredential(),
  schema: "search/schema.ts",
});
```

### Commands

- `push` will prompt you to select which indexes and indexers you want to create. Good for development.
