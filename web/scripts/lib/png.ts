import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

export function encodeRgbPng(width: number, height: number, rgb: Uint8Array): Buffer {
  if (rgb.length !== width * height * 3)
    throw new Error('rgb buffer size does not match the dimensions');
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0))
  ]);
}

export function placeholderMap(size: number): Buffer {
  const rgb = new Uint8Array(size * size * 3);
  const centre = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centre;
      const dy = y - centre;
      const distance = Math.sqrt(dx * dx + dy * dy) / centre;
      const offset = (y * size + x) * 3;
      if (distance > 0.98) {
        rgb[offset] = 25;
        rgb[offset + 1] = 60;
        rgb[offset + 2] = 120;
      } else if (distance > 0.75) {
        rgb[offset] = 90;
        rgb[offset + 1] = 60;
        rgb[offset + 2] = 40;
      } else if (distance > 0.5) {
        rgb[offset] = 30;
        rgb[offset + 1] = 110;
        rgb[offset + 2] = 40;
      } else {
        rgb[offset] = 100;
        rgb[offset + 1] = 170;
        rgb[offset + 2] = 90;
      }
    }
  }
  return encodeRgbPng(size, size, rgb);
}
