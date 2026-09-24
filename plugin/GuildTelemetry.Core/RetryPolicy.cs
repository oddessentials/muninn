using System;

namespace GuildTelemetry.Core
{
    public enum SendOutcome
    {
        Accepted,
        Unauthorized,
        PayloadTooLarge,
        Unprocessable,
        ServerError,
        NetworkError
    }

    public static class RetryPolicy
    {
        public const int MinDelayMs = 1000;
        public const int MaxDelayMs = 60_000;
        public const int UnauthorizedMaxDelayMs = 300_000;

        public static SendOutcome Classify(int statusCode, bool transportFailed)
        {
            if (transportFailed)
            {
                return SendOutcome.NetworkError;
            }

            if (statusCode >= 200 && statusCode < 300)
            {
                return SendOutcome.Accepted;
            }

            if (statusCode == 401 || statusCode == 403)
            {
                return SendOutcome.Unauthorized;
            }

            if (statusCode == 413)
            {
                return SendOutcome.PayloadTooLarge;
            }

            if (statusCode == 422 || statusCode == 400)
            {
                return SendOutcome.Unprocessable;
            }

            return SendOutcome.ServerError;
        }

        public static int DelayMs(SendOutcome outcome, int consecutiveFailures)
        {
            int exponent = Math.Max(0, Math.Min(consecutiveFailures - 1, 20));
            long delay = (long)MinDelayMs << exponent;
            int cap = outcome == SendOutcome.Unauthorized ? UnauthorizedMaxDelayMs : MaxDelayMs;
            if (delay > cap)
            {
                delay = cap;
            }

            return (int)delay;
        }
    }
}
