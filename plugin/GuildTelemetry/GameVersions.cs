using System.Reflection;

namespace GuildTelemetry
{
    internal static class GameVersions
    {
        public static uint NetworkVersion()
        {
            FieldInfo? field = typeof(global::Version).GetField("c_networkVersion", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);
            object? value = field == null ? null : field.IsLiteral ? field.GetRawConstantValue() : field.GetValue(null);
            if (value is uint unsigned)
            {
                return unsigned;
            }

            if (value is int signed)
            {
                return (uint)signed;
            }

            return global::Version.c_networkVersion;
        }
    }
}
