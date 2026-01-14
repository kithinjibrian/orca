export function symbolValueReplacer(key: any, value: any) {
  if (typeof value === "symbol") {
    return `@@Symbol:${value.description}`;
  }
  return value;
}

export function symbolValueReviver(key: any, value: any) {
  if (typeof value === "string" && value.startsWith("@@Symbol:")) {
    return Symbol.for(value.slice(9));
  }
  return value;
}
