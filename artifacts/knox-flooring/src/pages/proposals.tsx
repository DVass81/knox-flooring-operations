import { useStore } from "@/hooks/use-store";
import ProposalReviewView from "@/components/estimating/ProposalReviewView";

export default function Proposals() {
  const store = useStore();
  return <ProposalReviewView store={store} />;
}
