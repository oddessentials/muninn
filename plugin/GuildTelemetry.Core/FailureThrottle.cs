using System.Collections.Generic;

namespace GuildTelemetry.Core
{
    public sealed class FailureThrottle
    {
        private sealed class Entry
        {
            public double LastReportAt;
            public int Suppressed;
        }

        private readonly double intervalSeconds;
        private readonly Dictionary<string, Entry> entries = new Dictionary<string, Entry>();

        public FailureThrottle(double intervalSeconds)
        {
            this.intervalSeconds = intervalSeconds;
        }

        public bool Admit(string key, double now, out int suppressed)
        {
            Entry entry;
            if (!entries.TryGetValue(key, out entry))
            {
                entries[key] = new Entry { LastReportAt = now };
                suppressed = 0;
                return true;
            }

            if (now - entry.LastReportAt < intervalSeconds)
            {
                entry.Suppressed++;
                suppressed = 0;
                return false;
            }

            suppressed = entry.Suppressed;
            entry.Suppressed = 0;
            entry.LastReportAt = now;
            return true;
        }
    }
}
