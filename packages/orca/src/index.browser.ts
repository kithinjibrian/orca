import "reflect-metadata";

import * as shared from "./shared";
export { shared };

export * from "./shared/types";
export * from "./shared/symbols";
export * from "./shared/decorators";
export * from "./shared/module";
export * from "./shared/jsx";
export * from "./shared/signal";
export * from "./shared/json";
export * from "./shared/component";
export * from "./shared/module_libs";
export * from "./shared/dom";

import * as browser from "./browser";
export { browser };

export * from "./browser/dom";
export * from "./browser/factory";
export * from "./browser/modules";
