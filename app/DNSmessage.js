export default class DNSmessage {
  constructor(buffer) {
    if (buffer instanceof Buffer) this.buffer = buffer;
    this.reciverMessage = this.parseHeader()["message"];
    this.reciverFlag = this.parseHeader()["flag"];
    this.questions = this.parseQuestions();
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
    header.writeUInt16BE(this.reciverMessage["QDCOUNT"], 4); // QDCOUNT: number of questions
    header.writeUInt16BE(this.reciverMessage["QDCOUNT"], 6); // ANCOUNT: number of answers (same as questions)
    header.writeUInt16BE(0, 8); // NSCOUNT: 0
    header.writeUInt16BE(0, 10); // ARCOUNT: 0
    return header;
  }

  parseHeader() {
    const flags = this.buffer.readUInt16BE(2);

    const reciverMessage = {
      ID: this.buffer.readUInt16BE(0),
      QDCOUNT: this.buffer.readUInt16BE(4),
      ANCOUNT: this.buffer.readUInt16BE(6),
      NSCOUNT: this.buffer.readUInt16BE(8),
      ARCOUNT: this.buffer.readUInt16BE(10),
    };

    //decomposing flags using bitwise operations
    const reciverFlag = {
      QR: (flags & 0x8000) >> 15,
      OPCODE: (flags & 0x7800) >> 11,
      AA: (flags & 0x0400) >> 10,
      TC: (flags & 0x0200) >> 9,
      RD: (flags & 0x0100) >> 8,
      RA: (flags & 0x0080) >> 7,
      Z: (flags & 0x0070) >> 4,
      RCODE: flags & 0x000F,
    };

    return { message: reciverMessage, flag: reciverFlag };
  }

  parseQuestions() {
    let offset = 12; // DNS header is 12 bytes
    const questions = [];

    for (let i = 0; i < this.reciverMessage["QDCOUNT"]; i++) {
      const domain = this.parseDomain(offset);
      offset += domain.offset; // Adjust offset by the length of the domain
      
      const qType = this.buffer.readUInt16BE(offset);
      
      const qClass = this.buffer.readUInt16BE(offset + 2);
      offset += 4; // Type and Class are 2 bytes each

      questions.push({
        domain: domain.name,
        type: qType,
        class: qClass,
      });
    }

    return questions;
  }

  parseDomain(offset) {
    const arrayBuffer = this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength);
    const view = new DataView(arrayBuffer);
    const parts = [];
    
    const POINTER_MASK = 0b11000000;
    
    let originalOffset = offset;

    while (true) {
      const length = view.getUint8(offset++);
      
      if (length === 0) break;
      
      if (length & POINTER_MASK) {
        const pointer = ((length & ~POINTER_MASK) << 8) | view.getUint8(offset++);
        return { name: this.parseDomain(pointer).name, offset: offset - originalOffset };
      }
      
      const label = [];
      
      for (let i = 0; i < length; i++) {
        label.push(String.fromCharCode(view.getUint8(offset++)));
      }
      
      parts.push(label.join(""));
    }
    
    return { name: parts.join("."), offset: offset - originalOffset };
  }

  createDNSquestion() {
    return Buffer.concat(this.questions.map(q => this.formatQuestion(q.domain, q.type, q.class)));
  }

  formatQuestion(domain, qType, qClass) {
    const formatedDomain = this.formatDomain(domain);
    
    const type = Buffer.alloc(2);
    type.writeUInt16BE(qType, 0);
    
    const cls = Buffer.alloc(2);
    cls.writeUInt16BE(qClass, 0);
    
    return Buffer.concat([formatedDomain, type, cls]);
  }

  createDNSanswer() {
    return Buffer.concat(this.questions.map(q => this.formatAnswer(q.domain, 1, 1, 60, '8.8.8.8')));
  }

  formatAnswer(domain, qType, qClass, ttl, ipAddress) {
    const formatedDomain = this.formatDomain(domain);
    
    const type = Buffer.alloc(2);
    type.writeUInt16BE(qType, 0);
    
    const cls = Buffer.alloc(2);
    cls.writeUInt16BE(qClass, 0);
    
    const ttlBuffer = Buffer.alloc(4);
    ttlBuffer.writeUInt32BE(ttl, 0);
    
    const length = Buffer.alloc(2);
    length.writeUInt16BE(4, 0);
    
    const data = Buffer.from(ipAddress.split('.').map(Number));
    return Buffer.concat([formatedDomain, type, cls, ttlBuffer, length, data]);
  }

  formatDomain(domain) {
    const domainParts = domain.split('.');
    
    const buffers = domainParts.map(part => Buffer.concat([Buffer.from([part.length]), Buffer.from(part)]));
    
    return Buffer.concat([...buffers, Buffer.from([0x00])]);
  }
}
