import dgram from "dgram";

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    const message = new DNSmessage(); //create new class instance for message
    const header = message.createDNSheader();
    const question = message.createDNSquestion();
    const answer = message.createDNSanswer();
    const response = Buffer.concat([ 
      header, 
      question, 
      answer 
    ]);
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
    this.question = this.createDNSquestion();
    this.answer = this.createDNSanswer();
  }

  createDNSheader() {
    const header = Buffer.alloc(12); //DNS header 12 byte long
    header.writeUInt16BE(1234, 0); //Transaction ID
    header.writeUInt16BE(0x8000, 2); //Flags - QR, OPCODE, AA, TC, RD, RA, Z, and RCODE
    header.writeUInt16BE(1, 4); // QDCOUNT: 1 (one question)
    header.writeUInt16BE(1, 6); // ANCOUNT: 1 (one answer)
    header.writeUInt16BE(0, 8); // NSCOUNT: 0
    header.writeUInt16BE(0, 10); // ARCOUNT: 0
    return header;
  }

  createDNSquestion() {
    const domain = Buffer.from(`\x0ccodecrafters\x02io\x00`);
    const type = Buffer.alloc(2);
    type.writeUInt16BE(1, 0);
    const cls = Buffer.alloc(2);
    cls.writeUInt16BE(1, 0);

    const question = Buffer.concat(
      [domain, type, cls]
    );

    return question;
  }

  createDNSanswer() {
    const domain = Buffer.from(`\x0ccodecrafters\x02io\x00`);
    
    const type = Buffer.alloc(2);
    type.writeUInt16BE(1, 0);
    
    const cls = Buffer.alloc(2);
    cls.writeUInt16BE(1, 0);

    const ttl = Buffer.alloc(4);
    ttl.writeUInt32BE(60, 0);

    const length = Buffer.alloc(2);
    ttl.writeUInt16BE(4, 0);

    const data = Buffer.alloc(4);
    data.writeUInt32BE(`\x08\x08\x08\x08`);


    const answer = Buffer.concat(
      [ domain, type, cls, ttl, length, data ]
    );

    return answer;
  }



}