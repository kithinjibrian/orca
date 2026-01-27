import { TYPEORM_MODULE_OPTIONS } from "@/symbols";
import {
  TypeOrmDataSourceFactory,
  TypeOrmModuleOptions,
} from "@/types/options";
import {
  getDataSourceName,
  getDataSourceToken,
  getEntityManagerToken,
  handleRetry,
} from "@/utils";
import { DynamicModule, Module, Provider } from "@kithinji/orca";
import { createConnection, DataSource, DataSourceOptions } from "typeorm";
import { defer, lastValueFrom } from "rxjs";
import { EntitiesMetadataStorage } from "@/storage";

export class TypeOrmCoreModule {
  static forRoot(options: TypeOrmModuleOptions = {}): DynamicModule {
    const typeOrmModuleOptions = {
      provide: TYPEORM_MODULE_OPTIONS,
      useValue: options,
    };
    const dataSourceProvider: Provider = {
      provide: getDataSourceToken(options as DataSourceOptions),
      useFactory: async () => await this.createDataSourceFactory(options),
      eager: true,
    };

    const entityManagerProvider = this.createEntityManagerProvider(
      options as DataSourceOptions,
    );

    const providers = [
      entityManagerProvider,
      dataSourceProvider,
      typeOrmModuleOptions,
    ];
    const exports = [entityManagerProvider.provide, dataSourceProvider.provide];

    return {
      module: TypeOrmCoreModule,
      providers,
      exports,
    };
  }

  private static createEntityManagerProvider(
    options: DataSourceOptions,
  ): Provider {
    return {
      provide: getEntityManagerToken(options) as string,
      useFactory: (dataSource: DataSource) => dataSource.manager,
      inject: [getDataSourceToken(options)],
    };
  }

  private static async createDataSourceFactory(
    options: TypeOrmModuleOptions,
    dataSourceFactory?: TypeOrmDataSourceFactory,
  ): Promise<DataSource> {
    const dataSourceToken = getDataSourceName(options as DataSourceOptions);

    const createTypeormDataSource =
      dataSourceFactory ??
      ((options: DataSourceOptions) => {
        return DataSource === undefined
          ? createConnection(options)
          : new DataSource(options);
      });
    return await lastValueFrom(
      defer(async () => {
        let dataSource: DataSource;
        if (!options.autoLoadEntities) {
          dataSource = await createTypeormDataSource(
            options as DataSourceOptions,
          );
        } else {
          let entities = options.entities;
          if (Array.isArray(entities)) {
            entities = entities.concat(
              EntitiesMetadataStorage.getEntitiesByDataSource(dataSourceToken),
            );
          } else {
            entities =
              EntitiesMetadataStorage.getEntitiesByDataSource(dataSourceToken);
          }
          dataSource = await createTypeormDataSource({
            ...options,
            entities,
          } as DataSourceOptions);
        }

        return (dataSource as any).initialize &&
          !dataSource.isInitialized &&
          !options.manualInitialization
          ? dataSource.initialize()
          : dataSource;
      }).pipe(
        handleRetry(
          options.retryAttempts,
          options.retryDelay,
          dataSourceToken,
          options.verboseRetryLog,
          options.toRetry,
        ),
      ),
    );
  }
}
