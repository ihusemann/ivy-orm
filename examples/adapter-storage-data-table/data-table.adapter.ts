import { odata, TableClient } from "@azure/data-tables";
import { Adapter, Migration, Resource, StartMigrationArgs } from "ivy-kit";
import { v4 as uuid } from "uuid";

// `rowKey` is considered the `id` in the data table
type StoredResource = Omit<Resource, "id">;
type StoredMigration = Omit<Migration, "id">;

/**
 * ivy-kit state adapter that implements [Azure Storage Data Table](https://www.npmjs.com/package/@azure/data-tables#list-entities-in-a-table)
 */
export class DataTableAdapter implements Adapter {
  private table: TableClient;

  constructor() {
    // uses Azurite emulator by default.  update for your needs.
    this.table = TableClient.fromConnectionString(
      "UseDevelopmentStorage=true",
      "IvyKitState"
    );

    this.table.createTable().catch(() => {});
  }

  async listResources(): Promise<Resource[]> {
    const resources: Resource[] = [];
    for await (const entity of this.table.listEntities<StoredResource>({
      queryOptions: {
        filter: odata`PartitionKey eq 'resource'`,
      },
    })) {
      const id = entity.rowKey;
      if (!id) throw new Error("Missing rowKey from data table entity.");

      resources.push({
        id,
        name: entity.name,
        checksum: entity.checksum,
        type: entity.type,
      });
    }

    return resources;
  }

  async updateResource(id: string, data: Partial<Resource>): Promise<void> {
    await this.table.updateEntity(
      {
        partitionKey: "resource",
        rowKey: id,
        ...data,
      },
      "Merge"
    );
  }

  async createResource(data: StoredResource): Promise<Resource> {
    const id = uuid();
    await this.table.createEntity<StoredResource>({
      rowKey: id,
      partitionKey: "resource",
      ...data,
    });

    return {
      id,
      ...data,
    };
  }

  async deleteResource(name: string): Promise<void> {
    const entities = this.table.listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq 'resource' and name eq '${name}'`,
      },
    });

    for await (const entity of entities) {
      const id = entity.rowKey;

      if (!id) throw new Error("Entity is missing rowKey");

      await this.table.deleteEntity("resource", id);
    }
  }

  async listMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];

    for await (const {
      rowKey,
      checksum,
      migrationName,
      startedAt,
      finishedAt,
      logs,
    } of this.table.listEntities<StoredMigration>({
      queryOptions: {
        filter: odata`PartitionKey eq 'migration'`,
      },
    })) {
      const id = rowKey;

      if (!id) throw new Error("Missing rowKey from data table entity.");

      migrations.push({
        id,
        checksum,
        migrationName,
        startedAt,
        finishedAt,
        logs,
      });
    }

    return migrations;
  }

  async startMigration(migration: StartMigrationArgs): Promise<Migration> {
    const id = uuid();
    const startedAt = new Date();

    await this.table.createEntity<StoredMigration>({
      partitionKey: "migration",
      rowKey: id,
      startedAt,
      ...migration,
    });

    return {
      id,
      startedAt,
      ...migration,
    };
  }

  async succeedMigration(id: string): Promise<Migration> {
    const migration = await this.table.getEntity<StoredMigration>(
      "migration",
      id
    );

    const succeededMigration = {
      ...migration,
      rowKey: id,
      partitionKey: "migration",
      finishedAt: new Date(),
    };

    await this.table.updateEntity<StoredMigration>(succeededMigration, "Merge");

    return {
      id,
      migrationName: migration.migrationName,
      checksum: migration.checksum,
      startedAt: migration.startedAt,
      finishedAt: succeededMigration.finishedAt,
      logs: migration.logs,
    };
  }

  async errorMigration(id: string, error: string): Promise<Migration> {
    const migration = await this.table.getEntity<StoredMigration>(
      "migration",
      id
    );

    await this.table.updateEntity<StoredMigration>(
      {
        ...migration,
        partitionKey: "migration",
        rowKey: id,
        logs: error,
      },
      "Merge"
    );

    return {
      id,
      migrationName: migration.migrationName,
      checksum: migration.checksum,
      startedAt: migration.startedAt,
      finishedAt: migration.finishedAt,
      logs: error,
    };
  }
}
