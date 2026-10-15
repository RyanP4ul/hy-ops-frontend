"use client";

import { Button } from "@/components/ui/button";
import React from "react";

export default function Page() {
  const [response, setResponse] = React.useState(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await fetch("https://api.httpsms.com/v1/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":
          "pk_ILutncazggAidtzLxfy16M4Vd4BGTIOJDm6RFLUuEMHfuS2FfZbtmCnOjW6MD-Z1",
      },
      body: JSON.stringify({
        from: "+639482734769",
        to: "+639482734769",
        content: "Hello, this is a test message from the frontend!",
        // send_at: "2024-06-01T12:00:00Z",
      }),
    });

    setResponse(await result.json());
  }
  return (
    <>
      {response && (
        <div>
          <h2>Response:</h2>
          <p>{JSON.stringify(response)}</p>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <Button type="submit" variant="outline">
          Update SMS Settings
        </Button>
      </form>
    </>
  );
}
