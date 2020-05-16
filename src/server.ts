import { createSocket, RemoteInfo } from "dgram";
import { DtlsContext } from "./context/dtls";
import { UdpContext } from "./context/udp";
import { parsePacket } from "./record/receive";
import { HandshakeType } from "./handshake/const";
import { FragmentedHandshake } from "./record/message/fragment";
import { RecordContext } from "./context/record";
import { createPlaintext } from "./record/builder";
import { ContentType } from "./record/const";
import { CipherContext } from "./context/cipher";
import { ClientHello } from "./handshake/message/client/hello";
import { flight2 } from "./flight/server/flight2";
import { Flight4 } from "./flight/server/flight4";
import { Flight6 } from "./flight/server/flight6";
import { SessionType } from "./cipher/suites/abstract";

type Options = RemoteInfo;

export class DtlsServer {
  onConnect?: () => void;

  udp = new UdpContext(createSocket("udp4"), this.options);
  dtls = new DtlsContext();
  record = new RecordContext();
  cipher = new CipherContext();
  constructor(private options: Partial<Options> = {}) {
    this.udp.socket.bind(options.port);
    this.udp.socket.on("message", this.udpOnMessage);
    this.cipher.sessionType = SessionType.SERVER;
  }

  private udpOnMessage = (data: Buffer, rInfo: RemoteInfo) => {
    this.udp.rinfo = rInfo;
    const messages = parsePacket(this.dtls, this.cipher)(data);
    if (messages.length === 0) return;
    switch (messages[0].type) {
      case ContentType.handshake:
        {
          this.handleHandshakes(
            messages.map((v) => v.data as FragmentedHandshake).filter((v) => v)
          );
        }
        break;
      case ContentType.applicationData:
        {
          console.log(messages[0].data?.toString());
        }
        break;
    }
  };

  handleHandshakes(handshakes: FragmentedHandshake[]) {
    switch (handshakes[0].msg_type) {
      case HandshakeType.client_hello:
        {
          const clientHello = ClientHello.deSerialize(handshakes[0].fragment);
          if (this.dtls.flight === 1) {
            flight2(this.udp, this.dtls, this.record, this.cipher)(clientHello);
          } else {
            this.dtls.bufferHandshake(handshakes[0].serialize(), false, 4);
            new Flight4(this.udp, this.dtls, this.record, this.cipher).exec();
          }
        }
        break;
      case HandshakeType.client_key_exchange:
        {
          new Flight6(this.udp, this.dtls, this.record, this.cipher).exec(
            handshakes
          );
        }
        break;
    }
  }

  send(buf: Buffer) {
    const pkt = createPlaintext(this.dtls)(
      [{ type: ContentType.applicationData, fragment: buf }],
      ++this.record.recordSequenceNumber
    )[0];
    this.udp.send(this.cipher.encryptPacket(pkt).serialize());
  }

  close() {
    this.udp.socket.close();
  }
}
