import { ClientHello } from "../../handshake/message/client/hello";
import { DtlsRandom } from "../../handshake/random";
import { createFragments, createPlaintext } from "../../record/builder";
import { TransportContext } from "../../context/transport";
import { DtlsContext } from "../../context/dtls";
import { EllipticCurves } from "../../handshake/extensions/ellipticCurves";
import { Signature } from "../../handshake/extensions/signature";
import { generateKeyPair } from "../../cipher/namedCurve";
import { CipherContext } from "../../context/cipher";
import { ServerHelloVerifyRequest } from "../../handshake/message/server/helloVerifyRequest";
import { randomBytes } from "crypto";
import { CipherSuite, NamedCurveAlgorithm } from "../../cipher/const";
import { ContentType } from "../../record/const";

export const flight2 = (
  udp: TransportContext,
  dtls: DtlsContext,
  cipher: CipherContext
) => (clientHello: ClientHello) => {
  clientHello.extensions.forEach((extension) => {
    switch (extension.type) {
      case EllipticCurves.type:
        {
          const curves = EllipticCurves.fromData(extension.data).data;
          cipher.namedCurve = NamedCurveAlgorithm.namedCurveX25519;
        }
        break;
      case Signature.type:
        {
          const signature = Signature.fromData(extension.data).data;
        }
        break;
    }
  });
  cipher.localRandom = new DtlsRandom();
  cipher.remoteRandom = DtlsRandom.from(clientHello.random);
  cipher.cipherSuite = CipherSuite.EcdheRsaWithAes128GcmSha256;
  cipher.localKeyPair = generateKeyPair(cipher.namedCurve!);

  dtls.cookie = randomBytes(20);
  const helloVerifyReq = new ServerHelloVerifyRequest(
    {
      major: 255 - 1,
      minor: 255 - 2,
    },
    dtls.cookie
  );
  const fragments = createFragments(dtls)([helloVerifyReq]);
  const packets = createPlaintext(dtls)(
    fragments.map((fragment) => ({
      type: ContentType.handshake,
      fragment: fragment.serialize(),
    })),
    ++dtls.recordSequenceNumber
  );
  const buf = Buffer.concat(packets.map((v) => v.serialize()));
  dtls.flight = 2;
  udp.send(buf);
};
