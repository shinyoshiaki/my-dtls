import { DtlsServer, DtlsClient } from "../../src";
import { readFileSync } from "fs";
import { createSocket } from "dgram";

test("e2e/self", (done) => {
  const word = "self";
  const port = 55557;
  const socket = createSocket("udp4");
  socket.bind(port);
  const server = new DtlsServer({
    cert: readFileSync("assets/cert.pem").toString(),
    key: readFileSync("assets/key.pem").toString(),
    socket,
  });
  server.onData = (data) => {
    expect(data.toString()).toBe(word);
    server.send(Buffer.from(word + "_server"));
  };
  const client = new DtlsClient({
    address: "127.0.0.1",
    port,
    socket: createSocket("udp4"),
  });
  client.onConnect = () => {
    client.send(Buffer.from(word));
  };
  client.onData = (data) => {
    expect(data.toString()).toBe(word + "_server");
    done();
  };
  client.connect();
});
