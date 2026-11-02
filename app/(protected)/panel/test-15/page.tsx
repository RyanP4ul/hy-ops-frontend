"use client";

import { useState } from "react";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadImage() {
    if (!file) {
      setMessage("Please select an image.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cloudflare/r2/images", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Upload failed.");
      }

      setMessage(`Uploaded successfully: ${result.data.key}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <button type="button" disabled={!file || loading} onClick={uploadImage}>
        {loading ? "Uploading..." : "Upload image"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}
