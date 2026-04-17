using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;

class Program {
    static void Main() {
        var ws = new ClientWebSocket();
        var uri = new Uri("ws://localhost:8081/inspector/debug?device=996bfc17eabe9bae905345a7fe163a88de256fe9&page=1");
        var ct = CancellationToken.None;
        ws.ConnectAsync(uri, ct).Wait(5000);
        // Enable Runtime
        var enable = Encoding.UTF8.GetBytes("{\"id\":1,\"method\":\"Runtime.enable\",\"params\":{}}");
        ws.SendAsync(new ArraySegment<byte>(enable), WebSocketMessageType.Text, true, ct).Wait();
        var deadline = DateTime.Now.AddSeconds(8);
        var buf = new byte[131072];
        while (DateTime.Now < deadline && ws.State == WebSocketState.Open) {
            var seg = new ArraySegment<byte>(buf);
            try {
                var res = ws.ReceiveAsync(seg, new CancellationTokenSource(2000).Token).Result;
                var msg = Encoding.UTF8.GetString(buf, 0, res.Count);
                if (msg.Contains("error") || msg.Contains("Error") || msg.Contains("exception") || msg.Contains("consoleAPICalled"))
                    Console.WriteLine(msg);
            } catch {}
        }
        try { ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", ct).Wait(1000); } catch {}
    }
}
