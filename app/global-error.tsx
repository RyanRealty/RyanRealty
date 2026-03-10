"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            maxWidth: "32rem",
            margin: "0 auto",
            padding: "2rem 1rem",
            textAlign: "center",
            color: "var(--text-primary, #18181b)",
            backgroundColor: "var(--brand-cream, #f0eeec)",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              color: "var(--brand-navy, #102742)",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              color: "var(--text-secondary, #52525b)",
            }}
          >
            We’ve been notified and are looking into it. Please try again.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--brand-navy, #102742)",
              backgroundColor: "white",
              border: "1px solid var(--border, #e4e4e7)",
              borderRadius: "var(--radius-md, 0.75rem)",
              textDecoration: "none",
            }}
          >
            Back to home
          </a>
        </main>
      </body>
    </html>
  );
}
