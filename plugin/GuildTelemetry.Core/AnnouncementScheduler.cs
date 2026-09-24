using System;
using System.Collections.Generic;
using System.Globalization;

namespace GuildTelemetry.Core
{
    public sealed class Banner
    {
        public Banner(long announcementId, string kind, string text, int? remainingSeconds, bool final)
        {
            AnnouncementId = announcementId;
            Kind = kind;
            Text = text;
            RemainingSeconds = remainingSeconds;
            Final = final;
        }

        public long AnnouncementId { get; }

        public string Kind { get; }

        public string Text { get; }

        public int? RemainingSeconds { get; }

        public bool Final { get; }
    }

    public sealed class AnnouncementScheduler
    {
        public static readonly int[] StageMinutes = { 15, 10, 5, 1 };
        public const double StageToleranceSeconds = 45;
        public const double MaxRememberedMessages = 1000;

        private sealed class RestartState
        {
            public RestartState(string? note, double dueAt)
            {
                Note = note;
                DueAt = dueAt;
            }

            public string? Note { get; }

            public double DueAt { get; set; }

            public bool Announced { get; set; }

            public HashSet<int> FiredStages { get; } = new HashSet<int>();
        }

        private readonly HashSet<long> shownMessages = new HashSet<long>();
        private readonly List<Announcement> pendingMessages = new List<Announcement>();
        private readonly SortedDictionary<long, RestartState> restarts = new SortedDictionary<long, RestartState>();

        public int PendingMessages => pendingMessages.Count;

        public int ActiveRestarts => restarts.Count;

        public void Apply(IList<Announcement> active, double now)
        {
            pendingMessages.Clear();
            HashSet<long> seenRestarts = new HashSet<long>();
            foreach (Announcement announcement in active)
            {
                if (announcement.IsRestart)
                {
                    if (announcement.RestartInSeconds == null)
                    {
                        continue;
                    }

                    double dueAt = now + announcement.RestartInSeconds.Value;
                    RestartState? state;
                    if (restarts.TryGetValue(announcement.Id, out state))
                    {
                        state!.DueAt = dueAt;
                        seenRestarts.Add(announcement.Id);
                    }
                    else if (announcement.RestartInSeconds.Value >= 0)
                    {
                        restarts[announcement.Id] = new RestartState(announcement.Text, dueAt);
                        seenRestarts.Add(announcement.Id);
                    }

                    continue;
                }

                if (announcement.Kind == Announcement.MessageKind && !shownMessages.Contains(announcement.Id) && !string.IsNullOrEmpty(announcement.Text))
                {
                    pendingMessages.Add(announcement);
                }
            }

            List<long> dropped = new List<long>();
            foreach (long id in restarts.Keys)
            {
                if (!seenRestarts.Contains(id))
                {
                    dropped.Add(id);
                }
            }

            foreach (long id in dropped)
            {
                restarts.Remove(id);
            }
        }

        public List<Banner> Due(double now)
        {
            List<Banner> banners = new List<Banner>();
            foreach (Announcement message in pendingMessages)
            {
                shownMessages.Add(message.Id);
                banners.Add(new Banner(message.Id, Announcement.MessageKind, message.Text!, null, true));
            }

            pendingMessages.Clear();
            if (shownMessages.Count > MaxRememberedMessages)
            {
                shownMessages.Clear();
            }

            List<long> finished = new List<long>();
            foreach (KeyValuePair<long, RestartState> entry in restarts)
            {
                Banner? banner = NextRestartBanner(entry.Key, entry.Value, now);
                if (banner == null)
                {
                    continue;
                }

                banners.Add(banner);
                if (banner.Final)
                {
                    finished.Add(entry.Key);
                }
            }

            foreach (long id in finished)
            {
                restarts.Remove(id);
            }

            return banners;
        }

        private static Banner? NextRestartBanner(long id, RestartState state, double now)
        {
            double remaining = state.DueAt - now;
            int remainingSeconds = (int)Math.Max(0, Math.Round(remaining));
            if (remaining <= 0)
            {
                return new Banner(id, Announcement.RestartKind, WithNote("Server restarting now", state.Note), 0, true);
            }

            if (!state.Announced)
            {
                state.Announced = true;
                foreach (int stage in StageMinutes)
                {
                    if (stage * 60 >= remaining - StageToleranceSeconds)
                    {
                        state.FiredStages.Add(stage);
                    }
                }

                return new Banner(id, Announcement.RestartKind, WithNote(Describe(remaining), state.Note), remainingSeconds, false);
            }

            foreach (int stage in StageMinutes)
            {
                if (state.FiredStages.Contains(stage))
                {
                    continue;
                }

                if (remaining > stage * 60)
                {
                    break;
                }

                foreach (int consumed in StageMinutes)
                {
                    if (consumed >= stage)
                    {
                        state.FiredStages.Add(consumed);
                    }
                }

                return new Banner(id, Announcement.RestartKind, WithNote(InMinutes(stage), state.Note), remainingSeconds, false);
            }

            return null;
        }

        public static string Describe(double remainingSeconds)
        {
            if (remainingSeconds <= 0)
            {
                return "Server restarting now";
            }

            if (remainingSeconds < 60)
            {
                return "Server restart in less than a minute";
            }

            return InMinutes(Math.Max(1, (int)Math.Round(remainingSeconds / 60.0, MidpointRounding.AwayFromZero)));
        }

        private static string InMinutes(int minutes)
        {
            return "Server restart in " + minutes.ToString(CultureInfo.InvariantCulture) + " min";
        }

        private static string WithNote(string text, string? note)
        {
            return string.IsNullOrEmpty(note) ? text : text + ": " + note;
        }
    }
}
