using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Threading;

namespace GuildTelemetry.Core
{
    public sealed class PipelineOptions
    {
        public string Url { get; set; } = string.Empty;

        public string Secret { get; set; } = string.Empty;

        public int FlushIntervalMs { get; set; } = 2000;

        public int QueueCapacity { get; set; } = 10_000;

        public int RequestTimeoutMs { get; set; } = 30_000;

        public int MaxBatchEvents { get; set; } = BatchBuilder.MaxEvents;

        public int MaxBatchBytes { get; set; } = BatchBuilder.MaxBodyBytes;
    }

    public sealed class TelemetryPipeline : IDisposable
    {
        private readonly PipelineOptions options;
        private readonly BatchMetadata metadata;
        private readonly EventJournal journal;
        private readonly ITelemetryTransport transport;
        private readonly RequestSigner signer;
        private readonly Action<string> log;
        private readonly Func<DateTime> clock;
        private readonly ConcurrentQueue<PendingEvent> incoming = new ConcurrentQueue<PendingEvent>();
        private readonly List<PendingEvent> pending = new List<PendingEvent>();
        private readonly AutoResetEvent wake = new AutoResetEvent(false);
        private readonly ManualResetEvent stopped = new ManualResetEvent(false);
        private readonly object flushGate = new object();
        private Thread? worker;
        private int queued;
        private long droppedByQueue;
        private int consecutiveFailures;
        private int maxBatchEvents;
        private DateTime nextAttemptUtc = DateTime.MinValue;
        private volatile bool stopping;
        private long acceptedBatches;
        private long rejectedBatches;
        private string lastError = string.Empty;
        private IngestResponse? latestResponse;

        public TelemetryPipeline(PipelineOptions options, BatchMetadata metadata, EventJournal journal, ITelemetryTransport transport, Action<string> log, Func<DateTime>? clock = null)
        {
            this.options = options;
            this.metadata = metadata;
            this.journal = journal;
            this.transport = transport;
            this.log = log;
            this.clock = clock ?? (() => DateTime.UtcNow);
            signer = new RequestSigner(options.Secret);
            maxBatchEvents = options.MaxBatchEvents;
        }

        public int QueueDepth => queued + pending.Count;

        public long DroppedEvents => droppedByQueue + journal.DroppedEvents;

        public long AcceptedBatches => acceptedBatches;

        public long RejectedBatches => rejectedBatches;

        public string LastError => lastError;

        public int ConsecutiveFailures => consecutiveFailures;

        public IngestResponse? TakeResponse()
        {
            return Interlocked.Exchange(ref latestResponse, null);
        }

        public void Start()
        {
            List<PendingEvent> replay = journal.LoadUnacknowledged();
            if (replay.Count > 0)
            {
                log("replaying " + replay.Count + " journaled event(s)");
                pending.AddRange(replay);
            }

            worker = new Thread(Run);
            worker.Name = "GuildTelemetry sender";
            worker.IsBackground = true;
            worker.Start();
        }

        public bool Enqueue(TelemetryEvent telemetryEvent)
        {
            if (Interlocked.Increment(ref queued) > options.QueueCapacity)
            {
                Interlocked.Decrement(ref queued);
                Interlocked.Increment(ref droppedByQueue);
                return false;
            }

            incoming.Enqueue(PendingEvent.From(telemetryEvent));
            wake.Set();
            return true;
        }

        public void FlushSync(int timeoutMs)
        {
            Stopwatch watch = Stopwatch.StartNew();
            lock (flushGate)
            {
                Drain();
                while (pending.Count > 0 && watch.ElapsedMilliseconds < timeoutMs)
                {
                    int remaining = (int)Math.Max(1, timeoutMs - watch.ElapsedMilliseconds);
                    if (!SendOnce(remaining))
                    {
                        break;
                    }
                }
            }
        }

        public void Dispose()
        {
            stopping = true;
            wake.Set();
            if (worker != null)
            {
                stopped.WaitOne(3000);
            }
        }

