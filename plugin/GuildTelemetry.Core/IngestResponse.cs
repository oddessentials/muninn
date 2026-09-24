using System.Collections.Generic;

namespace GuildTelemetry.Core
{
    public sealed class Announcement
    {
        public const string MessageKind = "message";
        public const string RestartKind = "restart";

        public Announcement(long id, string kind, string? text, double? restartInSeconds)
        {
            Id = id;
            Kind = kind;
            Text = text;
            RestartInSeconds = restartInSeconds;
        }

        public long Id { get; }

        public string Kind { get; }

        public string? Text { get; }

        public double? RestartInSeconds { get; }

        public bool IsRestart => Kind == RestartKind;
    }

    public sealed class IngestResponse
    {
        public IngestResponse(int accepted, int duplicates, long? lastSeq, List<Announcement> announcements)
        {
            Accepted = accepted;
            Duplicates = duplicates;
            LastSeq = lastSeq;
            Announcements = announcements;
        }

        public int Accepted { get; }

        public int Duplicates { get; }

        public long? LastSeq { get; }

        public List<Announcement> Announcements { get; }

        public static IngestResponse? Parse(string? json)
        {
            if (string.IsNullOrEmpty(json))
            {
                return null;
            }

            Dictionary<string, object?>? record = JsonReader.AsObject(JsonReader.Parse(json!));
            if (record == null)
            {
                return null;
            }

            List<Announcement> announcements = new List<Announcement>();
            foreach (object? entry in JsonReader.GetList(record, "announcements"))
            {
                Dictionary<string, object?>? item = JsonReader.AsObject(entry);
                if (item == null)
                {
                    continue;
                }

                double? id = JsonReader.GetNumber(item, "id");
                string? kind = JsonReader.GetString(item, "kind");
                if (id == null || kind == null)
                {
                    continue;
                }

                announcements.Add(new Announcement((long)id.Value, kind, JsonReader.GetString(item, "text"), JsonReader.GetNumber(item, "restart_in_s")));
            }

            double? lastSeq = JsonReader.GetNumber(record, "last_seq");
            return new IngestResponse(
                (int)(JsonReader.GetNumber(record, "accepted") ?? 0),
                (int)(JsonReader.GetNumber(record, "duplicates") ?? 0),
                lastSeq == null ? (long?)null : (long)lastSeq.Value,
                announcements);
        }
    }
}
