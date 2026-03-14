"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="m-0">
        <main className="mx-auto max-w-sm px-4 py-16 text-center text-foreground bg-secondary min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-xl font-semibold text-primary">
            Something went wrong
          </h1>
          <p className="mt-2 text-muted-foreground">
            We’ve been notified and are looking into it. Please try again.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-card px-4 py-2 text-sm font-medium text-primary border border-border hover:bg-muted"
          >
            Back to home
          </a>
        </main>
      </body>
    </html>
  );
}
