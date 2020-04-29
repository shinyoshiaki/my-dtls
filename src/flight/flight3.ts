import { UdpContext } from "../context/udp";
import { ClientContext } from "../context/client";
import { ClientHello } from "../handshake/message/client/hello";
import { ServerHelloVerifyRequest } from "../handshake/message/server/helloVerifyRequest";
import { createPackets } from "../record/builder";
import { RecordContext } from "../context/record";
import { receive } from "../record/receive";

export const flight3 = (
  udp: UdpContext,
  flight: ClientContext,
  record: RecordContext
) => async (verifyReq: ServerHelloVerifyRequest) => {
  const hello = flight.lastFlight[0] as ClientHello;
  hello.cookie = verifyReq.cookie;
  hello.messageSeq = 0;
  const packets = createPackets(flight, record)([hello]);
  const mergedPackets = Buffer.concat(packets);
  udp.socket.send(mergedPackets, udp.rinfo.port, udp.rinfo.address);

  // response
  const msg = await new Promise<Buffer>((r) => udp.socket.once("message", r));
  const handshakes = receive(msg);
  console.log();
};
