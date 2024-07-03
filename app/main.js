import dgram from "dgram";

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    const message = new DNSmessage(); //create new class instance for message
    const response = Buffer.from(message.createDNSheader());
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

class DNSmessage {
  constructor() {
    this.header = this.createDNSheader();
  }

  createDNSheader() {
    const header = Buffer.alloc(12); //DNS header 12 byte long
    header.writeUInt16BE(1234, 0); //Transaction ID
    header.writeUInt16BE(0x8000, 2); //Flags - QR, OPCODE, AA, TC, RD, RA, Z, and RCODE
    header.writeUInt16BE(1, 4); // QDCOUNT: 1 (one question)
    header.writeUInt16BE(0, 6); // ANCOUNT: 0
    header.writeUInt16BE(0, 8); // NSCOUNT: 0
    header.writeUInt16BE(0, 10); // ARCOUNT: 0
    return header;
  }
}