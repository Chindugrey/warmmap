"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const result = await signIn("email", {
        email: email.trim(),
        callbackUrl: "/me",
        redirect: false,
      });
      if (result?.error) {
        setStatus("error");
      } else {
        setStatus("sent");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="page chapter" style={{ maxWidth: 480 }}>
      <p className="kicker">Sign in</p>
      <h1>Welcome back</h1>
      <p>
        We&apos;ll send you a magic link. No password needed.
      </p>

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ marginTop: 20 }}
      >
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button
          className="btn"
          type="submit"
          disabled={status === "loading"}
          style={{ alignSelf: "flex-start" }}
        >
          {status === "loading" ? "Sending…" : "Send magic link"}
        </button>
        {status === "sent" && (
          <p className="note" role="status">
            Check your inbox for the sign-in link.
          </p>
        )}
        {status === "error" && (
          <p className="note" role="status">
            Couldn&apos;t send the link. Please try again.
          </p>
        )}
      </form>
    </main>
  );
}
