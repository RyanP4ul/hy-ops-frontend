import { useAuthStore } from "@/stores/auth-store";

export async function loadUser() {
  const { setUser, setLoading } = useAuthStore.getState();

  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      console.error("Failed to load user:", res.statusText);
      setUser(null);
      return;
    }

    const user = await res.json();

    console.log("Loaded user:", user);

    setUser(user);
  } finally {
    console.log("Finished loading user");
    setLoading(false);
  }
}
