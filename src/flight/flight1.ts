import { ClientHello } from "../handshake/message/client/hello";
import { DtlsRandom } from "../handshake/random";
import { createPackets } from "../record/builder";
import { UdpContext } from "../context/udp";
import { ClientContext } from "../context/client";
import { RecordContext } from "../context/record";
import { EllipticCurves } from "../handshake/extensions/ellipticCurves";
import { Signature } from "../handshake/extensions/signature";
import { NamedCurveAlgorithm } from "../cipher/namedCurve";
import { Algorithm } from "../cipher/hash";
import { SignatureAlgorithm } from "../cipher/signature";

export const flight1 = async (
  udp: UdpContext,
  flight: ClientContext,
  record: RecordContext
) => {
  const hello = new ClientHello(
    { major: 255 - 1, minor: 255 - 2 },
    new DtlsRandom(),
    Buffer.from([]),
    Buffer.from([]),
    [0xc02b, 0xc0ae, 0xc02b, 0xc02f, 0xc00a, 0xc014, 0xc0a4, 0xc0a8, 0x00a8],
    [0],
    [{ type: 23, data: Buffer.from([]) }]
  );

  hello.extensions = [];
  const curve = EllipticCurves.createEmpty();
  curve.data = [NamedCurveAlgorithm.namedCurveP256];
  hello.extensions.push(curve.extension);
  const signature = Signature.createEmpty();
  signature.data = [
    { hash: Algorithm.sha256, signature: SignatureAlgorithm.ecdsa },
  ];
  hello.extensions.push(signature.extension);

  const packets = createPackets(flight, record)([hello]);
  const buf = Buffer.concat(packets);
  udp.socket.send(buf, udp.rinfo.port, udp.rinfo.address);
  flight.version = hello.clientVersion;
};
