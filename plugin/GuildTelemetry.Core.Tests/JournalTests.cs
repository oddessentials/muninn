using System;
using System.Collections.Generic;
using System.IO;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class JournalTests : IDisposable
    {
        private readonly string directory = Path.Combine(Path.GetTempPath(), "guild-telemetry-tests", Guid.NewGuid().ToString("N"));

        public void Dispose()
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
        }

        private static PendingEvent Pending(string runId, long seq)
        {
            return new PendingEvent(runId, seq, "{\"seq\":" + seq + "}");
        }

        [Fact]
        public void ReplaysOnlyLinesAfterTheCursor()
        {
            EventJournal journal = new EventJournal(directory);
            journal.Append(Pending("run-a", 1));
            journal.Append(Pending("run-a", 2));
            journal.Append(Pending("run-a", 3));
            journal.Acknowledge("run-a", 2);

            EventJournal reopened = new EventJournal(directory);
            List<PendingEvent> pending = reopened.LoadUnacknowledged();

            Assert.Single(pending);
            Assert.Equal(3, pending[0].Seq);
            Assert.Equal("{\"seq\":3}", pending[0].Json);
            Assert.Equal("run-a", reopened.CursorRunId);
            Assert.Equal(2, reopened.CursorSeq);
        }

        [Fact]
        public void TreatsEveryLineUpToTheCursorLineAsAcknowledgedWhateverItsRun()
        {
            EventJournal journal = new EventJournal(directory);
            journal.Append(Pending("run-a", 7));
            journal.Append(Pending("run-a", 8));
            journal.Append(Pending("run-b", 1));
            journal.Append(Pending("run-b", 2));
            journal.Append(Pending("run-c", 1));
            journal.Acknowledge("run-b", 2);

            List<PendingEvent> pending = new EventJournal(directory).LoadUnacknowledged();

            Assert.Single(pending);
            Assert.Equal("run-c", pending[0].RunId);
        }

        [Fact]
        public void CompactsToTheUnacknowledgedLinesWhenLoading()
        {
            EventJournal journal = new EventJournal(directory);
            journal.Append(Pending("run-a", 1));
            journal.Append(Pending("run-a", 2));
            journal.Append(Pending("run-b", 1));
            journal.Acknowledge("run-a", 2);

            EventJournal reopened = new EventJournal(directory);
            Assert.Single(reopened.LoadUnacknowledged());
            string[] lines = File.ReadAllLines(reopened.JournalPath);
            Assert.Single(lines);
            Assert.StartsWith("run-b\t1\t", lines[0]);

            reopened.Append(Pending("run-b", 2));
            List<PendingEvent> again = new EventJournal(directory).LoadUnacknowledged();
            Assert.Equal(2, again.Count);
            Assert.Equal(1, again[0].Seq);
            Assert.Equal(2, again[1].Seq);
        }

        [Fact]
        public void RewritesWhenFullyAcknowledgedAndLarge()
        {
            EventJournal journal = new EventJournal(directory);
            string padding = new string('x', 1024);
            for (int i = 1; i <= 11 * 1024; i++)
            {
                journal.Append(new PendingEvent("run-a", i, "{\"p\":\"" + padding + "\"}"));
            }

            Assert.False(journal.RewriteIfFullyAcknowledged());
            journal.Acknowledge("run-a", 11 * 1024);
            Assert.True(journal.RewriteIfFullyAcknowledged());
            Assert.Equal(0, new FileInfo(journal.JournalPath).Length);
            Assert.Empty(new EventJournal(directory).LoadUnacknowledged());
        }

        [Fact]
        public void DropsTheOldestLinesAtTheHardCap()
        {
            EventJournal journal = new EventJournal(directory, 8 * 1024);
            string padding = new string('y', 200);
            for (int i = 1; i <= 100; i++)
            {
                journal.Append(new PendingEvent("run-a", i, "{\"p\":\"" + padding + "\"}"));
            }

            Assert.True(new FileInfo(journal.JournalPath).Length <= 8 * 1024);
            Assert.True(journal.DroppedEvents > 0);
            List<PendingEvent> remaining = journal.LoadUnacknowledged();
            Assert.Equal(100, remaining[remaining.Count - 1].Seq);
            Assert.True(remaining.Count < 100);
        }

        [Fact]
        public void MovesRejectedEventsAside()
        {
            EventJournal journal = new EventJournal(directory);
            journal.Reject(new[] { Pending("run-a", 5) });

            string[] lines = File.ReadAllLines(journal.RejectedPath);
            Assert.Single(lines);
            Assert.StartsWith("run-a\t5\t", lines[0]);
        }

        [Fact]
        public void IgnoresCorruptLines()
        {
            Assert.Null(EventJournal.ParseLine("garbage"));
            Assert.Null(EventJournal.ParseLine("run\tnotanumber\t{}"));
            Assert.Null(EventJournal.ParseLine("run\t3\ttruncated"));
            PendingEvent? parsed = EventJournal.ParseLine("run\t3\t{\"a\":1}");
            Assert.NotNull(parsed);
            Assert.Equal(3, parsed!.Seq);
        }
    }
}
