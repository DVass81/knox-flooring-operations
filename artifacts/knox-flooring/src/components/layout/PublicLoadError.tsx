import { Button } from "@/components/ui/button";

export function PublicLoadError({
  label,
  error,
  retry,
}: {
  label: string;
  error: unknown;
  retry: () => unknown;
}) {
  const status =
    error && typeof error === "object" && "status" in error
      ? error.status
      : undefined;
  const unavailable = status === 404 || status === 410 || !error;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <h1 className="text-2xl font-semibold">
        {unavailable
          ? `${label} not found`
          : offline
            ? "You're offline"
            : `${label} could not load`}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {unavailable
          ? "This link is unavailable. Please contact your flooring team for an updated link."
          : offline
            ? "Reconnect to the internet, then try again."
            : "Please try again. If the problem continues, contact your flooring team."}
      </p>
      {!unavailable && (
        <Button className="mt-5" variant="outline" onClick={() => retry()}>
          Try again
        </Button>
      )}
    </div>
  );
}
