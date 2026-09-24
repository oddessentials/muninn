using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;
using GuildTelemetry.Core;

namespace GuildTelemetry
{
    internal static class Creators
    {
        public static IList<string?> History()
        {
            List<string?> accounts = new List<string?>();
            World world = ZNet.World;
            if (world == null || world.m_playerHistory == null)
            {
                return accounts;
            }

            foreach (ZNet.CrossNetworkUserInfo entry in world.m_playerHistory)
            {
                accounts.Add(entry.m_id.IsValid ? entry.m_id.ToString() : null);
            }

            return accounts;
        }

        public static string? AccountOf(ZDO zdo, IList<string?> history)
        {
            return CreatorAccounts.AccountAt(history, zdo.GetInt(ZDOVars.s_creatorIndex, -1));
        }

        public static CreatorAccounts Scan(out int scanned, out long elapsedMs)
        {
            Stopwatch watch = Stopwatch.StartNew();
            CreatorAccounts found = new CreatorAccounts();
            scanned = 0;
            IList<string?> history = History();
            FieldInfo? field = typeof(ZDOMan).GetField("m_objectsByID", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (history.Count > 0 && ZDOMan.instance != null && field != null && field.GetValue(ZDOMan.instance) is Dictionary<ZDOID, ZDO> all)
            {
                foreach (ZDO zdo in all.Values)
                {
                    scanned++;
                    long creator = zdo.GetLong(ZDOVars.s_creator, 0L);
                    if (creator != 0 && !found.Knows(creator))
                    {
                        found.Add(creator, AccountOf(zdo, history));
                    }
                }
            }

            elapsedMs = watch.ElapsedMilliseconds;
            return found;
        }
    }
}
