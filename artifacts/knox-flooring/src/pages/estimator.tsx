import { useStore } from "@/hooks/use-store";
import EstimatorView from "@/components/estimating/EstimatorView";

export default function Estimator() {
  const store = useStore();
  return <EstimatorView store={store} />;
}
