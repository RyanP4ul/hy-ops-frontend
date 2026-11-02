import { useAuthStore } from "@/stores/auth-store";

const logUserLoadError = (statusText: string) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("Failed to load user:", statusText);
  }
};

export async function loadUser() {
  const { setUser, setLoading } = useAuthStore.getState();

  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      logUserLoadError(res.statusText);
      setUser(null);
      return;
    }

    const user = await res.json();

    setUser(user);
  } finally {
    setLoading(false);
  }
}
