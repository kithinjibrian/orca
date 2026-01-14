import { PodConfig, stylePlugin } from "@kithinji/pod";

export default function defaultConfig(): PodConfig {
  return {
    name: "test",
    client_plugins: [stylePlugin],
  };
}  
