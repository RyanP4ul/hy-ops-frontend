let socket: WebSocket | null = null;

export function connectWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return socket;
  }

  socket = new WebSocket("http://localhost:5173/ws");

  socket.onopen = () => {
    console.log("Connected");
  };

  socket.onmessage = (event) => {
    console.log(JSON.parse(event.data));
  };

  socket.onclose = () => {
    console.log("Disconnected");
  };

  socket.onerror = (err) => {
    console.error(err);
  };

  return socket;
}
