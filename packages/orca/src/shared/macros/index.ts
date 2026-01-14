export function assert$(context?: any) {
  return context?.factory.createStringLiteral("assert");
}
