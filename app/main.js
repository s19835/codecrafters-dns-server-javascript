import dgram from "dgram";
import DNSmessage from "./DNSmessage.js";

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    const message = new DNSmessage(buf);
    const header = message.createDNSheader();
    const question = message.createDNSquestion();
    const answer = message.createDNSanswer();

    const response = Buffer.concat([header, question, answer]);

    udpSocket.send(response, rinfo.port, rinfo.address);
  } catch (e) {
    console.log(`Error receiving data: ${e}`);
  }
});

udpSocket.on("error", (err) => {
  console.log(`Error: ${err}`);
});

udpSocket.on("listening", () => {
  const address = udpSocket.address();
  console.log(`Server listening ${address.address}:${address.port}`);
});
