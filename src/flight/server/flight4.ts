import { createFragments, createPlaintext } from "../../record/builder";
import { TransportContext } from "../../context/transport";
import { DtlsContext } from "../../context/dtls";
import { CipherContext } from "../../context/cipher";
import { ServerHello } from "../../handshake/message/server/hello";
import { Certificate } from "../../handshake/message/certificate";
import { generateKeySignature, parseX509 } from "../../cipher/x509";
import { ServerKeyExchange } from "../../handshake/message/server/keyExchange";
import { ServerHelloDone } from "../../handshake/message/server/helloDone";
import { SignatureAlgorithm, HashAlgorithm } from "../../cipher/const";
import { ContentType } from "../../record/const";
import { Handshake } from "../../typings/domain";
import { ServerCertificateRequest } from "../../handshake/message/server/certificateRequest";
import { SrtpContext } from "../../context/srtp";
import { UseSRTP } from "../../handshake/extensions/useSrtp";

export class Flight4 {
  constructor(
    private udp: TransportContext,
    private dtls: DtlsContext,
    private cipher: CipherContext,
    private srtp: SrtpContext
  ) {}

  exec(certificateRequest: boolean = false) {
    if (this.dtls.flight === 4) return;
    this.dtls.flight = 4;
    this.dtls.sequenceNumber = 1;

    const messages = [
      this.sendServerHello(),
      this.sendCertificate(),
      this.sendServerKeyExchange(),
      certificateRequest && this.sendCertificateRequest(),
      this.sendServerHelloDone(),
    ];
    messages.forEach((buf) => {
      if (buf) this.udp.send(buf);
    });
  }

  createPacket(handshakes: Handshake[]) {
    const fragments = createFragments(this.dtls)(handshakes);
    this.dtls.bufferHandshakeCache(fragments, true, 4);
    const packets = createPlaintext(this.dtls)(
      fragments.map((fragment) => ({
        type: ContentType.handshake,
        fragment: fragment.serialize(),
      })),
      ++this.dtls.recordSequenceNumber
    );
    const buf = Buffer.concat(packets.map((v) => v.serialize()));
    return buf;
  }

  sendServerHello() {
    if (!this.cipher.localRandom || !this.cipher.cipherSuite)
      throw new Error("");

    const extensions = [];
    if (this.srtp.srtpProfile) {
      extensions.push(
        UseSRTP.create([this.srtp.srtpProfile], Buffer.from([0x00])).extension
      );
    }

    const serverHello = new ServerHello(
      this.dtls.version,
      this.cipher.localRandom,
      Buffer.from([0x00]),
      this.cipher.cipherSuite,
      0, // do not compression
      extensions
    );
    const buf = this.createPacket([serverHello]);
    return buf;
  }

  sendCertificate() {
    if (!this.cipher.certPem || !this.cipher.keyPem) throw new Error();

    const sign = parseX509(this.cipher.certPem, this.cipher.keyPem);
    this.cipher.localPrivateKey = sign.key;
    const certificate = new Certificate([Buffer.from(sign.cert)]);

    const buf = this.createPacket([certificate]);
    return buf;
  }

  sendServerKeyExchange() {
    if (
      !this.cipher.localRandom ||
      !this.cipher.remoteRandom ||
      !this.cipher.localKeyPair ||
      !this.cipher.namedCurve ||
      !this.cipher.localPrivateKey
    )
      throw new Error("");

    const serverRandom = this.cipher.localRandom.serialize();
    const clientRandom = this.cipher.remoteRandom.serialize();
    const signature = generateKeySignature(
      clientRandom,
      serverRandom,
      this.cipher.localKeyPair.publicKey,
      this.cipher.namedCurve,
      this.cipher.localPrivateKey,
      "sha256"
    );
    const keyExchange = new ServerKeyExchange(
      3, // ec curve type
      this.cipher.namedCurve,
      this.cipher.localKeyPair.publicKey.length,
      this.cipher.localKeyPair.publicKey,
      HashAlgorithm.sha256, // hash algorithm
      SignatureAlgorithm.rsa, // signature algorithm
      signature.length,
      signature
    );

    const buf = this.createPacket([keyExchange]);
    return buf;
  }

  sendCertificateRequest() {
    const handshake = new ServerCertificateRequest(
      [
        1, // clientCertificateTypeRSASign
        64, // clientCertificateTypeECDSASign
      ],
      [
        { hash: HashAlgorithm.sha256, signature: SignatureAlgorithm.rsa },
        { hash: HashAlgorithm.sha256, signature: SignatureAlgorithm.ecdsa },
      ],
      []
    );
    const buf = this.createPacket([handshake]);
    return buf;
  }

  sendServerHelloDone() {
    const handshake = new ServerHelloDone();

    const buf = this.createPacket([handshake]);
    return buf;
  }
}
