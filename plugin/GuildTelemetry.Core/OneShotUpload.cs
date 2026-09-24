using System;
using System.Collections.Generic;
using System.Globalization;

namespace GuildTelemetry.Core
{
    public enum UploadOutcome
    {
        Stored,
        Refused,
        GaveUp
    }

    public sealed class OneShotUpload
    {
        public const int Attempts = 10;
        public const int RetryMs = 30_000;
        public const int TimeoutMs = 60_000;

        private static readonly DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        private readonly ITelemetryTransport transport;
        private readonly Action<int> sleep;
        private readonly Func<DateTime> utcNow;

        public OneShotUpload(ITelemetryTransport transport, Action<int> sleep, Func<DateTime> utcNow)
        {
            this.transport = transport;
            this.sleep = sleep;
            this.utcNow = utcNow;
        }

        public UploadOutcome Send(string url, string secret, byte[] body, string contentType, Action<string> report)
        {
            RequestSigner signer = new RequestSigner(secret);
            string digest = RequestSigner.Sha256Hex(body);
            for (int attempt = 1; attempt <= Attempts; attempt++)
            {
                long unix = (long)(utcNow() - Epoch).TotalSeconds;
                Dictionary<string, string> headers = new Dictionary<string, string>
                {
                    { RequestSigner.TimestampHeader, unix.ToString(CultureInfo.InvariantCulture) },
                    { RequestSigner.SignatureHeader, signer.Sign(unix, digest) }
                };
                SendResult result = transport.Post(url, body, contentType, headers, TimeoutMs);
                if (result.StatusCode >= 200 && result.StatusCode < 300)
                {
                    return UploadOutcome.Stored;
                }

                if (result.StatusCode == 401 || result.StatusCode == 413 || result.StatusCode == 422)
                {
                    report("refused (HTTP " + result.StatusCode + "): " + result.Error);
                    return UploadOutcome.Refused;
                }

                report("attempt " + attempt + " of " + Attempts + " failed (" + (result.Error ?? ("HTTP " + result.StatusCode)) + ")");
                if (attempt < Attempts)
                {
                    sleep(RetryMs);
                }
            }

            return UploadOutcome.GaveUp;
        }
    }
}
