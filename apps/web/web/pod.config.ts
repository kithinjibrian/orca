import { PodConfig, stylePlugin } from "@kithinji/pod";

export default function defaultConfig(): PodConfig {
  return {
    name: "web",
    client_plugins: [stylePlugin],
  };
}  
