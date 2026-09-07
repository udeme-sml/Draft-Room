using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json.Nodes;

namespace DraftClient
{
    class Program
    {
        private static async Task Main(string[] args)
        {
            Uri serverUri = new Uri("ws://localhost:8080");
            await ConnectWebSocketAsync(serverUri);
        }

        private static async Task ConnectWebSocketAsync(Uri serverUri)
        {
            using (ClientWebSocket webSocket = new ClientWebSocket())
            {
                await webSocket.ConnectAsync(serverUri, CancellationToken.None);
                Console.WriteLine("WebSocket connection opened");

                // Receive messages from the server
                _ = Task.Run(async () =>
                {
                    while (webSocket.State == WebSocketState.Open)
                    {
                        WebSocketReceiveResult result;
                        ArraySegment<byte> buffer = new ArraySegment<byte>(new byte[1024]);
                        do
                        {
                            result = await webSocket.ReceiveAsync(buffer, CancellationToken.None);
                            string message = Encoding.UTF8.GetString(buffer.Array, 0, result.Count);
                            JsonNode json = JsonNode.Parse(message);

                            switch (json["type"]?.ToString())
                            {
                                case "serverMessage":
                                    Console.WriteLine(json["message"]?.ToString());
                                    break;
                                case "error":
                                    Console.WriteLine(json["message"]?.ToString());
                                    break;
                                case "serverRequest":
                                    Console.WriteLine(json["request"]?.ToString());
                                    break;
                                case "chat":
                                    Console.WriteLine($"{json["from"]?.ToString()}: {json["text"]?.ToString()}");
                                    break;
                                case "userJoined":
                                    Console.WriteLine($"{json["name"]?.ToString()} joined the chat");
                                    break;
                                case "userList":
                                    Console.WriteLine($"Users: {string.Join(", ", json["users"]?.AsArray().Select(user => user.ToString()))}");
                                    break;
                                default:
                                    Console.WriteLine(json["message"]?.ToString());
                                    break;
                            }
                        }
                        while (!result.EndOfMessage);
                    }
                });

                // Send messages to the server
                while (true)
                {
                    string sendMessage = Console.ReadLine();
                    if (sendMessage.ToLower() == "quit")
                    {
                        break;
                    }
                    ArraySegment<byte> sendBuffer = new ArraySegment<byte>(Encoding.UTF8.GetBytes(sendMessage));
                    await webSocket.SendAsync(sendBuffer, WebSocketMessageType.Text, true, CancellationToken.None);
                }
                
                Console.ReadKey();
            }
        }
    }
}