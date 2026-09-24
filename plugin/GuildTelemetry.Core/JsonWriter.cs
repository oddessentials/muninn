using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace GuildTelemetry.Core
{
    public sealed class JsonWriter
    {
        private readonly StringBuilder builder = new StringBuilder();
        private readonly Stack<bool> firstInScope = new Stack<bool>();

        public JsonWriter BeginObject()
        {
            Separate();
            builder.Append('{');
            firstInScope.Push(true);
            return this;
        }

        public JsonWriter EndObject()
        {
            firstInScope.Pop();
            builder.Append('}');
            return this;
        }

        public JsonWriter BeginArray()
        {
            Separate();
            builder.Append('[');
            firstInScope.Push(true);
            return this;
        }

        public JsonWriter EndArray()
        {
            firstInScope.Pop();
            builder.Append(']');
            return this;
        }

        public JsonWriter Name(string name)
        {
            Separate();
            WriteString(name);
            builder.Append(':');
            firstInScope.Push(true);
            firstInScope.Pop();
            MarkValuePending();
            return this;
        }

        public JsonWriter Value(string? value)
        {
            Separate();
            if (value == null)
            {
                builder.Append("null");
            }
            else
            {
                WriteString(value);
            }

            return this;
        }

        public JsonWriter Value(long value)
        {
            Separate();
            builder.Append(value.ToString(CultureInfo.InvariantCulture));
            return this;
        }

        public JsonWriter Value(int value)
        {
            return Value((long)value);
        }

        public JsonWriter Value(double value)
        {
            Separate();
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                builder.Append('0');
            }
            else
            {
                builder.Append(value.ToString("R", CultureInfo.InvariantCulture));
            }

            return this;
        }

        public JsonWriter Value(bool value)
        {
            Separate();
            builder.Append(value ? "true" : "false");
            return this;
        }

        public JsonWriter Null()
        {
            Separate();
            builder.Append("null");
            return this;
        }

        public JsonWriter Raw(string json)
        {
            Separate();
            builder.Append(json);
            return this;
        }

        public JsonWriter Property(string name, string? value)
        {
            return Name(name).Value(value);
        }

        public JsonWriter Property(string name, long value)
        {
            return Name(name).Value(value);
        }

        public JsonWriter Property(string name, int value)
        {
            return Name(name).Value(value);
        }

        public JsonWriter Property(string name, double value)
        {
            return Name(name).Value(value);
        }

        public JsonWriter Property(string name, bool value)
        {
            return Name(name).Value(value);
        }

        public JsonWriter PropertyNull(string name)
        {
            return Name(name).Null();
        }

        public JsonWriter PropertyRaw(string name, string json)
        {
            return Name(name).Raw(json);
        }

        public JsonWriter StringArray(string name, IEnumerable<string> values)
        {
            Name(name).BeginArray();
            foreach (string value in values)
            {
                Value(value);
            }

            return EndArray();
        }

        public override string ToString()
        {
            return builder.ToString();
        }

        private bool valuePending;

        private void MarkValuePending()
        {
            valuePending = true;
        }

        private void Separate()
        {
            if (valuePending)
            {
                valuePending = false;
                return;
            }

            if (firstInScope.Count == 0)
            {
                return;
            }

            if (firstInScope.Peek())
            {
                firstInScope.Pop();
                firstInScope.Push(false);
            }
            else
            {
                builder.Append(',');
            }
        }

        private void WriteString(string value)
        {
            builder.Append('"');
            foreach (char c in value)
            {
                switch (c)
                {
                    case '"':
                        builder.Append("\\\"");
                        break;
                    case '\\':
                        builder.Append("\\\\");
                        break;
                    case '\n':
                        builder.Append("\\n");
                        break;
                    case '\r':
                        builder.Append("\\r");
                        break;
                    case '\t':
                        builder.Append("\\t");
                        break;
                    case '\b':
                        builder.Append("\\b");
                        break;
                    case '\f':
                        builder.Append("\\f");
                        break;
                    default:
                        if (c < 0x20)
                        {
                            builder.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            builder.Append(c);
                        }

                        break;
                }
            }

            builder.Append('"');
        }

        public static string Quote(string value)
        {
            JsonWriter writer = new JsonWriter();
            writer.WriteString(value);
            return writer.ToString();
        }

        public static string Timestamp(DateTime utc)
        {
            return utc.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
        }
    }
}
