using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class PipelineTests : IDisposable
    {
        private sealed class FakeTransport : ITelemetryTransport
        {
            private readonly object gate = new object();
            public readonly List<string> Bodies = new List<string>();
            public readonly List<IDictionary<string, string>> Headers = new List<IDictionary<string, string>>();
            public Func<int, int> StatusFor = _ => 200;

            public SendResult Post(string url, byte[] body, string contentType, IDictionary<string, string> headers, int timeoutMs)
            {
                lock (gate)
                {
                    Bodies.Add(Encoding.UTF8.GetString(body));
                    Headers.Add(new Dictionary<string, string>(headers));
                    int status = StatusFor(Bodies.Count);
                    return status == 0 ? new SendResult(0, "connection refused") : new SendResult(status, status >= 400 ? "error" : null);
                }
            }

            public int Count
            {
                get
                {
                    lock (gate)
                    {
                        return Bodies.Count;
                    }
                }
            }
        }

        private readonly string directory = Path.Combine(Path.GetTempPath(), "guild-telemetry-tests", Guid.NewGuid().ToString("N"));
        private static readonly BatchMetadata Metadata = new BatchMetadata("GuildTelemetry", "0.1.0", "1.0.7", 39, "Rig", "GuildRig", 42);

        public void Dispose()
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
        }

        private static TelemetryEvent Event(long seq, string runId = "run-1")
        {
            return new TelemetryEvent(Guid.NewGuid().ToString(), seq, runId, DateTime.UtcNow, "world.saved", 3, "{\"duration_ms\":" + seq + "}");
        }

        private TelemetryPipeline Create(FakeTransport transport, EventJournal journal, int flushMs = 20)
        {
            PipelineOptions options = new PipelineOptions { Url = "http://web/api/ingest", Secret = "secret", FlushIntervalMs = flushMs, RequestTimeoutMs = 1000 };
            return new TelemetryPipeline(options, Metadata, journal, transport, _ => { });
        }

        private static void WaitUntil(Func<bool> condition, int timeoutMs = 5000)
        {
            DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (!condition() && DateTime.UtcNow < deadline)
            {
                Thread.Sleep(10);
            }

            Assert.True(condition());
        }

        [Fact]
        public void SendsSignedBatchesInOrderAndAcknowledgesTheJournal()
        {
            FakeTransport transport = new FakeTransport();
            EventJournal journal = new EventJournal(directory);
            using (TelemetryPipeline pipeline = Create(transport, journal))
            {
                for (int i = 1; i <= 5; i++)
                {
                    pipeline.Enqueue(Event(i));
                }

                pipeline.Start();
                WaitUntil(() => transport.Count >= 1 && pipeline.QueueDepth == 0);
            }

            string body = transport.Bodies[0];
            Assert.Contains("\"seq\":1,", body);
            Assert.True(body.IndexOf("\"seq\":1,", StringComparison.Ordinal) < body.IndexOf("\"seq\":5,", StringComparison.Ordinal));
            Assert.StartsWith("sha256=", transport.Headers[0][RequestSigner.SignatureHeader]);
            Assert.Equal("run-1", journal.CursorRunId);
            Assert.Equal(5, journal.CursorSeq);
            Assert.Empty(new EventJournal(directory).LoadUnacknowledged());
        }

        [Fact]
        public void RetriesAfterServerErrorsWithoutReordering()
        {
            FakeTransport transport = new FakeTransport();
            transport.StatusFor = attempt => attempt == 1 ? 503 : 200;
            EventJournal journal = new EventJournal(directory);
            PipelineOptions options = new PipelineOptions { Url = "http://web/api/ingest", Secret = "secret", FlushIntervalMs = 20, RequestTimeoutMs = 1000 };
            DateTime now = DateTime.UtcNow;
            using (TelemetryPipeline pipeline = new TelemetryPipeline(options, Metadata, journal, transport, _ => { }, () => now))
            {
                pipeline.Start();
                pipeline.Enqueue(Event(1));
                WaitUntil(() => transport.Count == 1);
                Assert.Equal(1, pipeline.ConsecutiveFailures);
                Thread.Sleep(100);
                Assert.Equal(1, transport.Count);
                now = now.AddSeconds(2);
                WaitUntil(() => transport.Count == 2 && pipeline.QueueDepth == 0);
            }

            Assert.Equal(transport.Bodies[0], transport.Bodies[1]);
            Assert.Equal(1, journal.CursorSeq);
        }

        [Fact]
        public void SplitsBatchesOn413AndMovesUnprocessableOnesAside()
        {
            FakeTransport transport = new FakeTransport();
            transport.StatusFor = attempt => attempt == 1 ? 413 : attempt == 2 ? 422 : 200;
            EventJournal journal = new EventJournal(directory);
            using (TelemetryPipeline pipeline = Create(transport, journal))
            {
                for (int i = 1; i <= 4; i++)
                {
                    pipeline.Enqueue(Event(i));
                }

                pipeline.Start();
                WaitUntil(() => pipeline.QueueDepth == 0 && transport.Count >= 3);
            }

            Assert.Contains("\"seq\":4,", transport.Bodies[0]);
            Assert.DoesNotContain("\"seq\":3,", transport.Bodies[1]);
            Assert.Empty(journal.LoadUnacknowledged());
            string[] rejected = File.ReadAllLines(journal.RejectedPath);
            Assert.Equal(2, rejected.Length);
            Assert.Equal(4, journal.CursorSeq);
        }

        [Fact]
        public void ReplaysJournaledEventsBeforeNewOnes()
        {
            EventJournal seed = new EventJournal(directory);
            seed.Append(PendingEvent.From(Event(1, "run-old")));
            seed.Append(PendingEvent.From(Event(2, "run-old")));

            FakeTransport transport = new FakeTransport();
            using (TelemetryPipeline pipeline = Create(transport, new EventJournal(directory)))
            {
                pipeline.Start();
                pipeline.Enqueue(Event(1, "run-new"));
                WaitUntil(() => pipeline.QueueDepth == 0 && transport.Count >= 1);
            }

            string all = string.Join("|", transport.Bodies);
            Assert.True(all.IndexOf("run-old", StringComparison.Ordinal) < all.IndexOf("run-new", StringComparison.Ordinal));
        }

        [Fact]
        public void DropsEventsBeyondTheQueueCapacity()
        {
            FakeTransport transport = new FakeTransport();
            transport.StatusFor = _ => 0;
            PipelineOptions options = new PipelineOptions { Url = "http://web/api/ingest", Secret = "secret", FlushIntervalMs = 60_000, QueueCapacity = 3 };
            using (TelemetryPipeline pipeline = new TelemetryPipeline(options, Metadata, new EventJournal(directory), transport, _ => { }))
            {
                Assert.True(pipeline.Enqueue(Event(1)));
                Assert.True(pipeline.Enqueue(Event(2)));
                Assert.True(pipeline.Enqueue(Event(3)));
                Assert.False(pipeline.Enqueue(Event(4)));
                Assert.Equal(1, pipeline.DroppedEvents);
            }
        }

        [Fact]
        public void FlushSyncSendsEverythingWithinTheBudget()
        {
            FakeTransport transport = new FakeTransport();
            using (TelemetryPipeline pipeline = Create(transport, new EventJournal(directory), 60_000))
            {
                pipeline.Enqueue(Event(1));
                pipeline.Enqueue(Event(2));
                pipeline.FlushSync(1500);
            }

            Assert.Equal(1, transport.Count);
            Assert.Contains("\"seq\":2,", transport.Bodies[0]);
        }
    }
}
