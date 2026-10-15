import { create } from "zustand";

type ConnectionState = {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;

  setConnected: (value: boolean) => void;
  setConnecting: (value: boolean) => void;
  setReconnecting: (value: boolean) => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  connecting: false,
  reconnecting: false,

  setConnected: (connected) =>
    set({
      connected,
      connecting: false,
      reconnecting: false,
    }),

  setConnecting: (connecting) =>
    set({
      connecting,
    }),

  setReconnecting: (reconnecting) =>
    set({
      reconnecting,
    }),
}));
