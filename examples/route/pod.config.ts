import { PodConfig, stylePlugin } from "@kithinji/pod";

export default function defaultConfig(): PodConfig {
  return {
    name: "route",
    client_plugins: [stylePlugin],
  };
}  
