import { Flight1 } from "./flight/client/flight1";
import { parsePacket } from "./record/receive";
import { ServerHelloVerifyRequest } from "./handshake/message/server/helloVerifyRequest";
import { Flight3 } from "./flight/client/flight3";
import { ServerHello } from "./handshake/message/server/hello";
import { ServerHelloDone } from "./handshake/message/server/helloDone";
import { HandshakeType } from "./handshake/const";
import { Certificate } from "./handshake/message/certificate";
import { Flight5 } from "./flight/client/flight5";
import { FragmentedHandshake } from "./record/message/fragment";
import { ServerKeyExchange } from "./handshake/message/server/keyExchange";
import { ContentType } from "./record/const";
import { SessionType } from "./cipher/suites/abstract";
import { DtlsSocket, Options } from "./socket";
import { ServerCertificateRequest } from "./handshake/message/server/certificateRequest";

export class DtlsClient extends DtlsSocket {
  private flight4Buffer: FragmentedHandshake[] = [];
  constructor(options: Options) {
    super(options, true);
    this.cipher.certPem = options.cert;
    this.cipher.keyPem = options.key;
    this.cipher.sessionType = SessionType.CLIENT;
    this.udp.socket.onData = this.udpOnMessage;
  }

  connect() {
    new Flight1(this.udp, this.dtls, this.cipher).exec(this.extensions);
  }

  private udpOnMessage = (data: Buffer) => {
    const messages = parsePacket(this.dtls, this.cipher)(data);
    if (messages.length === 0) {
      // this is not dtls message
      return;
    }
    switch (messages[messages.length - 1].type) {
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
      case ContentType.alert:
        this.onClose();
        break;
    }
  };

  private handleHandshakes(handshakes: FragmentedHandshake[]) {
    if (handshakes[0].msg_type === HandshakeType.server_hello) {
      this.flight4Buffer = handshakes;
    }
    if (this.flight4Buffer.length > 0) {
      this.flight4Buffer = [...this.flight4Buffer, ...handshakes];
    }

    switch (handshakes[handshakes.length - 1].msg_type) {
      case HandshakeType.hello_verify_request:
        {
          const verifyReq = ServerHelloVerifyRequest.deSerialize(
            handshakes[0].fragment
          );
          new Flight3(this.udp, this.dtls).exec(verifyReq);
        }
        break;
      case HandshakeType.server_hello_done:
        {
          const fragments = [
            HandshakeType.server_hello,
            HandshakeType.certificate,
            HandshakeType.server_key_exchange,
            HandshakeType.certificate_request,
            HandshakeType.server_hello_done,
          ]
            .map((type) => {
              const fragments = FragmentedHandshake.findAllFragments(
                this.flight4Buffer,
                type
              );
              if (fragments.length === 0)
                return (undefined as any) as FragmentedHandshake;
              return FragmentedHandshake.assemble(fragments);
            })
            .filter((v) => v);
          this.flight4Buffer = [];
          this.dtls.bufferHandshakeCache(fragments, false, 4);

          const messages = fragments.map((handshake) => {
            switch (handshake.msg_type) {
              case HandshakeType.server_hello:
                return ServerHello.deSerialize(handshake.fragment);
              case HandshakeType.certificate:
                return Certificate.deSerialize(handshake.fragment);
              case HandshakeType.server_key_exchange:
                return ServerKeyExchange.deSerialize(handshake.fragment);
              case HandshakeType.certificate_request:
                return ServerCertificateRequest.deSerialize(handshake.fragment);
              case HandshakeType.server_hello_done:
                return ServerHelloDone.deSerialize(handshake.fragment);
              default:
                return (undefined as any) as ServerHello;
            }
          });

          new Flight5(this.udp, this.dtls, this.cipher, this.srtp).exec(
            messages
          );
        }
        break;
      case HandshakeType.finished:
        {
          this.dtls.flight = 7;
          if (this.onConnect) this.onConnect();
        }
        break;
    }
  }
}
