using System;
using System.Collections.Generic;
using System.Linq;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class JsonReaderTests
    {
        [Fact]
        public void ParsesNestedDocumentsWithEscapesAndNumbers()
        {
            object? value = JsonReader.Parse("{\"a\":[1,2.5,-3e2,true,false,null],\"b\":{\"c\":\"q\\\"\\u00e9\\n\"},\"d\":\"\"}");
            Dictionary<string, object?>? record = JsonReader.AsObject(value);
            Assert.NotNull(record);
            List<object?> list = JsonReader.GetList(record!, "a");
            Assert.Equal(new object?[] { 1d, 2.5d, -300d, true, false, null }, list.ToArray());
            Dictionary<string, object?>? inner = JsonReader.AsObject(record!["b"]);
            Assert.Equal("q\"é\n", JsonReader.GetString(inner!, "c"));
            Assert.Equal(string.Empty, JsonReader.GetString(record!, "d"));
            Assert.Null(JsonReader.GetNumber(record!, "missing"));
            Assert.Null(JsonReader.GetString(record!, "a"));
        }

        [Theory]
        [InlineData("{")]
        [InlineData("[1,]")]
        [InlineData("{\"a\":1,}")]
        [InlineData("\"unterminated")]
        [InlineData("{\"a\":1} x")]
        [InlineData("tru")]
        public void RejectsMalformedText(string text)
        {
            Assert.Throws<FormatException>(() => JsonReader.Parse(text));
        }
    }

    public sealed class IngestResponseTests
    {
        [Fact]
        public void ReadsCountsAndAnnouncements()
        {
            IngestResponse? response = IngestResponse.Parse("{\"accepted\":3,\"duplicates\":1,\"last_seq\":42,\"announcements\":[{\"id\":7,\"kind\":\"message\",\"text\":\"Hello\",\"restart_at\":null,\"restart_in_s\":null},{\"id\":8,\"kind\":\"restart\",\"text\":null,\"restart_at\":\"2026-09-12T20:00:00.000Z\",\"restart_in_s\":870.5},{\"kind\":\"message\"}]}");
            Assert.NotNull(response);
            Assert.Equal(3, response!.Accepted);
            Assert.Equal(1, response.Duplicates);
            Assert.Equal(42L, response.LastSeq);
            Assert.Equal(2, response.Announcements.Count);
            Assert.Equal(7L, response.Announcements[0].Id);
            Assert.Equal("Hello", response.Announcements[0].Text);
            Assert.False(response.Announcements[0].IsRestart);
            Assert.Null(response.Announcements[0].RestartInSeconds);
            Assert.True(response.Announcements[1].IsRestart);
            Assert.Equal(870.5, response.Announcements[1].RestartInSeconds);
        }

        [Fact]
        public void ToleratesOlderResponsesAndEmptyBodies()
        {
            IngestResponse? legacy = IngestResponse.Parse("{\"accepted\":1,\"duplicates\":0,\"last_seq\":null}");
            Assert.NotNull(legacy);
            Assert.Empty(legacy!.Announcements);
            Assert.Null(legacy.LastSeq);
            Assert.Null(IngestResponse.Parse(null));
            Assert.Null(IngestResponse.Parse(string.Empty));
            Assert.Null(IngestResponse.Parse("[1,2]"));
        }
    }

    public sealed class PipelineResponseTests : IDisposable
    {
        private sealed class AnsweringTransport : ITelemetryTransport
        {
            public string Body = "{\"accepted\":1,\"duplicates\":0,\"last_seq\":1,\"announcements\":[{\"id\":3,\"kind\":\"message\",\"text\":\"Hi\",\"restart_at\":null,\"restart_in_s\":null}]}";

            public SendResult Post(string url, byte[] body, string contentType, IDictionary<string, string> headers, int timeoutMs)
            {
                return new SendResult(200, null, Body);
            }
        }

        private readonly string directory = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "guild-telemetry-tests", Guid.NewGuid().ToString("N"));

        public void Dispose()
        {
            if (System.IO.Directory.Exists(directory))
            {
                System.IO.Directory.Delete(directory, true);
            }
        }

        [Fact]
        public void KeepsTheLatestParsedResponseForTheMainThread()
        {
            AnsweringTransport transport = new AnsweringTransport();
            PipelineOptions options = new PipelineOptions { Url = "http://web/api/ingest", Secret = "secret", FlushIntervalMs = 20, RequestTimeoutMs = 1000 };
            BatchMetadata metadata = new BatchMetadata("GuildTelemetry", "0.3.0", "1.0.12", 40, "Rig", "GuildRig", 42);
            using (TelemetryPipeline pipeline = new TelemetryPipeline(options, metadata, new EventJournal(directory), transport, _ => { }))
            {
                Assert.Null(pipeline.TakeResponse());
                pipeline.Enqueue(new TelemetryEvent(Guid.NewGuid().ToString(), 1, "run-1", DateTime.UtcNow, "world.saved", 3, "{\"duration_ms\":1}"));
                pipeline.Start();
                DateTime deadline = DateTime.UtcNow.AddSeconds(5);
                IngestResponse? response = null;
                while (response == null && DateTime.UtcNow < deadline)
                {
                    response = pipeline.TakeResponse();
                    System.Threading.Thread.Sleep(10);
                }

                Assert.NotNull(response);
                Assert.Equal(1, response!.Accepted);
                Assert.Equal(3L, Assert.Single(response.Announcements).Id);
                Assert.Null(pipeline.TakeResponse());
            }
        }
    }

    public sealed class AnnouncementSchedulerTests
    {
        private static Announcement Message(long id, string text)
        {
            return new Announcement(id, Announcement.MessageKind, text, null);
        }

        private static Announcement Restart(long id, double inSeconds, string? note = null)
        {
            return new Announcement(id, Announcement.RestartKind, note, inSeconds);
        }

        private static List<Banner> Tick(AnnouncementScheduler scheduler, double now)
        {
            return scheduler.Due(now);
        }

        [Fact]
        public void ShowsEachMessageOnceEvenWhenItKeepsArriving()
        {
            AnnouncementScheduler scheduler = new AnnouncementScheduler();
            scheduler.Apply(new[] { Message(1, "Hello") }, 100);
            List<Banner> first = Tick(scheduler, 100);
            Banner banner = Assert.Single(first);
            Assert.Equal(1L, banner.AnnouncementId);
            Assert.Equal("Hello", banner.Text);
            Assert.True(banner.Final);
            Assert.Null(banner.RemainingSeconds);

            scheduler.Apply(new[] { Message(1, "Hello"), Message(2, "Again") }, 102);
            List<Banner> second = Tick(scheduler, 102);
            Assert.Equal(new[] { 2L }, second.Select(entry => entry.AnnouncementId).ToArray());
            Assert.Empty(Tick(scheduler, 103));
        }

        [Fact]
        public void CountsARestartDownThroughTheStagesToTheFinalBanner()
        {
            AnnouncementScheduler scheduler = new AnnouncementScheduler();
            scheduler.Apply(new[] { Restart(5, 898) }, 1000);
            List<string> texts = new List<string>();
            List<Banner> all = new List<Banner>();
            for (double now = 1000; now <= 1900; now += 1)
            {
                foreach (Banner banner in Tick(scheduler, now))
                {
                    texts.Add(banner.Text + "@" + (now - 1000));
                    all.Add(banner);
                }
            }

            Assert.Equal(
                new[]
                {
                    "Server restart in 15 min@0",
                    "Server restart in 10 min@298",
                    "Server restart in 5 min@598",
                    "Server restart in 1 min@838",
                    "Server restarting now@898"
                },
                texts.ToArray());
            Assert.Equal(new int?[] { 898, 600, 300, 60, 0 }, all.Select(banner => banner.RemainingSeconds).ToArray());
            Assert.Equal(new[] { false, false, false, false, true }, all.Select(banner => banner.Final).ToArray());
            Assert.Equal(0, scheduler.ActiveRestarts);
            Assert.Empty(Tick(scheduler, 2000));
        }

        [Fact]
        public void ALateRestartSkipsTheStagesAlreadyPassed()
        {
            AnnouncementScheduler scheduler = new AnnouncementScheduler();
            scheduler.Apply(new[] { Restart(6, 425, "patch day") }, 0);
            List<string> texts = new List<string>();
            for (double now = 0; now <= 430; now += 1)
            {
                foreach (Banner banner in Tick(scheduler, now))
                {
                    texts.Add(banner.Text + "@" + now);
                }
            }

            Assert.Equal(
                new[]
                {
                    "Server restart in 7 min: patch day@0",
                    "Server restart in 5 min: patch day@125",
                    "Server restart in 1 min: patch day@365",
                    "Server restarting now: patch day@425"
                },
                texts.ToArray());
        }

        [Fact]
        public void ResyncsTheTimeAndDropsCancelledRestarts()
        {
            AnnouncementScheduler scheduler = new AnnouncementScheduler();
            scheduler.Apply(new[] { Restart(9, 900) }, 0);
            Assert.Single(Tick(scheduler, 0));
            scheduler.Apply(new[] { Restart(9, 700) }, 100);
            Assert.Empty(Tick(scheduler, 100));
            Banner tenMinutes = Assert.Single(Tick(scheduler, 200));
            Assert.Equal("Server restart in 10 min", tenMinutes.Text);
            Assert.Equal(600, tenMinutes.RemainingSeconds);

            scheduler.Apply(new Announcement[0], 300);
            Assert.Equal(0, scheduler.ActiveRestarts);
            Assert.Empty(Tick(scheduler, 800));
            Assert.Empty(Tick(scheduler, 900));
        }

        [Fact]
        public void IgnoresRestartsAlreadyInThePastAndEntriesWithoutATime()
        {
            AnnouncementScheduler scheduler = new AnnouncementScheduler();
            scheduler.Apply(new[] { Restart(3, -30), new Announcement(4, Announcement.RestartKind, null, null), Message(5, string.Empty) }, 0);
            Assert.Equal(0, scheduler.ActiveRestarts);
            Assert.Empty(Tick(scheduler, 0));
        }

        [Fact]
        public void DescribesShortLeadTimes()
        {
            Assert.Equal("Server restart in less than a minute", AnnouncementScheduler.Describe(45));
            Assert.Equal("Server restart in 1 min", AnnouncementScheduler.Describe(80));
            Assert.Equal("Server restart in 2 min", AnnouncementScheduler.Describe(90));
            Assert.Equal("Server restarting now", AnnouncementScheduler.Describe(0));
            AnnouncementScheduler scheduler = new AnnouncementScheduler();
            scheduler.Apply(new[] { Restart(7, 30) }, 0);
            Banner banner = Assert.Single(Tick(scheduler, 0));
            Assert.Equal("Server restart in less than a minute", banner.Text);
            Assert.Equal(30, banner.RemainingSeconds);
            Banner final = Assert.Single(Tick(scheduler, 30));
            Assert.True(final.Final);
        }
    }
}
