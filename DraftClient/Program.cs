using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

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
                            Console.WriteLine("Received message: " + message);
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