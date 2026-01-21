import { PodConfig, stylePlugin } from "@kithinji/pod";

export default function defaultConfig(): PodConfig {
  return {
    name: "icons",
    client_plugins: [stylePlugin],
  };
}  
