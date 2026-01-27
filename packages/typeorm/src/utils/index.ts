import { DEFAULT_DATA_SOURCE_NAME } from "@/symbols";
import { EntityClassOrSchema } from "@/types/entity-class-or-schema.type";
import { Constructor } from "@kithinji/orca";
import { delay, Observable, retryWhen, scan } from "rxjs";
import {
  AbstractRepository,
  Connection,
  DataSource,
  DataSourceOptions,
  EntityManager,
  EntitySchema,
  Repository,
} from "typeorm";

export function getDataSourceToken(
  dataSource:
    | DataSource
    | DataSourceOptions
    | string = DEFAULT_DATA_SOURCE_NAME,
): string | Function | Constructor<DataSource> {
  return DEFAULT_DATA_SOURCE_NAME === dataSource
    ? DataSource ?? Connection
    : "string" === typeof dataSource
    ? `${dataSource}DataSource`
    : DEFAULT_DATA_SOURCE_NAME === dataSource.name || !dataSource.name
    ? DataSource ?? Connection
    : `${dataSource.name}DataSource`;
}

export function getEntityManagerToken(
  dataSource:
    | DataSource
    | DataSourceOptions
    | string = DEFAULT_DATA_SOURCE_NAME,
): string | Function {
  return DEFAULT_DATA_SOURCE_NAME === dataSource
    ? EntityManager
    : "string" === typeof dataSource
    ? `${dataSource}EntityManager`
    : DEFAULT_DATA_SOURCE_NAME === dataSource.name || !dataSource.name
    ? EntityManager
    : `${dataSource.name}EntityManager`;
}

export function getDataSourceName(options: DataSourceOptions): string {
  return options && options.name ? options.name : DEFAULT_DATA_SOURCE_NAME;
}

export function getDataSourcePrefix(
  dataSource:
    | DataSource
    | DataSourceOptions
    | string = DEFAULT_DATA_SOURCE_NAME,
): string {
  if (dataSource === DEFAULT_DATA_SOURCE_NAME) {
    return "";
  }
  if (typeof dataSource === "string") {
    return dataSource + "_";
  }
  if (dataSource.name === DEFAULT_DATA_SOURCE_NAME || !dataSource.name) {
    return "";
  }
  return dataSource.name + "_";
}

export function getCustomRepositoryToken(repository: Function): string {
  if (repository === null || repository === undefined) {
    throw new Error("Circular dependancy injection @InjectRepository()");
  }
  return repository.name;
}

export function getRepositoryToken(
  entity: EntityClassOrSchema,
  dataSource:
    | DataSource
    | DataSourceOptions
    | string = DEFAULT_DATA_SOURCE_NAME,
): Function | string {
  if (entity === null || entity === undefined) {
    throw new Error("Circular dependancy injection @InjectRepository()");
  }
  const dataSourcePrefix = getDataSourcePrefix(dataSource);
  if (
    entity instanceof Function &&
    (entity.prototype instanceof Repository ||
      entity.prototype instanceof AbstractRepository)
  ) {
    if (!dataSourcePrefix) {
      return entity;
    }
    return `${dataSourcePrefix}${getCustomRepositoryToken(entity)}`;
  }

  if (entity instanceof EntitySchema) {
    return `${dataSourcePrefix}${
      entity.options.target ? entity.options.target.name : entity.options.name
    }Repository`;
  }
  return `${dataSourcePrefix}${entity.name}Repository`;
}

export function handleRetry(
  retryAttempts = 9,
  retryDelay = 3000,
  dataSourceName = DEFAULT_DATA_SOURCE_NAME,
  verboseRetryLog = false,
  toRetry?: (err: any) => boolean,
): <T>(source: Observable<T>) => Observable<T> {
  return <T>(source: Observable<T>) =>
    source.pipe(
      retryWhen((e) =>
        e.pipe(
          scan((errorCount, error: Error) => {
            if (toRetry && !toRetry(error)) {
              throw error;
            }
            const dataSourceInfo =
              dataSourceName === DEFAULT_DATA_SOURCE_NAME
                ? ""
                : ` (${dataSourceName})`;
            const verboseMessage = verboseRetryLog
              ? ` Message: ${error.message}.`
              : "";

            console.error(
              `Unable to connect to the database${dataSourceInfo}.${verboseMessage} Retrying (${
                errorCount + 1
              })...`,
              error.stack,
            );
            if (errorCount + 1 >= retryAttempts) {
              throw error;
            }
            return errorCount + 1;
          }, 0),
          delay(retryDelay),
        ),
      ),
    );
}
