using System;
using System.Text;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class RequestSignerTests
    {
        [Fact]
        public void SignsTimestampDotBodyWithHmacSha256()
        {
            RequestSigner signer = new RequestSigner("local-secret");

            string signature = signer.Sign(1757534400L, "{\"events\":[]}");

            Assert.Equal(
                "sha256=" + ExpectedHexFor("local-secret", "1757534400.{\"events\":[]}"),
                signature);
            Assert.StartsWith(RequestSigner.SignaturePrefix, signature);
            Assert.Equal(RequestSigner.SignaturePrefix.Length + 64, signature.Length);
        }

        [Fact]
        public void ByteAndStringOverloadsAgree()
        {
            RequestSigner signer = new RequestSigner("s");
            string body = "{\"seq\":1}";

            Assert.Equal(signer.Sign(42L, body), signer.Sign(42L, Encoding.UTF8.GetBytes(body)));
        }

        [Fact]
        public void RejectsAnEmptySecret()
        {
            Assert.Throws<ArgumentException>(() => new RequestSigner(string.Empty));
        }

        [Fact]
        public void HashesBodiesForTheMapUpload()
        {
            string hex = RequestSigner.Sha256Hex(Encoding.UTF8.GetBytes("abc"));

            Assert.Equal("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", hex);
        }

        private static string ExpectedHexFor(string secret, string message)
        {
            using (System.Security.Cryptography.HMACSHA256 hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secret)))
            {
                return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(message))).ToLowerInvariant();
            }
        }
    }
}
