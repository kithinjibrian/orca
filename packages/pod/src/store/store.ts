export class Store {
  private static instance: Store;
  private containers: Map<string, unknown[]> = new Map();

  private constructor() {}

  public static getInstance(): Store {
    if (!Store.instance) {
      Store.instance = new Store();
    }
    return Store.instance;
  }

  public set<T>(key: string, value: T): void {
    const existing = this.containers.get(key) || [];
    existing.push(value);
    this.containers.set(key, existing);
  }

  public get<T>(key: string): T[] | undefined {
    const values = this.containers.get(key);
    return values as T[] | undefined;
  }

  public has(key: string): boolean {
    return this.containers.has(key);
  }

  public delete(key: string): boolean {
    return this.containers.delete(key);
  }

  public clear(): void {
    this.containers.clear();
  }

  public keys(): IterableIterator<string> {
    return this.containers.keys();
  }

  public get size(): number {
    return this.containers.size;
  }
}
