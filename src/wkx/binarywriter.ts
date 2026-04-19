export class BinaryWriter {
  buffer: Buffer;
  position: number;
  allowResize: boolean;

  constructor(size: number, allowResize: boolean = false) {
    this.buffer = Buffer.alloc(size);
    this.position = 0;
    this.allowResize = allowResize;
  }

  private ensureSize(size: number): void {
    if (this.buffer.length < this.position + size) {
      if (this.allowResize) {
        const tempBuffer = Buffer.alloc(this.position + size);
        this.buffer.copy(tempBuffer, 0, 0, this.buffer.length);
        this.buffer = tempBuffer;
      } else {
        throw new RangeError("index out of range");
      }
    }
  }

  writeUInt8(value: number): void {
    this.ensureSize(1);
    this.buffer.writeUInt8(value, this.position);
    this.position += 1;
  }

  writeUInt16LE(value: number): void {
    this.ensureSize(2);
    this.buffer.writeUInt16LE(value, this.position);
    this.position += 2;
  }

  writeUInt16BE(value: number): void {
    this.ensureSize(2);
    this.buffer.writeUInt16BE(value, this.position);
    this.position += 2;
  }

  writeUInt32LE(value: number, noAssert?: boolean): void {
    this.ensureSize(4);
    this.buffer.writeUInt32LE(value, this.position);
    this.position += 4;
  }

  writeUInt32BE(value: number): void {
    this.ensureSize(4);
    this.buffer.writeUInt32BE(value, this.position);
    this.position += 4;
  }

  writeInt8(value: number): void {
    this.ensureSize(1);
    this.buffer.writeInt8(value, this.position);
    this.position += 1;
  }

  writeInt16LE(value: number): void {
    this.ensureSize(2);
    this.buffer.writeInt16LE(value, this.position);
    this.position += 2;
  }

  writeInt16BE(value: number): void {
    this.ensureSize(2);
    this.buffer.writeInt16BE(value, this.position);
    this.position += 2;
  }

  writeInt32LE(value: number): void {
    this.ensureSize(4);
    this.buffer.writeInt32LE(value, this.position);
    this.position += 4;
  }

  writeInt32BE(value: number): void {
    this.ensureSize(4);
    this.buffer.writeInt32BE(value, this.position);
    this.position += 4;
  }

  writeFloatLE(value: number): void {
    this.ensureSize(4);
    this.buffer.writeFloatLE(value, this.position);
    this.position += 4;
  }

  writeFloatBE(value: number): void {
    this.ensureSize(4);
    this.buffer.writeFloatBE(value, this.position);
    this.position += 4;
  }

  writeDoubleLE(value: number): void {
    this.ensureSize(8);
    this.buffer.writeDoubleLE(value, this.position);
    this.position += 8;
  }

  writeDoubleBE(value: number): void {
    this.ensureSize(8);
    this.buffer.writeDoubleBE(value, this.position);
    this.position += 8;
  }

  writeBuffer(buffer: Buffer): void {
    this.ensureSize(buffer.length);
    buffer.copy(this.buffer, this.position, 0, buffer.length);
    this.position += buffer.length;
  }

  writeVarInt(value: number): number {
    let length = 1;

    while ((value & 0xffffff80) !== 0) {
      this.writeUInt8((value & 0x7f) | 0x80);
      value >>>= 7;
      length++;
    }

    this.writeUInt8(value & 0x7f);

    return length;
  }
}
