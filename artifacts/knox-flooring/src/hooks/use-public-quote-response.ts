import { useEffect, useRef, useState } from "react";
import {
  useAcceptPublicQuote,
  useDeclinePublicQuote,
} from "@workspace/api-client-react";

/** A response is bound to the version displayed, never a version fetched after signing. */
export function usePublicQuoteResponse(
  token: string,
  revision: number | undefined,
  refresh: () => Promise<unknown>,
) {
  const acceptMutation = useAcceptPublicQuote();
  const declineMutation = useDeclinePublicQuote();
  const [fullName, setFullName] = useState("");
  const version = revision === undefined ? null : `${token}:${revision}`;
  const [agreementVersion, setAgreementVersion] = useState<string | null>(null);
  const agreed = version !== null && agreementVersion === version;
  const setAgreed = (value: boolean) =>
    setAgreementVersion(value ? version : null);
  const [error, setError] = useState<string | null>(null);
  const [termsChanged, setTermsChanged] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const previousRevision = useRef(version);
  useEffect(() => {
    if (
      previousRevision.current !== null &&
      version !== previousRevision.current
    ) {
      setAgreed(false);
    }
    previousRevision.current = version;
  }, [version]);
  async function respond(kind: "accept" | "decline") {
    if (
      inFlight.current ||
      acceptMutation.isPending ||
      declineMutation.isPending ||
      refreshing ||
      termsChanged ||
      revision === undefined
    )
      return;
    setError(null);
    if (kind === "accept" && !fullName.trim()) {
      setError("Please type your full name to sign.");
      return;
    }
    if (kind === "accept" && !agreed) {
      setError(
        "Please check the box after reviewing this quote and its terms.",
      );
      return;
    }
    let saved = false;
    inFlight.current = true;
    try {
      if (kind === "accept")
        await acceptMutation.mutateAsync({
          token,
          data: { signature: fullName.trim(), revision },
        });
      else await declineMutation.mutateAsync({ token, data: { revision } });
      saved = true;
      await refresh();
    } catch (failure) {
      if (saved) {
        setTermsChanged(true);
        setAgreed(false);
        setError(
          "Your response was saved, but the latest status could not be loaded. Refresh to see it.",
        );
      } else if ((failure as { status?: number })?.status === 409) {
        setTermsChanged(true);
        setAgreed(false);
        setError(
          "This quote changed since you opened it. Your name is retained. Refresh the terms and review them before responding.",
        );
      } else
        setError(
          "Your response could not be saved. Your input is retained; please try again.",
        );
    } finally {
      inFlight.current = false;
    }
  }
  async function refreshTerms() {
    if (
      inFlight.current ||
      acceptMutation.isPending ||
      declineMutation.isPending
    )
      return;
    inFlight.current = true;
    setRefreshing(true);
    setAgreed(false);
    try {
      await refresh();
      setTermsChanged(false);
      setError(
        "The quote has been refreshed. Review its current pricing and terms before responding.",
      );
    } catch {
      setError(
        "The current quote could not be loaded. Your input is retained; please try refreshing again.",
      );
    } finally {
      setRefreshing(false);
      inFlight.current = false;
    }
  }
  return {
    fullName,
    setFullName,
    agreed,
    setAgreed,
    error,
    termsChanged,
    refreshing,
    submitting:
      acceptMutation.isPending || declineMutation.isPending || refreshing,
    accepting: acceptMutation.isPending,
    declining: declineMutation.isPending,
    handleAccept: () => respond("accept"),
    handleDecline: () => respond("decline"),
    refreshTerms,
  };
}
