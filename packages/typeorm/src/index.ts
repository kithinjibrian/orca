import { DynamicModule } from "@kithinji/orca";
import { TypeOrmModuleOptions } from "./types/options";
import { TypeOrmCoreModule } from "./modules/core";
import { EntityClassOrSchema } from "./types/entity-class-or-schema.type";
import { DataSource, DataSourceOptions } from "typeorm";
import { DEFAULT_DATA_SOURCE_NAME } from "./symbols";
import { EntitiesMetadataStorage } from "./storage";
import { createTypeOrmProviders } from "./providers";

export * from "./decorators/inject";

export class TypeOrmModule {
  static forRoot(options?: TypeOrmModuleOptions): DynamicModule {
    return {
      module: TypeOrmModule,
      imports: [TypeOrmCoreModule.forRoot(options)],
    };
  }

  static forFeature(
    entities: EntityClassOrSchema[] = [],
    dataSource:
      | DataSource
      | DataSourceOptions
      | string = DEFAULT_DATA_SOURCE_NAME,
  ): DynamicModule {
    const providers = createTypeOrmProviders(entities, dataSource);

    EntitiesMetadataStorage.addEntitiesByDataSource(dataSource, [...entities]);

    return {
      module: TypeOrmModule,
      providers: providers,
      exports: providers.map((p) => p.provide),
    };
  }
}
