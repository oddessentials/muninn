using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace GuildTelemetry.Core
{
    public sealed class EventJournal
    {
        public const string JournalFileName = "journal.jsonl";
        public const string CursorFileName = "journal.cursor";
        public const string RejectedFileName = "journal-rejected.jsonl";
        public const long RewriteThresholdBytes = 10L * 1024 * 1024;

        private readonly object gate = new object();
        private readonly string directory;
        private readonly long hardCapBytes;
        private long droppedEvents;
        private string? cursorRunId;
        private long cursorSeq = -1;

        public EventJournal(string directory, long hardCapBytes = 50L * 1024 * 1024)
        {
            this.directory = directory;
            this.hardCapBytes = hardCapBytes;
            Directory.CreateDirectory(directory);
            LoadCursor();
        }

        public string JournalPath => Path.Combine(directory, JournalFileName);

        public string CursorPath => Path.Combine(directory, CursorFileName);

        public string RejectedPath => Path.Combine(directory, RejectedFileName);

        public long DroppedEvents => droppedEvents;

        public string? CursorRunId => cursorRunId;

        public long CursorSeq => cursorSeq;

        public void Append(PendingEvent pending)
        {
            lock (gate)
            {
                EnforceCap(pending.Json.Length + 64);
                using (StreamWriter writer = new StreamWriter(JournalPath, true, new UTF8Encoding(false)))
                {
                    writer.Write(pending.RunId);
                    writer.Write('\t');
                    writer.Write(pending.Seq.ToString(CultureInfo.InvariantCulture));
                    writer.Write('\t');
                    writer.Write(pending.Json);
                    writer.Write('\n');
                }
            }
        }

        public List<PendingEvent> LoadUnacknowledged()
        {
            lock (gate)
            {
                List<PendingEvent> pending = new List<PendingEvent>();
                if (!File.Exists(JournalPath))
                {
                    return pending;
                }

                string[] lines = File.ReadAllLines(JournalPath, Encoding.UTF8);
                int cursor = CursorIndex(lines);
                for (int i = cursor + 1; i < lines.Length; i++)
                {
                    PendingEvent? parsed = ParseLine(lines[i]);
                    if (parsed != null)
                    {
                        pending.Add(parsed);
                    }
                }

                if (cursor >= 0)
                {
                    WriteLines(lines, cursor + 1);
                }

                return pending;
            }
        }

        public void Acknowledge(string runId, long seq)
        {
            lock (gate)
            {
                cursorRunId = runId;
                cursorSeq = seq;
                File.WriteAllText(CursorPath, runId + "\t" + seq.ToString(CultureInfo.InvariantCulture) + "\n", new UTF8Encoding(false));
            }
        }

        public bool RewriteIfFullyAcknowledged()
        {
            lock (gate)
            {
                if (!File.Exists(JournalPath))
                {
                    return false;
                }

                long size = new FileInfo(JournalPath).Length;
                if (size < RewriteThresholdBytes)
                {
                    return false;
                }

                string[] lines = File.ReadAllLines(JournalPath, Encoding.UTF8);
                int cursor = CursorIndex(lines);
                for (int i = cursor + 1; i < lines.Length; i++)
                {
                    if (ParseLine(lines[i]) != null)
                    {
                        return false;
                    }
                }

                File.WriteAllText(JournalPath, string.Empty, new UTF8Encoding(false));
                return true;
            }
        }

        public void Reject(IEnumerable<PendingEvent> events)
        {
            lock (gate)
            {
                using (StreamWriter writer = new StreamWriter(RejectedPath, true, new UTF8Encoding(false)))
                {
                    foreach (PendingEvent pending in events)
                    {
                        writer.Write(pending.RunId);
                        writer.Write('\t');
                        writer.Write(pending.Seq.ToString(CultureInfo.InvariantCulture));
                        writer.Write('\t');
                        writer.Write(pending.Json);
                        writer.Write('\n');
                    }
                }
            }
        }

        private int CursorIndex(string[] lines)
        {
            if (cursorRunId == null)
            {
                return -1;
            }

            for (int i = lines.Length - 1; i >= 0; i--)
            {
                PendingEvent? parsed = ParseLine(lines[i]);
                if (parsed != null && parsed.RunId == cursorRunId && parsed.Seq == cursorSeq)
                {
                    return i;
                }
            }

            return -1;
        }

        private void WriteLines(string[] lines, int keepFrom)
        {
            using (StreamWriter writer = new StreamWriter(JournalPath, false, new UTF8Encoding(false)))
            {
                for (int i = keepFrom; i < lines.Length; i++)
                {
                    writer.Write(lines[i]);
                    writer.Write('\n');
                }
            }
        }

        private void LoadCursor()
        {
            if (!File.Exists(CursorPath))
            {
                return;
            }

            string text = File.ReadAllText(CursorPath, Encoding.UTF8).Trim();
            int tab = text.IndexOf('\t');
            if (tab <= 0)
            {
                return;
            }

            cursorRunId = text.Substring(0, tab);
            long seq;
            if (long.TryParse(text.Substring(tab + 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out seq))
            {
                cursorSeq = seq;
            }
        }

        private void EnforceCap(int incomingBytes)
        {
            if (!File.Exists(JournalPath))
            {
                return;
            }

            long size = new FileInfo(JournalPath).Length;
            if (size + incomingBytes <= hardCapBytes)
            {
                return;
            }

            string[] lines = File.ReadAllLines(JournalPath, Encoding.UTF8);
            long keepBytes = hardCapBytes / 2;
            long accumulated = 0;
            int keepFrom = lines.Length;
            for (int i = lines.Length - 1; i >= 0; i--)
            {
                accumulated += lines[i].Length + 1;
                if (accumulated > keepBytes)
                {
                    break;
                }

                keepFrom = i;
            }

            int cursor = CursorIndex(lines);
            int dropped = 0;
            for (int i = cursor + 1; i < keepFrom; i++)
            {
                if (ParseLine(lines[i]) != null)
                {
                    dropped++;
                }
            }

            droppedEvents += dropped;
            WriteLines(lines, keepFrom);
        }

        public static PendingEvent? ParseLine(string line)
        {
            if (string.IsNullOrEmpty(line))
            {
                return null;
            }

            int firstTab = line.IndexOf('\t');
            if (firstTab <= 0)
            {
                return null;
            }

            int secondTab = line.IndexOf('\t', firstTab + 1);
            if (secondTab <= firstTab)
            {
                return null;
            }

            long seq;
            if (!long.TryParse(line.Substring(firstTab + 1, secondTab - firstTab - 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out seq))
            {
                return null;
            }

            string json = line.Substring(secondTab + 1);
            if (json.Length == 0 || json[0] != '{' || json[json.Length - 1] != '}')
            {
                return null;
            }

            return new PendingEvent(line.Substring(0, firstTab), seq, json);
        }
    }
}
