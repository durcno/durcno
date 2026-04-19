export class BinaryReader {
  buffer: Buffer;
  position: number;
  isBigEndian: boolean;

  constructor(buffer: Buffer, isBigEndian: boolean = false) {
    this.buffer = buffer;
    this.position = 0;
    this.isBigEndian = isBigEndian;
  }

  private _read(
    readLE: (offset: number) => number,
    readBE: (offset: number) => number,
    size: number,
  ): number {
    let value: number;

    if (this.isBigEndian) value = readBE.call(this.buffer, this.position);
    else value = readLE.call(this.buffer, this.position);

    this.position += size;

    return value;
  }

  readUInt8(): number {
    return this._read(
      Buffer.prototype.readUInt8,
      Buffer.prototype.readUInt8,
      1,
    );
  }

  readUInt16(): number {
    return this._read(
      Buffer.prototype.readUInt16LE,
      Buffer.prototype.readUInt16BE,
      2,
    );
  }

  readUInt32(): number {
    return this._read(
      Buffer.prototype.readUInt32LE,
      Buffer.prototype.readUInt32BE,
      4,
    );
  }

  readInt8(): number {
    return this._read(Buffer.prototype.readInt8, Buffer.prototype.readInt8, 1);
  }

  readInt16(): number {
    return this._read(
      Buffer.prototype.readInt16LE,
      Buffer.prototype.readInt16BE,
      2,
    );
  }

  readInt32(): number {
    return this._read(
      Buffer.prototype.readInt32LE,
      Buffer.prototype.readInt32BE,
      4,
    );
  }

  readFloat(): number {
    return this._read(
      Buffer.prototype.readFloatLE,
      Buffer.prototype.readFloatBE,
      4,
    );
  }

  readDouble(): number {
    return this._read(
      Buffer.prototype.readDoubleLE,
      Buffer.prototype.readDoubleBE,
      8,
    );
  }

  readVarInt(): number {
    let nextByte: number;
    let result = 0;
    let bytesRead = 0;

    do {
      nextByte = this.buffer[this.position + bytesRead];
      result += (nextByte & 0x7f) << (7 * bytesRead);
      bytesRead++;
    } while (nextByte >= 0x80);

    this.position += bytesRead;

    return result;
  }
}
