using System.Collections.Generic;

namespace GuildTelemetry.Core
{
    public sealed class CreatorAccounts
    {
        public const int MaxEntries = 1000;
        public const int MaxAccountLength = 128;

        private readonly Dictionary<long, string> accounts = new Dictionary<long, string>();
        private readonly List<long> order = new List<long>();

        public int Count => order.Count;

        public bool Knows(long creatorId)
        {
            return accounts.ContainsKey(creatorId);
        }

        public string? AccountOf(long creatorId)
        {
            string? account;
            return accounts.TryGetValue(creatorId, out account) ? account : null;
        }

        public bool Add(long creatorId, string? platformUserId)
        {
            if (creatorId == 0
                || string.IsNullOrEmpty(platformUserId)
                || platformUserId!.Length > MaxAccountLength
                || accounts.ContainsKey(creatorId)
                || order.Count >= MaxEntries)
            {
                return false;
            }

            accounts[creatorId] = platformUserId;
            order.Add(creatorId);
            return true;
        }

        public JsonWriter Write(JsonWriter writer, string name)
        {
            writer.Name(name).BeginArray();
            foreach (long creatorId in order)
            {
                writer.BeginObject()
                    .Property("creator_id", creatorId)
                    .Property("platform_user_id", accounts[creatorId])
                    .EndObject();
            }

            return writer.EndArray();
        }

        public static string? AccountAt(IList<string?> history, int index)
        {
            if (index < 0 || index >= history.Count)
            {
                return null;
            }

            string? account = history[index];
            return string.IsNullOrEmpty(account) ? null : account;
        }
    }
}
