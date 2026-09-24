using System;
using System.Security.Cryptography;
using System.Text;

namespace GuildTelemetry.Core
{
    public sealed class RequestSigner
    {
        public const string SignaturePrefix = "sha256=";
        public const string TimestampHeader = "X-Telemetry-Timestamp";
        public const string SignatureHeader = "X-Telemetry-Signature";

        private readonly byte[] key;

        public RequestSigner(string secret)
        {
            if (string.IsNullOrEmpty(secret))
            {
                throw new ArgumentException("The telemetry secret must not be empty.", nameof(secret));
            }

            key = Encoding.UTF8.GetBytes(secret);
        }

        public string Sign(long unixTimestamp, byte[] body)
        {
            if (body == null)
            {
                throw new ArgumentNullException(nameof(body));
            }

            byte[] prefix = Encoding.UTF8.GetBytes(unixTimestamp.ToString(System.Globalization.CultureInfo.InvariantCulture) + ".");
            byte[] message = new byte[prefix.Length + body.Length];
            Buffer.BlockCopy(prefix, 0, message, 0, prefix.Length);
            Buffer.BlockCopy(body, 0, message, prefix.Length, body.Length);
            using (HMACSHA256 hmac = new HMACSHA256(key))
            {
                return SignaturePrefix + ToHex(hmac.ComputeHash(message));
            }
        }

        public string Sign(long unixTimestamp, string body)
        {
            return Sign(unixTimestamp, Encoding.UTF8.GetBytes(body ?? string.Empty));
        }

        public static string Sha256Hex(byte[] body)
        {
            using (SHA256 sha = SHA256.Create())
            {
                return ToHex(sha.ComputeHash(body));
            }
        }

        private static string ToHex(byte[] bytes)
        {
            StringBuilder builder = new StringBuilder(bytes.Length * 2);
            foreach (byte value in bytes)
            {
                builder.Append(value.ToString("x2", System.Globalization.CultureInfo.InvariantCulture));
            }

            return builder.ToString();
        }
    }
}
