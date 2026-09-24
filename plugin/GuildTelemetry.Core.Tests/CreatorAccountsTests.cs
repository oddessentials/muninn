using System.Collections.Generic;
using System.Linq;
using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class CreatorAccountsTests
    {
        [Fact]
        public void KeepsTheFirstAccountPerCreatorAndSkipsUnusableEntries()
        {
            CreatorAccounts accounts = new CreatorAccounts();
            Assert.True(accounts.Add(-198895386, "Steam_76561198000000001"));
            Assert.False(accounts.Add(-198895386, "Steam_76561198000000002"));
            Assert.False(accounts.Add(0, "Steam_76561198000000003"));
            Assert.False(accounts.Add(822478388, null));
            Assert.False(accounts.Add(822478388, string.Empty));
            Assert.False(accounts.Add(822478388, new string('x', CreatorAccounts.MaxAccountLength + 1)));
            Assert.True(accounts.Add(822478388, "Steam_76561198000000004"));
            Assert.Equal(2, accounts.Count);
            Assert.True(accounts.Knows(-198895386));
            Assert.Equal("Steam_76561198000000001", accounts.AccountOf(-198895386));
            Assert.Null(accounts.AccountOf(5));
        }

        [Fact]
        public void StopsAtTheContractLimit()
        {
            CreatorAccounts accounts = new CreatorAccounts();
            for (long creatorId = 1; creatorId <= CreatorAccounts.MaxEntries + 5; creatorId++)
            {
                accounts.Add(creatorId, "Steam_" + creatorId);
            }

            Assert.Equal(CreatorAccounts.MaxEntries, accounts.Count);
        }

        [Fact]
        public void WritesThePairsInTheOrderTheyWereFound()
        {
            CreatorAccounts accounts = new CreatorAccounts();
            accounts.Add(822478388, "Steam_2");
            accounts.Add(-198895386, "Steam_1");
            JsonWriter writer = new JsonWriter().BeginObject();
            accounts.Write(writer, "creators");
            Dictionary<string, object?> record = JsonReader.AsObject(JsonReader.Parse(writer.EndObject().ToString()))!;
            List<Dictionary<string, object?>> pairs = JsonReader.GetList(record, "creators").Select(item => JsonReader.AsObject(item)!).ToList();
            Assert.Equal(new double?[] { 822478388, -198895386 }, pairs.Select(pair => JsonReader.GetNumber(pair, "creator_id")).ToArray());
            Assert.Equal(new[] { "Steam_2", "Steam_1" }, pairs.Select(pair => JsonReader.GetString(pair, "platform_user_id")).ToArray());
        }

        [Fact]
        public void ReadsAnAccountFromTheWorldHistoryByIndex()
        {
            IList<string?> history = new List<string?> { "Steam_1", null, "Steam_3" };
            Assert.Equal("Steam_1", CreatorAccounts.AccountAt(history, 0));
            Assert.Null(CreatorAccounts.AccountAt(history, 1));
            Assert.Equal("Steam_3", CreatorAccounts.AccountAt(history, 2));
            Assert.Null(CreatorAccounts.AccountAt(history, -1));
            Assert.Null(CreatorAccounts.AccountAt(history, 3));
        }
    }
}
