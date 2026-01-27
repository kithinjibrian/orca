import { DEFAULT_DATA_SOURCE_NAME } from "@/symbols";
import { EntityClassOrSchema } from "@/types/entity-class-or-schema.type";
import { getRepositoryToken } from "@/utils";
import { Inject } from "@kithinji/orca";

export const InjectRepository = (
  entity: EntityClassOrSchema,
  dataSource: string = DEFAULT_DATA_SOURCE_NAME,
): ReturnType<typeof Inject> => Inject(getRepositoryToken(entity, dataSource));
