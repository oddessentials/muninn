using System;
using System.IO;
using System.IO.Compression;

namespace GuildTelemetry.Core
{
    public static class PngEncoder
    {
        private static readonly uint[] CrcTable = BuildCrcTable();
        private static readonly byte[] Signature = { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a };

        public static byte[] EncodeIndexed(int width, int height, byte[] pixels, byte[][] palette)
        {
            if (pixels.Length != width * height)
            {
                throw new ArgumentException("pixel buffer size does not match the dimensions", nameof(pixels));
            }

            if (palette.Length == 0 || palette.Length > 256)
            {
                throw new ArgumentException("an indexed PNG needs 1 to 256 palette entries", nameof(palette));
            }

            byte[] raw = new byte[(width + 1) * height];
            for (int y = 0; y < height; y++)
            {
                raw[y * (width + 1)] = 0;
                Buffer.BlockCopy(pixels, y * width, raw, y * (width + 1) + 1, width);
            }

            byte[] header = new byte[13];
            WriteUInt32(header, 0, (uint)width);
            WriteUInt32(header, 4, (uint)height);
            header[8] = 8;
            header[9] = 3;
            header[10] = 0;
            header[11] = 0;
            header[12] = 0;

            byte[] plte = new byte[palette.Length * 3];
            for (int i = 0; i < palette.Length; i++)
            {
                plte[i * 3] = palette[i][0];
                plte[i * 3 + 1] = palette[i][1];
                plte[i * 3 + 2] = palette[i][2];
            }

            using (MemoryStream output = new MemoryStream())
            {
                output.Write(Signature, 0, Signature.Length);
                WriteChunk(output, "IHDR", header);
                WriteChunk(output, "PLTE", plte);
                WriteChunk(output, "IDAT", Zlib(raw));
                WriteChunk(output, "IEND", new byte[0]);
                return output.ToArray();
            }
        }

        public static byte[] Zlib(byte[] data)
        {
            using (MemoryStream output = new MemoryStream())
            {
                output.WriteByte(0x78);
                output.WriteByte(0x9c);
                using (DeflateStream deflate = new DeflateStream(output, CompressionMode.Compress, true))
                {
                    deflate.Write(data, 0, data.Length);
                }

                byte[] adler = new byte[4];
                WriteUInt32(adler, 0, Adler32(data));
                output.Write(adler, 0, 4);
                return output.ToArray();
            }
        }

        public static uint Adler32(byte[] data)
        {
            uint a = 1;
            uint b = 0;
            foreach (byte value in data)
            {
                a = (a + value) % 65521;
                b = (b + a) % 65521;
            }

            return (b << 16) | a;
        }

        public static uint Crc32(byte[] data, int offset, int count)
        {
            uint crc = 0xffffffff;
            for (int i = offset; i < offset + count; i++)
            {
                crc = CrcTable[(crc ^ data[i]) & 0xff] ^ (crc >> 8);
            }

            return crc ^ 0xffffffff;
        }

        private static void WriteChunk(Stream output, string type, byte[] data)
        {
            byte[] typeBytes = System.Text.Encoding.ASCII.GetBytes(type);
            byte[] length = new byte[4];
            WriteUInt32(length, 0, (uint)data.Length);
            output.Write(length, 0, 4);
            byte[] body = new byte[typeBytes.Length + data.Length];
            Buffer.BlockCopy(typeBytes, 0, body, 0, typeBytes.Length);
            Buffer.BlockCopy(data, 0, body, typeBytes.Length, data.Length);
            output.Write(body, 0, body.Length);
            byte[] crc = new byte[4];
            WriteUInt32(crc, 0, Crc32(body, 0, body.Length));
            output.Write(crc, 0, 4);
        }

        private static void WriteUInt32(byte[] target, int offset, uint value)
        {
            target[offset] = (byte)(value >> 24);
            target[offset + 1] = (byte)(value >> 16);
            target[offset + 2] = (byte)(value >> 8);
            target[offset + 3] = (byte)value;
        }

        private static uint[] BuildCrcTable()
        {
            uint[] table = new uint[256];
            for (uint n = 0; n < 256; n++)
            {
                uint c = n;
                for (int k = 0; k < 8; k++)
                {
                    c = (c & 1) != 0 ? 0xedb88320 ^ (c >> 1) : c >> 1;
                }

                table[n] = c;
            }

            return table;
        }
    }
}
