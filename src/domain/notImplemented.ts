/** Contract stub helper. Must not remain referenced once a phase is done. */
export function notImplemented(name: string): never {
  throw new Error(`not implemented: ${name}`);
}
