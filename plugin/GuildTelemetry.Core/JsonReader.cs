using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace GuildTelemetry.Core
{
    public sealed class JsonReader
    {
        private readonly string text;
        private int position;

        private JsonReader(string text)
        {
            this.text = text;
        }

        public static object? Parse(string text)
        {
            JsonReader reader = new JsonReader(text);
            reader.SkipWhitespace();
            object? value = reader.ReadValue();
            reader.SkipWhitespace();
            if (reader.position != text.Length)
            {
                throw reader.Error("unexpected trailing characters");
            }

            return value;
        }

        public static Dictionary<string, object?>? AsObject(object? value)
        {
            return value as Dictionary<string, object?>;
        }

        public static List<object?>? AsList(object? value)
        {
            return value as List<object?>;
        }

        public static string? GetString(Dictionary<string, object?> record, string key)
        {
            object? value;
            return record.TryGetValue(key, out value) ? value as string : null;
        }

        public static double? GetNumber(Dictionary<string, object?> record, string key)
        {
            object? value;
            if (record.TryGetValue(key, out value) && value is double)
            {
                return (double)value;
            }

            return null;
        }

        public static bool? GetBool(Dictionary<string, object?> record, string key)
        {
            object? value;
            if (record.TryGetValue(key, out value) && value is bool)
            {
                return (bool)value;
            }

            return null;
        }

        public static List<object?> GetList(Dictionary<string, object?> record, string key)
        {
            object? value;
            return record.TryGetValue(key, out value) && value is List<object?> ? (List<object?>)value : new List<object?>();
        }

        private FormatException Error(string message)
        {
            return new FormatException("invalid JSON at " + position + ": " + message);
        }

        private void SkipWhitespace()
        {
            while (position < text.Length && (text[position] == ' ' || text[position] == '\t' || text[position] == '\n' || text[position] == '\r'))
            {
                position++;
            }
        }

        private object? ReadValue()
        {
            if (position >= text.Length)
            {
                throw Error("unexpected end");
            }

            char c = text[position];
            switch (c)
            {
                case '{':
                    return ReadObject();
                case '[':
                    return ReadArray();
                case '"':
                    return ReadString();
                case 't':
                    ReadLiteral("true");
                    return true;
                case 'f':
                    ReadLiteral("false");
                    return false;
                case 'n':
                    ReadLiteral("null");
                    return null;
                default:
                    if (c == '-' || (c >= '0' && c <= '9'))
                    {
                        return ReadNumber();
                    }

                    throw Error("unexpected character '" + c + "'");
            }
        }

        private void ReadLiteral(string literal)
        {
            if (string.CompareOrdinal(text, position, literal, 0, literal.Length) != 0)
            {
                throw Error("expected " + literal);
            }

            position += literal.Length;
        }

        private Dictionary<string, object?> ReadObject()
        {
            Dictionary<string, object?> record = new Dictionary<string, object?>(StringComparer.Ordinal);
            position++;
            SkipWhitespace();
            if (position < text.Length && text[position] == '}')
            {
                position++;
                return record;
            }

            while (true)
            {
                SkipWhitespace();
                if (position >= text.Length || text[position] != '"')
                {
                    throw Error("expected a property name");
                }

                string name = ReadString();
                SkipWhitespace();
                if (position >= text.Length || text[position] != ':')
                {
                    throw Error("expected ':'");
                }

                position++;
                SkipWhitespace();
                record[name] = ReadValue();
                SkipWhitespace();
                if (position >= text.Length)
                {
                    throw Error("unterminated object");
                }

                if (text[position] == ',')
                {
                    position++;
                    continue;
                }

                if (text[position] == '}')
                {
                    position++;
                    return record;
                }

                throw Error("expected ',' or '}'");
            }
        }

        private List<object?> ReadArray()
        {
            List<object?> list = new List<object?>();
            position++;
            SkipWhitespace();
            if (position < text.Length && text[position] == ']')
            {
                position++;
                return list;
            }

            while (true)
            {
                SkipWhitespace();
                list.Add(ReadValue());
                SkipWhitespace();
                if (position >= text.Length)
                {
                    throw Error("unterminated array");
                }

                if (text[position] == ',')
                {
                    position++;
                    continue;
                }

                if (text[position] == ']')
                {
                    position++;
                    return list;
                }

                throw Error("expected ',' or ']'");
            }
        }

        private string ReadString()
        {
            StringBuilder builder = new StringBuilder();
            position++;
            while (position < text.Length)
            {
                char c = text[position++];
                if (c == '"')
                {
                    return builder.ToString();
                }

                if (c != '\\')
                {
                    builder.Append(c);
                    continue;
                }

                if (position >= text.Length)
                {
                    break;
                }

                char escaped = text[position++];
                switch (escaped)
                {
                    case '"':
                    case '\\':
                    case '/':
                        builder.Append(escaped);
                        break;
                    case 'b':
                        builder.Append('\b');
                        break;
                    case 'f':
                        builder.Append('\f');
                        break;
                    case 'n':
                        builder.Append('\n');
                        break;
                    case 'r':
                        builder.Append('\r');
                        break;
                    case 't':
                        builder.Append('\t');
                        break;
                    case 'u':
                        if (position + 4 > text.Length)
                        {
                            throw Error("truncated unicode escape");
                        }

                        builder.Append((char)int.Parse(text.Substring(position, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        position += 4;
                        break;
                    default:
                        throw Error("bad escape '\\" + escaped + "'");
                }
            }

            throw Error("unterminated string");
        }

        private double ReadNumber()
        {
            int start = position;
            if (text[position] == '-')
            {
                position++;
            }

            while (position < text.Length)
            {
                char c = text[position];
                if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-')
                {
                    position++;
                    continue;
                }

                break;
            }

            double value;
            if (!double.TryParse(text.Substring(start, position - start), NumberStyles.Float, CultureInfo.InvariantCulture, out value))
            {
                throw Error("bad number");
            }

            return value;
        }
    }
}
