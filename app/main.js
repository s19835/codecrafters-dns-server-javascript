import dgram from "dgram";

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
  try {
    const message = new DNSmessage(buf); //create new class instance for message
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
  constructor(buffer) {

    if (buffer instanceof Buffer) this.buffer = buffer;
    this.reciverMessage = this.parseHeader()["message"];
    this.reciverFlag = this.parseHeader()["flag"];
    this.domain = this.getDomain();
    this.formatedDomain = this.formatDomain();
  }

  createDNSheader() {
    const header = Buffer.alloc(12); //DNS header 12 byte long
    header.writeUInt16BE(this.reciverMessage["ID"], 0); //Transaction ID
    
    //assigning new values to flags
    this.reciverFlag["QR"] = 1;
    this.reciverFlag["AA"] = 0;
    this.reciverFlag["RA"] = 0;
    this.reciverFlag["Z"] = 0;
    if (this.reciverFlag["OPCODE"] === 0) this.reciverFlag["RCODE"] = 0;
    else this.reciverFlag["RCODE"] = 4;

    const senderFlag = this.reciverFlag["QR"] << 15 | this.reciverFlag["OPCODE"] << 11 | this.reciverFlag["AA"] << 10 | this.reciverFlag["TC"] << 9 | this.reciverFlag["RD"] << 8 | this.reciverFlag["RA"] << 7 | this.reciverFlag["Z"] << 4 | this.reciverFlag["RCODE"];

    header.writeUInt16BE(senderFlag, 2); //Flags - QR, OPCODE, AA, TC, RD, RA, Z, and RCODE
    header.writeUInt16BE(1, 4); // QDCOUNT: 1 (one question)
    header.writeUInt16BE(1, 6); // ANCOUNT: 1 (one answer)
    header.writeUInt16BE(0, 8); // NSCOUNT: 0
    header.writeUInt16BE(0, 10); // ARCOUNT: 0
    return header;
  }

  createDNSquestion() {
    const domain = this.formatedDomain;
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
    const domain = this.formatedDomain;

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

    console.log(data.toString());
    const answer = Buffer.concat(
      [ domain, type, cls, ttl, length, data ]
    );

    return answer;
  }

  parseHeader() {
    const flags = this.buffer.readUInt16BE(2);

    const reciverMessage = {
      ID : this.buffer.readUInt16BE(0),
      QDCOUNT : this.buffer.readUInt16BE(4),
      ANCOUNT : this.buffer.readUInt16BE(6),
      NSCOUNT : this.buffer.readUInt16BE(8),
      ARCOUNT : this.buffer.readUInt16BE(10),
    }

    //decomposing flags use:bitwise operations
    const reciverFlag = {
      QR : (flags & 0x8000) >> 15,
      OPCODE : (flags & 0x7800) >> 11,
      AA : (flags & 0x0400) >> 10,
      TC : (flags & 0x0200) >> 9,
      RD : (flags & 0x0100) >> 8,
      RA : (flags & 0x0080) >> 7,
      Z : (flags & 0x0070) >> 4,
      RCODE : flags & 0x000F
    }

    return { message:reciverMessage, flag:reciverFlag };

  }

  getDomain() {
    const arrayBuffer = this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength);
    const view = new DataView(arrayBuffer);
    const parts = [];
    let offset = 12; // DNS header is 12 bytes

    while (true) {
        const length = view.getUint8(offset++); // Read the length of the next label
        
        if (length === 0) break; // End of the domain name
        const label = [];

        for (let i = 0; i < length; i++) {
            label.push(String.fromCharCode(view.getUint8(offset++)));
        }
       
        parts.push(label.join(""));
    }

    return parts.join(".");
  }


  formatDomain() {
    const domainParts = this.domain.split('.');

    function getLabelLength(string) {
        return Buffer.from([string.length]);
    }

    // Create domain name in DNS answer format
    const domain = Buffer.concat(
        domainParts.reduce((acc, part) => {
            acc.push(getLabelLength(part)); // Length-prefixed label
            acc.push(Buffer.from(part)); // Actual label
            return acc;
        }, []).concat([Buffer.from([0x00])]) // End of domain name
    );

    return domain;
  }
}