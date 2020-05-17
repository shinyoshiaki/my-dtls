import { spawn } from "child_process";
import { DtlsServer } from "../../src/server";
import { readFileSync } from "fs";

describe("e2e/server", () => {
  test("openssl", (done) => {
    const server = new DtlsServer({
      port: 55556,
      cert: readFileSync("assets/cert.pem").toString(),
      key: readFileSync("assets/key.pem").toString(),
    });
    server.onConnect = () => {
      server.send(Buffer.from("my_dtls_server"));
    };

    setTimeout(() => {
      const client = spawn("openssl", [
        "s_client",
        "-dtls1_2",
        "-connect",
        "127.0.0.1:55556",
      ]);
      client.stdout.setEncoding("ascii");
      client.stdout.on("data", (data: string) => {
        if (data.includes("my_dtls_server")) {
          done();
          server.close();
        }
      });
    }, 100);
  });
});