        private void Run()
        {
            try
            {
                while (!stopping)
                {
                    wake.WaitOne(options.FlushIntervalMs);
                    if (stopping)
                    {
                        break;
                    }

                    lock (flushGate)
                    {
                        Drain();
                        DateTime now = clock();
                        if (pending.Count == 0 || now < nextAttemptUtc)
                        {
                            continue;
                        }

                        while (pending.Count > 0 && !stopping)
                        {
                            if (!SendOnce(options.RequestTimeoutMs))
                            {
                                break;
                            }
                        }

                        journal.RewriteIfFullyAcknowledged();
                    }
                }
            }
            catch (Exception exception)
            {
                log("sender thread stopped: " + exception);
            }
            finally
            {
                stopped.Set();
            }
        }

        private void Drain()
        {
            PendingEvent? item;
            while (incoming.TryDequeue(out item))
            {
                Interlocked.Decrement(ref queued);
                try
                {
                    journal.Append(item);
                }
                catch (Exception exception)
                {
                    log("journal append failed: " + exception.Message);
                }

                pending.Add(item);
            }
        }

        private void RememberResponse(string? body)
        {
            try
            {
                IngestResponse? parsed = IngestResponse.Parse(body);
                if (parsed != null)
                {
                    Interlocked.Exchange(ref latestResponse, parsed);
                }
            }
            catch (Exception exception)
            {
                log("ingest response unreadable: " + exception.Message);
            }
        }

        private bool SendOnce(int timeoutMs)
        {
            Batch batch = BatchBuilder.Build(metadata, pending, Math.Max(1, maxBatchEvents), options.MaxBatchBytes);
            long unix = (long)(clock() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
            string signature = signer.Sign(unix, batch.Body);
            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                { RequestSigner.TimestampHeader, unix.ToString(CultureInfo.InvariantCulture) },
                { RequestSigner.SignatureHeader, signature }
            };
            SendResult result = transport.Post(options.Url, batch.Body, "application/json", headers, timeoutMs);
            SendOutcome outcome = RetryPolicy.Classify(result.StatusCode, result.TransportFailed);
            switch (outcome)
            {
                case SendOutcome.Accepted:
                    pending.RemoveRange(0, batch.Events.Count);
                    journal.Acknowledge(batch.Last.RunId, batch.Last.Seq);
                    consecutiveFailures = 0;
                    maxBatchEvents = options.MaxBatchEvents;
                    acceptedBatches++;
                    lastError = string.Empty;
                    RememberResponse(result.Body);
                    return true;
                case SendOutcome.PayloadTooLarge:
                    if (batch.Events.Count <= 1)
                    {
                        journal.Reject(batch.Events);
                        pending.RemoveRange(0, batch.Events.Count);
                        journal.Acknowledge(batch.Last.RunId, batch.Last.Seq);
                        rejectedBatches++;
                        log("event rejected as too large: seq " + batch.Last.Seq);
                        return true;
                    }

                    maxBatchEvents = Math.Max(1, batch.Events.Count / 2);
                    log("batch too large (" + batch.Events.Count + " events), splitting");
                    return true;
                case SendOutcome.Unprocessable:
                    journal.Reject(batch.Events);
                    pending.RemoveRange(0, batch.Events.Count);
                    journal.Acknowledge(batch.Last.RunId, batch.Last.Seq);
                    rejectedBatches++;
                    lastError = result.Error ?? "unprocessable";
                    log("batch rejected as unprocessable and moved to " + EventJournal.RejectedFileName + ": " + lastError);
                    return true;
                default:
                    consecutiveFailures++;
                    int delay = RetryPolicy.DelayMs(outcome, consecutiveFailures);
                    nextAttemptUtc = clock().AddMilliseconds(delay);
                    lastError = result.Error ?? ("HTTP " + result.StatusCode);
                    if (outcome == SendOutcome.Unauthorized)
                    {
                        log("endpoint refused the signature (HTTP " + result.StatusCode + "); check Url and Secret; retrying in " + (delay / 1000) + " s");
                    }
                    else if (consecutiveFailures == 1 || consecutiveFailures % 10 == 0)
                    {
                        log("send failed (" + lastError + "); retrying in " + (delay / 1000) + " s");
                    }

                    return false;
            }
        }
    }
}
