using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class ComfortCatalogueTests
    {
        private static readonly DateTime GeneratedAt = new DateTime(2026, 9, 23, 22, 0, 0, DateTimeKind.Utc);

        private static ComfortCatalogue Catalogue(double? radius)
        {
            return new ComfortCatalogue(
                "1.0.12",
                "0.5.0",
                GeneratedAt,
                radius,
                480,
                60,
                new[] { "None", "Fire" },
                new[] { new ComfortSeason("Yule", 1, 12, 6, 1) },
                new[]
                {
                    new ComfortPiece("hearth", "$piece_hearth", "Hearth", 2, "Fire", ComfortCatalogue.Lit, null),
                    new ComfortPiece("piece_xmastree", "$piece_yuletree", "Yule \"Tree\"", 1, "None", null, "Yule")
                });
        }

        private static Dictionary<string, object?> Parse(ComfortCatalogue catalogue)
        {
            Dictionary<string, object?>? record = JsonReader.AsObject(JsonReader.Parse(catalogue.ToJson()));
            Assert.NotNull(record);
            return record!;
        }

        [Fact]
        public void WritesExactlyTheFieldsTheSiteAccepts()
        {
            Dictionary<string, object?> record = Parse(Catalogue(10));
            Assert.Equal(
                new[] { "game_version", "generated_at", "groups", "pieces", "plugin_version", "radius_m", "rested_base_s", "rested_per_level_s", "seasons" },
                record.Keys.OrderBy(key => key, StringComparer.Ordinal).ToArray());
            Assert.Equal("1.0.12", JsonReader.GetString(record, "game_version"));
            Assert.Equal("0.5.0", JsonReader.GetString(record, "plugin_version"));
            Assert.Equal("2026-09-23T22:00:00.000Z", JsonReader.GetString(record, "generated_at"));
            Assert.Equal(10d, JsonReader.GetNumber(record, "radius_m"));
            Assert.Equal(480d, JsonReader.GetNumber(record, "rested_base_s"));
            Assert.Equal(60d, JsonReader.GetNumber(record, "rested_per_level_s"));
            Assert.Equal(new object?[] { "None", "Fire" }, JsonReader.GetList(record, "groups").ToArray());
        }

        [Fact]
        public void WritesSeasonsAndPiecesWithTheirConditions()
        {
            Dictionary<string, object?> record = Parse(Catalogue(10));
            Dictionary<string, object?> season = JsonReader.AsObject(JsonReader.GetList(record, "seasons").Single())!;
            Assert.Equal("Yule", JsonReader.GetString(season, "name"));
            Assert.Equal(new double?[] { 1, 12, 6, 1 }, new[] { "start_day", "start_month", "end_day", "end_month" }.Select(key => JsonReader.GetNumber(season, key)).ToArray());
            List<Dictionary<string, object?>> pieces = JsonReader.GetList(record, "pieces").Select(piece => JsonReader.AsObject(piece)!).ToList();
            Assert.Equal(2, pieces.Count);
            Assert.Equal("hearth", JsonReader.GetString(pieces[0], "prefab"));
            Assert.Equal("$piece_hearth", JsonReader.GetString(pieces[0], "token"));
            Assert.Equal(2d, JsonReader.GetNumber(pieces[0], "comfort"));
            Assert.Equal("Fire", JsonReader.GetString(pieces[0], "group"));
            Assert.Equal("lit", JsonReader.GetString(pieces[0], "condition"));
            Assert.True(pieces[0].ContainsKey("season"));
            Assert.Null(pieces[0]["season"]);
            Assert.Equal("Yule \"Tree\"", JsonReader.GetString(pieces[1], "name"));
            Assert.True(pieces[1].ContainsKey("condition"));
            Assert.Null(pieces[1]["condition"]);
            Assert.Equal("Yule", JsonReader.GetString(pieces[1], "season"));
        }

        [Fact]
        public void WritesAnUnknownRadiusAsNull()
        {
            Dictionary<string, object?> record = Parse(Catalogue(null));
            Assert.True(record.ContainsKey("radius_m"));
            Assert.Null(record["radius_m"]);
        }

        [Fact]
        public void KeepsOnlyEntriesThatFitTheContract()
        {
            string longText = new string('x', 200);
            ComfortCatalogue catalogue = new ComfortCatalogue(
                "1.0.12",
                "0.5.0",
                GeneratedAt,
                -1,
                -5,
                60,
                new[] { "None", "Fire", "Fire", string.Empty, longText },
                new[]
                {
                    new ComfortSeason("Yule", 1, 12, 6, 1),
                    new ComfortSeason("Yule", 2, 12, 7, 1),
                    new ComfortSeason(string.Empty, 1, 1, 2, 1),
                    new ComfortSeason("Broken", 1, 13, 2, 1)
                },
                new[]
                {
                    new ComfortPiece("hearth", "$piece_hearth", "Hearth", 2, "Fire", ComfortCatalogue.Lit, null),
                    new ComfortPiece("hearth", "$piece_hearth", "Hearth again", 2, "Fire", null, null),
                    new ComfortPiece(string.Empty, "$empty", "Empty", 1, "Fire", null, null),
                    new ComfortPiece(longText, "$long", "Long", 1, "Fire", null, null),
                    new ComfortPiece("zero", "$zero", "Zero", 0, "Fire", null, null),
                    new ComfortPiece("huge", "$huge", "Huge", ComfortCatalogue.MaxComfort + 1, "Fire", null, null),
                    new ComfortPiece("ungrouped", "$ungrouped", "Ungrouped", 1, string.Empty, null, null),
                    new ComfortPiece("named_long", longText, longText, 1, longText, "burning", longText),
                    new ComfortPiece("nameless", "$nameless", string.Empty, 1, "Chair", null, null),
                    new ComfortPiece("unseasoned", "$unseasoned", "Unseasoned", 1, "Chair", null, string.Empty)
                });
            Assert.Null(catalogue.RadiusMetres);
            Assert.Equal(0d, catalogue.RestedBaseSeconds);
            Assert.Equal(new[] { "None", "Fire", new string('x', ComfortCatalogue.LabelLength) }, catalogue.Groups);
            Assert.Equal(new[] { "Yule" }, catalogue.Seasons.Select(season => season.Name));
            Assert.Equal(1, catalogue.Seasons[0].StartDay);
            Assert.Equal(new[] { "hearth", "named_long", "nameless" }, catalogue.Pieces.Select(piece => piece.Prefab));
            Assert.Equal("Hearth", catalogue.Pieces[0].Name);
            ComfortPiece clipped = catalogue.Pieces[1];
            Assert.Equal(ComfortCatalogue.TextLength, clipped.Name.Length);
            Assert.Equal(ComfortCatalogue.TextLength, clipped.Token.Length);
            Assert.Equal(ComfortCatalogue.LabelLength, clipped.Group.Length);
            Assert.Equal(ComfortCatalogue.LabelLength, clipped.Season!.Length);
            Assert.Null(clipped.Condition);
            Assert.Equal("nameless", catalogue.Pieces[2].Name);
        }
    }

    public sealed class OneShotUploadTests
    {
        private static readonly DateTime Now = new DateTime(2026, 9, 23, 22, 0, 0, DateTimeKind.Utc);
        private static readonly byte[] Body = Encoding.UTF8.GetBytes("{\"game_version\":\"1.0.12\"}");
        private const string Secret = "test-secret";
        private const string Url = "https://guild.example.org/api/ingest/catalogue";

        private sealed class ScriptedTransport : ITelemetryTransport
        {
            private readonly Queue<int> statuses;

            public ScriptedTransport(params int[] statuses)
            {
                this.statuses = new Queue<int>(statuses);
            }

            public List<IDictionary<string, string>> Headers { get; } = new List<IDictionary<string, string>>();

            public List<string> Urls { get; } = new List<string>();

            public List<string> ContentTypes { get; } = new List<string>();

            public SendResult Post(string url, byte[] body, string contentType, IDictionary<string, string> headers, int timeoutMs)
            {
                Urls.Add(url);
                ContentTypes.Add(contentType);
                Headers.Add(new Dictionary<string, string>(headers));
                int status = statuses.Count > 0 ? statuses.Dequeue() : 500;
                return status == 0 ? new SendResult(0, "connection refused") : new SendResult(status, status >= 400 ? "error" : null);
            }
        }

        private static (UploadOutcome Outcome, List<int> Sleeps, List<string> Reports) Run(ScriptedTransport transport)
        {
            List<int> sleeps = new List<int>();
            List<string> reports = new List<string>();
            OneShotUpload upload = new OneShotUpload(transport, sleeps.Add, () => Now);
            UploadOutcome outcome = upload.Send(Url, Secret, Body, "application/json", reports.Add);
            return (outcome, sleeps, reports);
        }

        [Fact]
        public void SignsTheBodyDigestAndStopsAtTheFirstSuccess()
        {
            ScriptedTransport transport = new ScriptedTransport(503, 0, 204);
            (UploadOutcome outcome, List<int> sleeps, List<string> reports) = Run(transport);
            Assert.Equal(UploadOutcome.Stored, outcome);
            Assert.Equal(new[] { OneShotUpload.RetryMs, OneShotUpload.RetryMs }, sleeps);
            Assert.Equal(2, reports.Count);
            Assert.All(transport.Urls, url => Assert.Equal(Url, url));
            Assert.All(transport.ContentTypes, type => Assert.Equal("application/json", type));
            long unix = (long)(Now - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
            string expected = new RequestSigner(Secret).Sign(unix, RequestSigner.Sha256Hex(Body));
            IDictionary<string, string> last = transport.Headers.Last();
            Assert.Equal(unix.ToString(System.Globalization.CultureInfo.InvariantCulture), last[RequestSigner.TimestampHeader]);
            Assert.Equal(expected, last[RequestSigner.SignatureHeader]);
        }

        [Theory]
        [InlineData(401)]
        [InlineData(413)]
        [InlineData(422)]
        public void StopsWhenTheSiteRefuses(int status)
        {
            ScriptedTransport transport = new ScriptedTransport(status);
            (UploadOutcome outcome, List<int> sleeps, List<string> reports) = Run(transport);
            Assert.Equal(UploadOutcome.Refused, outcome);
            Assert.Single(transport.Urls);
            Assert.Empty(sleeps);
            Assert.Contains("HTTP " + status, reports.Single());
        }

        [Fact]
        public void GivesUpAfterTheLastAttemptWithoutSleepingAfterIt()
        {
            ScriptedTransport transport = new ScriptedTransport();
            (UploadOutcome outcome, List<int> sleeps, List<string> reports) = Run(transport);
            Assert.Equal(UploadOutcome.GaveUp, outcome);
            Assert.Equal(OneShotUpload.Attempts, transport.Urls.Count);
            Assert.Equal(OneShotUpload.Attempts - 1, sleeps.Count);
            Assert.Equal(OneShotUpload.Attempts, reports.Count);
        }
    }
}
