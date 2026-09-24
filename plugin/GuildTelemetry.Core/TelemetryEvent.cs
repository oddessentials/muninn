using System;

namespace GuildTelemetry.Core
{
    public sealed class TelemetryEvent
    {
        public TelemetryEvent(string id, long seq, string runId, DateTime timestampUtc, string type, int worldDay, string dataJson)
        {
            Id = id;
            Seq = seq;
            RunId = runId;
            TimestampUtc = timestampUtc;
            Type = type;
            WorldDay = worldDay;
            DataJson = dataJson;
        }

        public string Id { get; }

        public long Seq { get; }

        public string RunId { get; }

        public DateTime TimestampUtc { get; }

        public string Type { get; }

        public int WorldDay { get; }

        public string DataJson { get; }

        public string ToJson()
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("id", Id)
                .Property("seq", Seq)
                .Property("run_id", RunId)
                .Property("ts", JsonWriter.Timestamp(TimestampUtc))
                .Property("type", Type)
                .Property("world_day", WorldDay)
                .PropertyRaw("data", DataJson)
                .EndObject();
            return writer.ToString();
        }
    }

    public sealed class PendingEvent
    {
        public PendingEvent(string runId, long seq, string json)
        {
            RunId = runId;
            Seq = seq;
            Json = json;
        }

        public string RunId { get; }

        public long Seq { get; }

        public string Json { get; }

        public static PendingEvent From(TelemetryEvent telemetryEvent)
        {
            return new PendingEvent(telemetryEvent.RunId, telemetryEvent.Seq, telemetryEvent.ToJson());
        }
    }

    public sealed class BatchMetadata
    {
        public BatchMetadata(string pluginName, string pluginVersion, string gameVersion, int networkVersion, string serverName, string worldName, long worldUid)
        {
            PluginName = pluginName;
            PluginVersion = pluginVersion;
            GameVersion = gameVersion;
            NetworkVersion = networkVersion;
            ServerName = serverName;
            WorldName = worldName;
            WorldUid = worldUid;
        }

        public string PluginName { get; }

        public string PluginVersion { get; }

        public string GameVersion { get; }

        public int NetworkVersion { get; }

        public string ServerName { get; }

        public string WorldName { get; }

        public long WorldUid { get; }
    }
}
