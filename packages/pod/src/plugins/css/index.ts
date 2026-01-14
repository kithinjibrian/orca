import { Store } from "@/store";
import { PluginBuild } from "esbuild";
import * as fs from "fs";

export function stylePlugin(store: Store) {
  return {
    name: "style",
    setup(build: PluginBuild) {
      build.onEnd(() => {
        const styleRules = store.get("style_rules");

        if (!styleRules || styleRules.length === 0) {
          console.log("No style rules generated");
          return;
        }

        const allRules = styleRules.flat();
        const uniqueRules = [...new Set(allRules)];

        const cssOutput = uniqueRules.join("\n");
        fs.writeFileSync("public/index.css", cssOutput);
      });
    },
  };
}
