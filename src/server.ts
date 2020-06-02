import { parsePacket } from "./record/receive";
import { HandshakeType } from "./handshake/const";
import { FragmentedHandshake } from "./record/message/fragment";
import { ContentType } from "./record/const";
import { ClientHello } from "./handshake/message/client/hello";
import { flight2 } from "./flight/server/flight2";
import { Flight4 } from "./flight/server/flight4";
import { Flight6 } from "./flight/server/flight6";
import { SessionType } from "./cipher/suites/abstract";
import { DtlsSocket } from "./socket";
import { Transport } from "./transport";

type Options = {
  cert: string;
  key: string;
  socket: Transport;
};

export class DtlsServer extends DtlsSocket {
  constructor(options: Options) {
    super(options);
    this.cipher.certPem = options.cert;
    this.cipher.keyPem = options.key;
    this.cipher.sessionType = SessionType.SERVER;
    this.udp.socket.onData = this.udpOnMessage;
  }

  private udpOnMessage = (data: Buffer) => {
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
          this.onData(messages[0].data as Buffer);
        }
        break;
    }
  };

  private handleHandshakes(handshakes: FragmentedHandshake[]) {
    switch (handshakes[0].msg_type) {
      case HandshakeType.client_hello:
        {
          const assemble = FragmentedHandshake.assemble(handshakes);
          const clientHello = ClientHello.deSerialize(assemble.fragment);
          if (this.dtls.flight === 1) {
            flight2(this.udp, this.dtls, this.record, this.cipher)(clientHello);
          } else {
            this.dtls.bufferHandshakeCache([assemble], false, 4);
            new Flight4(this.udp, this.dtls, this.record, this.cipher).exec();
          }
        }
        break;
      case HandshakeType.client_key_exchange:
        {
          new Flight6(this.udp, this.dtls, this.record, this.cipher).exec(
            handshakes
          );
          setTimeout(() => {
            if (this.onConnect) this.onConnect();
          }, 100);
        }
        break;
    }
  }
}
