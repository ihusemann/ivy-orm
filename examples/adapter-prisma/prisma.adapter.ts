import {
  Adapter,
  isResource,
  Migration,
  Resource,
  ResourceType,
  StartMigrationArgs,
} from "ivy-kit";
import { PrismaClient } from "@prisma/client";

export class PrismaAdapter implements Adapter {
  private db: PrismaClient;

  constructor() {
    this.db = new PrismaClient();
  }

  async listResources() {
    const resources = await this.db.resource.findMany();
    return resources.filter(isResource);
  }

  async updateResource(id: string, data: Partial<Resource>) {
    await this.db.resource.update({
      where: {
        id,
      },
      data,
    });
  }

  async createResource(data: Omit<Resource, "id">): Promise<Resource> {
    const resource = await this.db.resource.create({
      data,
    });

    if (!isResource(resource)) throw new Error();

    return resource;
  }

  async deleteResource(name: string, type: ResourceType): Promise<void> {
    await this.db.resource.delete({
      where: {
        name_type: {
          name,
          type,
        },
      },
    });
  }

  async listMigrations(): Promise<Migration[]> {
    return this.db.migration.findMany();
  }

  async startMigration(migration: StartMigrationArgs): Promise<Migration> {
    return this.db.migration.create({
      data: migration,
    });
  }

  async succeedMigration(id: string): Promise<Migration> {
    return this.db.migration.update({
      where: {
        id,
      },
      data: {
        finishedAt: new Date(),
      },
    });
  }

  async errorMigration(id: string, error: string): Promise<Migration> {
    return this.db.migration.update({
      where: {
        id,
      },
      data: {
        logs: error,
      },
    });
  }
}
