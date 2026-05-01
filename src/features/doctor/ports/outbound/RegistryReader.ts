export type RegistryFile =
  | { kind: "found"; path: string; content: string }
  | { kind: "not-found"; path: string };

export interface RegistryReader {
  readRegistry(rulesPath: string): Promise<RegistryFile>;
  cliVersion(): Promise<string>;
}
