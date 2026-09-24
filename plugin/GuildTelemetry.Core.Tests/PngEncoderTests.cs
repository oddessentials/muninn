using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class PngEncoderTests
    {
        private static uint ReadUInt32(byte[] data, int offset)
        {
            return ((uint)data[offset] << 24) | ((uint)data[offset + 1] << 16) | ((uint)data[offset + 2] << 8) | data[offset + 3];
        }

        [Fact]
        public void EncodesAnIndexedImageWithValidChunksAndPixels()
        {
            byte[] pixels = new byte[4 * 3];
            for (int i = 0; i < pixels.Length; i++)
            {
                pixels[i] = (byte)(i % 3);
            }

            byte[][] palette = { new byte[] { 10, 20, 30 }, new byte[] { 40, 50, 60 }, new byte[] { 70, 80, 90 } };
            byte[] png = PngEncoder.EncodeIndexed(4, 3, pixels, palette);

            Assert.Equal(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }, png.Take(8).ToArray());
            Assert.Equal(4u, ReadUInt32(png, 16));
            Assert.Equal(3u, ReadUInt32(png, 20));
            Assert.Equal(8, png[24]);
            Assert.Equal(3, png[25]);

            int offset = 8;
            byte[] idat = Array.Empty<byte>();
            byte[] plte = Array.Empty<byte>();
            string lastType = string.Empty;
            while (offset < png.Length)
            {
                int length = (int)ReadUInt32(png, offset);
                string type = System.Text.Encoding.ASCII.GetString(png, offset + 4, 4);
                uint expected = PngEncoder.Crc32(png, offset + 4, length + 4);
                Assert.Equal(expected, ReadUInt32(png, offset + 8 + length));
                byte[] data = new byte[length];
                Buffer.BlockCopy(png, offset + 8, data, 0, length);
                if (type == "IDAT")
                {
                    idat = data;
                }

                if (type == "PLTE")
                {
                    plte = data;
                }

                lastType = type;
                offset += 12 + length;
            }

            Assert.Equal("IEND", lastType);
            Assert.Equal(new byte[] { 10, 20, 30, 40, 50, 60, 70, 80, 90 }, plte);
            Assert.Equal(0x78, idat[0]);
            Assert.Equal(0x9c, idat[1]);
            byte[] raw;
            using (MemoryStream compressed = new MemoryStream(idat, 2, idat.Length - 6))
            using (DeflateStream inflate = new DeflateStream(compressed, CompressionMode.Decompress))
            using (MemoryStream output = new MemoryStream())
            {
                inflate.CopyTo(output);
                raw = output.ToArray();
            }

            Assert.Equal((4 + 1) * 3, raw.Length);
            for (int y = 0; y < 3; y++)
            {
                Assert.Equal(0, raw[y * 5]);
                for (int x = 0; x < 4; x++)
                {
                    Assert.Equal(pixels[y * 4 + x], raw[y * 5 + 1 + x]);
                }
            }

            Assert.Equal(PngEncoder.Adler32(raw), ReadUInt32(idat, idat.Length - 4));
        }

        [Fact]
        public void RejectsMismatchedBuffers()
        {
            Assert.Throws<ArgumentException>(() => PngEncoder.EncodeIndexed(2, 2, new byte[3], new[] { new byte[] { 0, 0, 0 } }));
            Assert.Throws<ArgumentException>(() => PngEncoder.EncodeIndexed(1, 1, new byte[1], new byte[0][]));
        }

        [Fact]
        public void ComputesKnownChecksums()
        {
            byte[] abc = System.Text.Encoding.ASCII.GetBytes("abc");
            Assert.Equal(0x352441c2u, PngEncoder.Crc32(abc, 0, abc.Length));
            Assert.Equal(0x024d0127u, PngEncoder.Adler32(abc));
        }
    }
}
