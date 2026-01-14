class Store {
  private namespace = new Map<string, unknown>();

  set<T>(name: string, value: T): void {
    this.namespace.set(name, value);
  }

  get<T>(name: string): T | undefined {
    return this.namespace.get(name) as T | undefined;
  }

  update<T>(name: string, updater: (current: T | undefined) => T): void {
    const current = this.get<T>(name);
    const next = updater(current);
    this.set(name, next);
  }
}

export const store = new Store();
