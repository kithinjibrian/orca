import { EntityClassOrSchema } from "@/types/entity-class-or-schema.type";
import { getDataSourceToken, getRepositoryToken } from "@/utils";
import { Provider } from "@kithinji/orca";
import { DataSource, DataSourceOptions, getMetadataArgsStorage } from "typeorm";

export function createTypeOrmProviders(
  entities?: EntityClassOrSchema[],
  dataSource?: DataSource | DataSourceOptions | string,
): Provider[] {
  return (entities || []).map((entity) => ({
    provide: getRepositoryToken(entity, dataSource),
    useFactory: (dataSource?: DataSource) => {
      if (dataSource == undefined) throw new Error("DataSource is undefined");

      const entityMetadata = dataSource.entityMetadatas.find(
        (meta) => meta.target === entity,
      );
      const isTreeEntity = typeof entityMetadata?.treeType !== "undefined";
      return isTreeEntity
        ? dataSource.getTreeRepository(entity)
        : dataSource.options.type === "mongodb"
        ? dataSource.getMongoRepository(entity)
        : dataSource.getRepository(entity);
    },
    inject: [{ token: getDataSourceToken(dataSource), optional: true }],
    /**
     * Extra property to workaround dynamic modules serialisation issue
     * that occurs when "TypeOrm#forFeature()" method is called with the same number
     * of arguments and all entities share the same class names.
     */
    targetEntitySchema: getMetadataArgsStorage().tables.find(
      (item) => item.target === entity,
    ),
  }));
}
