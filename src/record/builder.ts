import { ContentType } from "./const";
import { DtlsPlaintext } from "./message/plaintext";
import { ClientContext } from "../context/client";
import { RecordContext } from "../context/record";
import { Handshake } from "../typings/domain";

type Fragment = { type: number; fragment: Buffer };

export const createFragments = (client: ClientContext) => (
  handshakes: Handshake[]
) => {
  client.lastFlight = handshakes;

  return handshakes
    .map((handshake) => {
      handshake.messageSeq = client.sequenceNumber++;
      const fragment = handshake.toFragment();
      const fragments = fragment.chunk().map((f) => ({
        type: ContentType.handshake,
        fragment: f.serialize(),
      }));
      return fragments;
    })
    .flatMap((v) => v);
};

export const createPlaintext = (
  client: ClientContext,
  record: RecordContext
) => (fragments: Fragment[]) => {
  return fragments.map((msg) => {
    const plaintext = new DtlsPlaintext(
      {
        contentType: msg.type,
        protocolVersion: client.version,
        epoch: client.epoch,
        sequenceNumber: record.recordSequenceNumber++,
        contentLen: msg.fragment.length,
      },
      msg.fragment
    );
    return plaintext;
  });
};
