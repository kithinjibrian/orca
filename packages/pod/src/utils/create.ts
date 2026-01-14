import * as fs from "fs";
import * as path from "path";

interface FileEntry {
  name: string;
  content: string;
}

export interface DirEntry {
  name?: string;
  files?: FileEntry[];
  dirs?: DirEntry[];
}

export function createStructure(basePath: string, entry: DirEntry) {
  fs.mkdirSync(basePath, { recursive: true });

  entry.files?.forEach((file) => {
    fs.writeFileSync(path.join(basePath, file.name), file.content);
  });

  entry.dirs?.forEach((dir) => {
    const dirPath = path.join(basePath, dir.name || "");
    createStructure(dirPath, dir);
  });
}
