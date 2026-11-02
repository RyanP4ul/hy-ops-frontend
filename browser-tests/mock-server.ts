// An isolated transport fixture. Never imports application DB or startup tasks.
Bun.serve({ hostname: "127.0.0.1", port: 5179,
  fetch(request, server) {
    const path = new URL(request.url).pathname;
    if (path === "/health") return new Response("ok");
    if (path === "/auth/me") return Response.json({ sub: "1", name: "Fixture Admin", email: "fixture@example.test", role: "admin", token_version: 0, iat: 0 });
    if (path === "/ws" && server.upgrade(request)) return;
    return Response.json({ message: "No fixture for this endpoint" }, { status: 503 });
  }, websocket: { open(ws) { ws.send(JSON.stringify({ type: "WS_READY", payload: {} })); }, message() {} },
});
