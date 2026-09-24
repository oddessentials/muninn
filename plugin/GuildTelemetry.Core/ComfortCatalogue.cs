using System;
using System.Collections.Generic;

namespace GuildTelemetry.Core
{
    public sealed class ComfortSeason
    {
        public ComfortSeason(string name, int startDay, int startMonth, int endDay, int endMonth)
        {
            Name = name;
            StartDay = startDay;
            StartMonth = startMonth;
            EndDay = endDay;
            EndMonth = endMonth;
        }

        public string Name { get; }

        public int StartDay { get; }

        public int StartMonth { get; }

        public int EndDay { get; }

        public int EndMonth { get; }
    }

    public sealed class ComfortPiece
    {
        public ComfortPiece(string prefab, string token, string name, int comfort, string group, string? condition, string? season)
        {
            Prefab = prefab;
            Token = token;
            Name = name;
            Comfort = comfort;
            Group = group;
            Condition = condition;
            Season = season;
        }

        public string Prefab { get; }

        public string Token { get; }

        public string Name { get; }

        public int Comfort { get; }

        public string Group { get; }

        public string? Condition { get; }

        public string? Season { get; }
    }

    public sealed class ComfortCatalogue
    {
        public const string Lit = "lit";
        public const string LitDry = "lit_dry";
        public const int VersionLength = 32;
        public const int TextLength = 128;
        public const int LabelLength = 64;
        public const int MaxGroups = 64;
        public const int MaxSeasons = 32;
        public const int MaxPieces = 2000;
        public const int MaxComfort = 1000;

        public ComfortCatalogue(
            string gameVersion,
            string pluginVersion,
            DateTime generatedAt,
            double? radiusMetres,
            double restedBaseSeconds,
            double restedPerLevelSeconds,
            IEnumerable<string> groups,
            IEnumerable<ComfortSeason> seasons,
            IEnumerable<ComfortPiece> pieces)
        {
            GameVersion = Clip(gameVersion, VersionLength);
            PluginVersion = Clip(pluginVersion, VersionLength);
            GeneratedAt = generatedAt;
            RadiusMetres = radiusMetres.HasValue && radiusMetres.Value > 0 ? radiusMetres : null;
            RestedBaseSeconds = Math.Max(0, restedBaseSeconds);
            RestedPerLevelSeconds = Math.Max(0, restedPerLevelSeconds);
            Groups = FitGroups(groups);
            Seasons = FitSeasons(seasons);
            Pieces = FitPieces(pieces);
        }

        public string GameVersion { get; }

        public string PluginVersion { get; }

        public DateTime GeneratedAt { get; }

        public double? RadiusMetres { get; }

        public double RestedBaseSeconds { get; }

        public double RestedPerLevelSeconds { get; }

        public IList<string> Groups { get; }

        public IList<ComfortSeason> Seasons { get; }

        public IList<ComfortPiece> Pieces { get; }

        public string ToJson()
        {
            JsonWriter writer = new JsonWriter();
            writer.BeginObject()
                .Property("game_version", GameVersion)
                .Property("plugin_version", PluginVersion)
                .Property("generated_at", JsonWriter.Timestamp(GeneratedAt));
            if (RadiusMetres.HasValue)
            {
                writer.Property("radius_m", RadiusMetres.Value);
            }
            else
            {
                writer.PropertyNull("radius_m");
            }

            writer.Property("rested_base_s", RestedBaseSeconds)
                .Property("rested_per_level_s", RestedPerLevelSeconds)
                .StringArray("groups", Groups);
            writer.Name("seasons").BeginArray();
            foreach (ComfortSeason season in Seasons)
            {
                writer.BeginObject()
                    .Property("name", season.Name)
                    .Property("start_day", season.StartDay)
                    .Property("start_month", season.StartMonth)
                    .Property("end_day", season.EndDay)
                    .Property("end_month", season.EndMonth)
                    .EndObject();
            }

            writer.EndArray();
            writer.Name("pieces").BeginArray();
            foreach (ComfortPiece piece in Pieces)
            {
                writer.BeginObject()
                    .Property("prefab", piece.Prefab)
                    .Property("token", piece.Token)
                    .Property("name", piece.Name)
                    .Property("comfort", piece.Comfort)
                    .Property("group", piece.Group)
                    .Property("condition", piece.Condition)
                    .Property("season", piece.Season)
                    .EndObject();
            }

            writer.EndArray();
            return writer.EndObject().ToString();
        }

        private static string Clip(string? value, int length)
        {
            string text = value ?? string.Empty;
            return text.Length <= length ? text : text.Substring(0, length);
        }

        private static bool InRange(int value, int lowest, int highest)
        {
            return value >= lowest && value <= highest;
        }

        private static IList<string> FitGroups(IEnumerable<string> groups)
        {
            List<string> fitted = new List<string>();
            foreach (string group in groups)
            {
                string label = Clip(group, LabelLength);
                if (label.Length > 0 && fitted.Count < MaxGroups && !fitted.Contains(label))
                {
                    fitted.Add(label);
                }
            }

            return fitted;
        }

        private static IList<ComfortSeason> FitSeasons(IEnumerable<ComfortSeason> seasons)
        {
            List<ComfortSeason> fitted = new List<ComfortSeason>();
            foreach (ComfortSeason season in seasons)
            {
                string name = Clip(season.Name, LabelLength);
                bool datesValid = InRange(season.StartDay, 1, 31) && InRange(season.StartMonth, 1, 12) && InRange(season.EndDay, 1, 31) && InRange(season.EndMonth, 1, 12);
                if (name.Length == 0 || !datesValid || fitted.Count >= MaxSeasons || fitted.Exists(known => known.Name == name))
                {
                    continue;
                }

                fitted.Add(new ComfortSeason(name, season.StartDay, season.StartMonth, season.EndDay, season.EndMonth));
            }

            return fitted;
        }

        private static IList<ComfortPiece> FitPieces(IEnumerable<ComfortPiece> pieces)
        {
            List<ComfortPiece> fitted = new List<ComfortPiece>();
            HashSet<string> prefabs = new HashSet<string>(StringComparer.Ordinal);
            foreach (ComfortPiece piece in pieces)
            {
                string prefab = piece.Prefab ?? string.Empty;
                string group = Clip(piece.Group, LabelLength);
                bool fits = prefab.Length > 0 && prefab.Length <= TextLength && group.Length > 0 && InRange(piece.Comfort, 1, MaxComfort);
                if (!fits || fitted.Count >= MaxPieces || !prefabs.Add(prefab))
                {
                    continue;
                }

                string name = Clip(string.IsNullOrEmpty(piece.Name) ? prefab : piece.Name, TextLength);
                string? condition = piece.Condition == Lit || piece.Condition == LitDry ? piece.Condition : null;
                string? season = piece.Season == null ? null : Clip(piece.Season, LabelLength);
                if (season != null && season.Length == 0)
                {
                    continue;
                }

                fitted.Add(new ComfortPiece(prefab, Clip(piece.Token, TextLength), name, piece.Comfort, group, condition, season));
            }

            return fitted;
        }
    }
}
