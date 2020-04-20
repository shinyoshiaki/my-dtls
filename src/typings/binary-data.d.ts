declare module "binary-data" {
  type Types = {
    uint16be: number;
    buffer: any;
    uint8: number;
    uint24be: number;
    array: any;
    uint32be: number;
    uint48be: number;
    string: any;
  };
  declare const types: Types;
  type Encode = (o: object, spec: object) => { slice: () => number[] };
  declare const encode: Encode;

  type Decode = <T extends any>(buf: Buffer, spec: object) => T;
  declare const decode: Decode;

  export { types, encode, decode };
}
