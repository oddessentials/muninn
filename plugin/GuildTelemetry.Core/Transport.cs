using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace GuildTelemetry.Core
{
    public sealed class SendResult
    {
        public SendResult(int statusCode, string? error)
            : this(statusCode, error, null)
        {
        }

        public SendResult(int statusCode, string? error, string? body)
        {
            StatusCode = statusCode;
            Error = error;
            Body = body;
        }

        public int StatusCode { get; }

        public string? Error { get; }

        public string? Body { get; }

        public bool TransportFailed => StatusCode == 0;
    }

    public interface ITelemetryTransport
    {
        SendResult Post(string url, byte[] body, string contentType, IDictionary<string, string> headers, int timeoutMs);
    }

    public sealed class HttpTransport : ITelemetryTransport
    {
        private readonly HttpClient client;

        public HttpTransport()
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            client = new HttpClient();
            client.Timeout = TimeSpan.FromSeconds(60);
            client.DefaultRequestHeaders.ExpectContinue = false;
        }

        public SendResult Post(string url, byte[] body, string contentType, IDictionary<string, string> headers, int timeoutMs)
        {
            try
            {
                using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, url))
                {
                    ByteArrayContent content = new ByteArrayContent(body);
                    content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
                    request.Content = content;
                    foreach (KeyValuePair<string, string> header in headers)
                    {
                        request.Headers.TryAddWithoutValidation(header.Key, header.Value);
                    }

                    Task<HttpResponseMessage> task = client.SendAsync(request, HttpCompletionOption.ResponseContentRead);
                    if (!task.Wait(timeoutMs))
                    {
                        return new SendResult(0, "timeout after " + timeoutMs + " ms");
                    }

                    using (HttpResponseMessage response = task.Result)
                    {
                        int status = (int)response.StatusCode;
                        Task<string> read = response.Content.ReadAsStringAsync();
                        string? text = read.Wait(5000) ? read.Result : null;
                        if (status < 200 || status >= 300)
                        {
                            return new SendResult(status, text == null ? "unreadable response body" : Truncate(text));
                        }

                        return new SendResult(status, null, text);
                    }
                }
            }
            catch (AggregateException exception)
            {
                Exception inner = exception.InnerException ?? exception;
                return new SendResult(0, inner.GetType().Name + ": " + inner.Message);
            }
            catch (Exception exception)
            {
                return new SendResult(0, exception.GetType().Name + ": " + exception.Message);
            }
        }

        private static string Truncate(string text)
        {
            return text.Length <= 300 ? text : text.Substring(0, 300);
        }
    }
}
