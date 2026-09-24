using System;
using System.Collections.Generic;
using System.Text;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class BatchAndRetryTests
    {
        private static readonly BatchMetadata Metadata = new BatchMetadata("GuildTelemetry", "0.1.0", "1.0.7", 39, "Rig", "GuildRig", 42);

        private static List<PendingEvent> Events(int count, int payloadSize = 10)
        {
            List<PendingEvent> list = new List<PendingEvent>();
            for (int i = 1; i <= count; i++)
            {
                list.Add(new PendingEvent("run", i, "{\"seq\":" + i + ",\"p\":\"" + new string('z', payloadSize) + "\"}"));
            }

            return list;
        }

        [Fact]
        public void BuildsValidJsonInOrderWithTheEventLimit()
        {
            Batch batch = BatchBuilder.Build(Metadata, Events(250));

            Assert.Equal(200, batch.Events.Count);
            string body = Encoding.UTF8.GetString(batch.Body);
            Assert.StartsWith("{\"plugin\":{\"name\":\"GuildTelemetry\",\"version\":\"0.1.0\"},\"game\":{\"version\":\"1.0.7\",\"network_version\":39},\"server\":{\"name\":\"Rig\",\"world\":\"GuildRig\",\"world_uid\":42},\"events\":[{\"seq\":1,", body);
            Assert.EndsWith("]}", body);
            Assert.Equal(200, batch.Last.Seq);
        }

        [Fact]
        public void RespectsTheByteLimitAndAlwaysTakesOneEvent()
        {
            Batch batch = BatchBuilder.Build(Metadata, Events(40, 20_000), 200, 100_000);
            Assert.True(batch.Body.Length <= 100_000);
            Assert.True(batch.Events.Count >= 1 && batch.Events.Count < 40);

            Batch single = BatchBuilder.Build(Metadata, Events(1, 20_000), 200, 100);
            Assert.Single(single.Events);
        }

        [Fact]
        public void ClassifiesResponses()
        {
            Assert.Equal(SendOutcome.Accepted, RetryPolicy.Classify(200, false));
            Assert.Equal(SendOutcome.Unauthorized, RetryPolicy.Classify(401, false));
            Assert.Equal(SendOutcome.PayloadTooLarge, RetryPolicy.Classify(413, false));
            Assert.Equal(SendOutcome.Unprocessable, RetryPolicy.Classify(422, false));
            Assert.Equal(SendOutcome.ServerError, RetryPolicy.Classify(503, false));
            Assert.Equal(SendOutcome.NetworkError, RetryPolicy.Classify(0, true));
        }

        [Fact]
        public void BacksOffExponentiallyWithCaps()
        {
            Assert.Equal(1000, RetryPolicy.DelayMs(SendOutcome.NetworkError, 1));
            Assert.Equal(2000, RetryPolicy.DelayMs(SendOutcome.NetworkError, 2));
            Assert.Equal(32_000, RetryPolicy.DelayMs(SendOutcome.ServerError, 6));
            Assert.Equal(60_000, RetryPolicy.DelayMs(SendOutcome.ServerError, 7));
            Assert.Equal(60_000, RetryPolicy.DelayMs(SendOutcome.ServerError, 40));
            Assert.Equal(256_000, RetryPolicy.DelayMs(SendOutcome.Unauthorized, 9));
            Assert.Equal(300_000, RetryPolicy.DelayMs(SendOutcome.Unauthorized, 10));
        }

        [Fact]
        public void WritesEscapedJson()
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("text", "quote \" backslash \\ newline \n tab \t control \u0001")
                .Property("n", 1.5)
                .Property("i", 7)
                .Property("b", true)
                .PropertyNull("z")
                .StringArray("list", new[] { "a", "b" })
                .Name("nested").BeginObject().Property("k", "v").EndObject()
                .EndObject();

            Assert.Equal("{\"text\":\"quote \\\" backslash \\\\ newline \\n tab \\t control \\u0001\",\"n\":1.5,\"i\":7,\"b\":true,\"z\":null,\"list\":[\"a\",\"b\"],\"nested\":{\"k\":\"v\"}}", writer.ToString());
            Assert.Equal("2026-09-10T22:11:03.120Z", JsonWriter.Timestamp(new DateTime(2026, 9, 10, 22, 11, 3, 120, DateTimeKind.Utc)));
        }

        [Fact]
        public void SerializesTheEnvelope()
        {
            TelemetryEvent telemetryEvent = new TelemetryEvent("id-1", 42, "run-1", new DateTime(2026, 9, 10, 22, 11, 3, 120, DateTimeKind.Utc), "player.died", 143, "{\"x\":1}");
            Assert.Equal("{\"id\":\"id-1\",\"seq\":42,\"run_id\":\"run-1\",\"ts\":\"2026-09-10T22:11:03.120Z\",\"type\":\"player.died\",\"world_day\":143,\"data\":{\"x\":1}}", telemetryEvent.ToJson());
        }
    }
}
