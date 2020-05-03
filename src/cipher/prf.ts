import { NamedCurveAlgorithm } from "./namedCurve";
import { ec } from "elliptic";
import * as nacl from "tweetnacl";
const elliptic = new ec("secp256k1");

export function prfPreMasterSecret(
  publicKey: Buffer,
  privateKey: Buffer,
  curve: number
) {
  switch (curve) {
    case NamedCurveAlgorithm.namedCurveP256:
      const pub = elliptic.keyFromPublic(publicKey).getPublic();
      const x = pub.getX();
      const y = pub.getY();

      return;

    case NamedCurveAlgorithm.namedCurveX25519:
      return Buffer.from(nacl.scalarMult(privateKey, publicKey));
  }
}
