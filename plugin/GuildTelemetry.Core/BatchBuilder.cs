using System.Collections.Generic;
using System.Text;

namespace GuildTelemetry.Core
{
    public sealed class Batch
    {
        public Batch(List<PendingEvent> events, byte[] body)
        {
            Events = events;
            Body = body;
        }

        public List<PendingEvent> Events { get; }

        public byte[] Body { get; }

        public PendingEvent Last => Events[Events.Count - 1];
    }

    public static class BatchBuilder
    {
        public const int MaxEvents = 200;
        public const int MaxBodyBytes = 512 * 1024;
        public const int FlushEventCount = 50;

        public static Batch Build(BatchMetadata metadata, IList<PendingEvent> pending, int maxEvents = MaxEvents, int maxBodyBytes = MaxBodyBytes)
        {
            string prefix = Prefix(metadata);
            int budget = maxBodyBytes - Encoding.UTF8.GetByteCount(prefix) - 2;
            List<PendingEvent> chosen = new List<PendingEvent>();
            int used = 0;
            foreach (PendingEvent candidate in pending)
            {
                if (chosen.Count >= maxEvents)
                {
                    break;
                }

                int size = Encoding.UTF8.GetByteCount(candidate.Json) + (chosen.Count > 0 ? 1 : 0);
                if (chosen.Count > 0 && used + size > budget)
                {
                    break;
                }

                chosen.Add(candidate);
                used += size;
            }

            StringBuilder builder = new StringBuilder(prefix.Length + used + 2);
            builder.Append(prefix);
            for (int i = 0; i < chosen.Count; i++)
            {
                if (i > 0)
                {
                    builder.Append(',');
                }

                builder.Append(chosen[i].Json);
            }

            builder.Append("]}");
            return new Batch(chosen, Encoding.UTF8.GetBytes(builder.ToString()));
        }

        public static string Prefix(BatchMetadata metadata)
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Name("plugin").BeginObject()
                    .Property("name", metadata.PluginName)
                    .Property("version", metadata.PluginVersion)
                .EndObject()
                .Name("game").BeginObject()
                    .Property("version", metadata.GameVersion)
                    .Property("network_version", metadata.NetworkVersion)
                .EndObject()
                .Name("server").BeginObject()
                    .Property("name", metadata.ServerName)
                    .Property("world", metadata.WorldName)
                    .Property("world_uid", metadata.WorldUid)
                .EndObject()
                .Name("events");
            string text = writer.ToString();
            return text + "[";
        }
    }
}
