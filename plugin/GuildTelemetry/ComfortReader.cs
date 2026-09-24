using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using GuildTelemetry.Core;
using UnityEngine;

namespace GuildTelemetry
{
    internal static class ComfortReader
    {
        public static ComfortCatalogue? Read(out string? problem)
        {
            ZNetScene scene = ZNetScene.instance;
            ObjectDB database = ObjectDB.instance;
            if (scene == null || database == null)
            {
                problem = "the prefab scene or the object database is not ready";
                return null;
            }

            SE_Rested? rested = database.GetStatusEffect(SEMan.s_statusEffectRested) as SE_Rested;
            if (rested == null)
            {
                problem = "the object database has no Rested effect";
                return null;
            }

            HashSet<string> buildable = BuildablePrefabs(scene);
            List<ComfortSeason> seasons = new List<ComfortSeason>();
            Dictionary<string, string> seasonOf = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (SeasonalItemGroup group in SeasonalGroups(scene))
            {
                ComfortSeason? season = WindowOf(group);
                if (season != null && !seasons.Exists(known => known.Name == season.Name))
                {
                    seasons.Add(season);
                }

                foreach (GameObject piece in group.Pieces)
                {
                    if (piece != null && !seasonOf.ContainsKey(piece.name))
                    {
                        seasonOf[piece.name] = group.name;
                    }
                }
            }

            List<ComfortPiece> pieces = new List<ComfortPiece>();
            foreach (GameObject prefab in scene.m_prefabs)
            {
                if (prefab == null || !buildable.Contains(prefab.name) || prefab.GetComponent<ItemDrop>() != null)
                {
                    continue;
                }

                Piece piece = prefab.GetComponent<Piece>();
                if (piece == null || piece.m_comfort <= 0)
                {
                    continue;
                }

                string? season = null;
                if (!piece.m_enabled && !seasonOf.TryGetValue(prefab.name, out season))
                {
                    continue;
                }

                pieces.Add(new ComfortPiece(
                    prefab.name,
                    piece.m_name ?? string.Empty,
                    NameOf(prefab, piece),
                    piece.m_comfort,
                    piece.m_comfortGroup.ToString(),
                    ConditionOf(prefab, piece),
                    season));
            }

            problem = null;
            return new ComfortCatalogue(
                global::Version.CurrentVersion.ToString(),
                MyPluginInfo.PLUGIN_VERSION,
                DateTime.UtcNow,
                Radius(),
                rested.m_baseTTL,
                rested.m_TTLPerComfortLevel,
                Enum.GetNames(typeof(Piece.ComfortGroup)),
                seasons,
                pieces);
        }

        private static HashSet<string> BuildablePrefabs(ZNetScene scene)
        {
            HashSet<string> names = new HashSet<string>(StringComparer.Ordinal);
            foreach (GameObject prefab in scene.m_prefabs)
            {
                if (prefab == null)
                {
                    continue;
                }

                ItemDrop item = prefab.GetComponent<ItemDrop>();
                if (item == null || item.m_itemData == null || item.m_itemData.m_shared == null)
                {
                    continue;
                }

                PieceTable table = item.m_itemData.m_shared.m_buildPieces;
                if (table == null || table.m_pieces == null)
                {
                    continue;
                }

                foreach (GameObject piece in table.m_pieces)
                {
                    if (piece != null)
                    {
                        names.Add(piece.name);
                    }
                }
            }

            return names;
        }

        private static List<SeasonalItemGroup> SeasonalGroups(ZNetScene scene)
        {
            List<SeasonalItemGroup> groups = new List<SeasonalItemGroup>();
            GameObject prefab = scene.GetPrefab("Player");
            if (prefab == null)
            {
                return groups;
            }

            Player player = prefab.GetComponent<Player>();
            FieldInfo? field = typeof(Player).GetField("m_seasonalItemGroups", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (player == null || field == null || !(field.GetValue(player) is IEnumerable listed))
            {
                return groups;
            }

            foreach (object entry in listed)
            {
                SeasonalItemGroup? group = entry as SeasonalItemGroup;
                if (group != null && group.Pieces != null && !string.IsNullOrEmpty(group.name))
                {
                    groups.Add(group);
                }
            }

            return groups;
        }

        private static ComfortSeason? WindowOf(SeasonalItemGroup group)
        {
            try
            {
                DateTime start = group.GetStartDate();
                DateTime end = group.GetEndDate();
                return new ComfortSeason(group.name, start.Day, start.Month, end.Day, end.Month);
            }
            catch (ArgumentOutOfRangeException)
            {
                return null;
            }
        }

        private static string NameOf(GameObject prefab, Piece piece)
        {
            string token = piece.m_name ?? string.Empty;
            if (token.Length == 0)
            {
                return prefab.name;
            }

            string name = Localization.instance.Localize(token);
            return string.IsNullOrEmpty(name) || name == "[" + token.TrimStart('$') + "]" ? prefab.name : name;
        }

        private static string? ConditionOf(GameObject prefab, Piece piece)
        {
            if (piece.m_comfortObject == null)
            {
                return null;
            }

            Fireplace fire = prefab.GetComponent<Fireplace>();
            bool dampens = fire != null
                && fire.m_enabledObjectHigh != null
                && fire.m_enabledObjectLow != null
                && piece.m_comfortObject.transform.IsChildOf(fire.m_enabledObjectHigh.transform);
            return dampens ? ComfortCatalogue.LitDry : ComfortCatalogue.Lit;
        }

        private static double? Radius()
        {
            FieldInfo? field = typeof(SE_Rested).GetField("c_ComfortRadius", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            object? value = field == null ? null : field.IsLiteral ? field.GetRawConstantValue() : field.GetValue(null);
            if (value is float radius && radius > 0f)
            {
                return radius;
            }

            return null;
        }
    }
}
