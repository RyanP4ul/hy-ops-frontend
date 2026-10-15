"use client";

import { DialogMode } from "@/types/dialog";
import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useReducer,
} from "react";
import { Dialog } from "../ui/dialog";

type ModalState = {
  mode: DialogMode;
  title: string;
  description: string;
  action: string;
  isOpen: boolean;
};

type ModalAction =
  | {
      type: "OPEN";
      mode: DialogMode;
      title: string;
      description: string;
      action: string;
    }
  | {
      type: "CLOSE";
    };

type ContextType = {
  state: ModalState;
  dispatch: Dispatch<ModalAction>;
  openModal: (
    mode: DialogMode,
    config: {
      title: string;
      description: string;
      action: string;
    },
  ) => void;
  closeModal: () => void;
};

const initialState: ModalState = {
  mode: DialogMode.DEFAULT,
  title: "",
  description: "",
  action: "",
  isOpen: false,
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "OPEN":
      return {
        mode: action.mode,
        title: action.title,
        description: action.description,
        action: action.action,
        isOpen: true,
      };
    case "CLOSE":
      return initialState;
    default:
      return state;
  }
}

export const ModalContext = createContext<ContextType | null>(null);

export function useModal() {
  const context = useContext(ModalContext);

  if (!context) {
    throw new Error("useModal must be used inside ModalProvider");
  }

  return context;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(modalReducer, initialState);

  const openModal = (
    mode: DialogMode,
    config: {
      title: string;
      description: string;
      action: string;
    },
  ) => {
    dispatch({
      type: "OPEN",
      mode,
      ...config,
    });
  };

  const closeModal = () => {
    dispatch({
      type: "CLOSE",
    });
  };

  const value: ContextType = {
    state,
    dispatch,
    openModal,
    closeModal,
  };

  return (
    <ModalContext.Provider value={value}>
      <Dialog
        open={state.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeModal();
          }
        }}
      >
        {children}
      </Dialog>
    </ModalContext.Provider>
  );
}
