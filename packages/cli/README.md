# Ivy Kit

Ivy Kit is a CLI migrator tool for [Ivy ORM](https://www.npmjs.com/package/ivy-orm), a fully type-safe "ORM" for Azure AI Search. Use Ivy Kit to manage your AI Search data plane, like creating indexes and indexers.

# Documentation

`ivy-kit` will traverse the schema file at the path you define in `ivy-kit.config.ts`, and prompt you to create/update the indexes and indexers defined therein.

See [IvyORM](https://www.npmjs.com/package/ivy-orm) for more on defining a schema.

### Installation

```bash
npm install -D ivy-kit
```

### Configuration

Create a file `ivy-kit.config.ts` in the root of your project to define the endpoint and credential of your AI Search resource. Specify the path (relative to the cwd) of the schema file containing your indexes and indexers.

```ts
import { type Config } from "ivy-kit";
import { DefaultAzureCredential } from "@azure/identity";

export default {
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT,
  credential: new DefaultAzureCredential(),
  schema: "search/schema.ts",
} satisfies Config;
```

### Commands

- `push` will prompt you to select which indexes and indexers you want to create. Good for development.
- `generate` will generate a JSON migration file.
- `migrate` will apply a migration file.
- `pull` will add existing Azure AI Search indexes and indexers into the ivy-kit state.

## Handling Migrations (beta)

Handle Azure AI Search resource deployments with ease using Ivy Kit!

### State Adapter

Ivy Kit uses a state separate from Azure AI Search to track which resources have been deployed using Ivy Kit, and determine what changes need to be made during migration. The implementation of this state is up to you.

You can use any backend you want like a SQL database, Blob storage, or even local JSON files. Simply create a class that that fulfills `Adapter`:

```ts
interface Adapter {
  listResources(): Promise<Resource[]>;
  updateResource(id: string, data: Partial<Resource>): Promise<void>;
  createResource(data: Omit<Resource, "id">): Promise<Resource>;
  deleteResource(id: string): Promise<void>;

  listAppliedMigrations(): Promise<Migration[]>;
  applyMigration(name: string): Promise<Migration>;
}

interface Resource {
  id: string;
  name: string;
  etag: string;
  type: string;
}

interface Migration {
  id: string;
  name: string;
  appliedAt: Date;
}
```

For example, using Prisma:

```ts
class PrismaAdapter implements Adapter {
  private db: PrismaClient;

  constructor() {
    this.db = new PrismaClient();
  }

  listResources() {
    return this.db.resource.findMany();
  }

  async updateResource(id: string, data: Partial<Resource>) {
    await this.db.resource.update({
      where: {
        id,
      },
      data,
    });
  }

  createResource(data: Omit<Resource, "id">): Promise<Resource> {
    return this.db.resource.create({
      data,
    });
  }

  async deleteResource(id: string): Promise<void> {
    await this.db.resource.delete({
      where: {
        id,
      },
    });
  }

  async listAppliedMigrations(): Promise<Migration[]> {
    return this.db.migration.findMany();
  }

  async applyMigration(name: string): Promise<Migration> {
    return this.db.migration.create({
      data: {
        name,
      },
    });
  }
}
```

Finally, include the adapter in `ivy-kit.config.ts`:

```ts
export default {
  credential: new DefaultAzureCredential(),
  schema: "search/schema.ts",
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT!,
  adapter: new PrismaAdapter(),
} satisfies Config;
```

### Managing Secrets

Since ivy-kit generates JSON migration files that must be committed to your repository, we must be careful to avoid hard-coding application secrets, like database connection strings, into the schema.

To avoid this, we use a microsyntax `@env()` to indicate environment variables that must be resolved applying migrations with `ivy-kit migrate apply`.

For example, define an Azure SQL data source:

```ts
import { dataSource } from "ivy-orm";

export const myDatasource = dataSource("my-datasource", "azuresql", {
  connectionString: "@env(DATABASE_CONNECTION_STRING)",
  container: {
    name: "dbo.Hotels",
  },
});
```

The resulting JSON will match the connection string defined in the schema, with no secrets being exposed to your codebase:

```json
{
  "name": "my-datasource",
  "type": "azuresql",
  "connectionString": "@env(DATABASE_CONNECTION_STRING)",
  "container": {
    "name": "dbo.Hotels"
  }
}
```

Finally, when running `ivy-kit migrate apply`, ivy-kit will resolve the environment variables when creating the data source in Azure.
