import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  accept: vi.fn(),
  decline: vi.fn(),
  refresh: vi.fn(),
  failed: false,
  noData: false,
}));
const quote = {
  revision: 1,
  shareToken: "quote-token",
  customerName: "Test Customer",
  projectLocation: "Knoxville",
  flooringType: "Tile",
  roomList: [],
  totalSqFt: 100,
  scopeOfWork: "Reviewed scope",
  estimatedPrice: 1000,
  expectedTimeline: "To confirm",
  materialAssumptions: "Reviewed materials",
  exclusions: "",
  warrantyNote: "",
  depositType: "none",
  depositValue: 0,
  depositAmount: 0,
  paymentTerms: "",
  status: "Viewed",
  signature: "",
  lineItems: [],
  company: {
    companyName: "Test Flooring",
    customerAccentColor: "#7B00F5",
    address: "",
    phone: "",
    email: "",
    website: "",
  },
};
vi.mock("wouter", () => ({ useParams: () => ({ token: "public-token" }) }));
vi.mock("@/components/jobs/StagePhotos", () => ({
  photoSrc: (path: string) => path,
}));
vi.mock("@workspace/api-client-react", () => ({
  useGetPublicQuote: () => ({
    data: mocks.noData ? undefined : quote,
    isLoading: false,
    isError: mocks.failed,
    error: mocks.failed ? { status: 503 } : null,
    refetch: mocks.refresh,
  }),
  getGetPublicQuoteQueryKey: () => ["public-quote"],
  useGetPublicJob: () => ({
    data: mocks.noData
      ? undefined
      : {
          jobNumber: "J-1",
          customerName: quote.customerName,
          address: "",
          city: "Knoxville",
          flooringType: "Tile",
          crewAssigned: "Unassigned",
          squareFootage: 100,
          status: "Proposal Sent",
          stageHistory: [],
          photos: [],
          invoices: [],
          quote,
          company: quote.company,
        },
    isLoading: false,
    isError: mocks.failed,
    error: mocks.failed ? { status: 503 } : null,
    refetch: mocks.refresh,
  }),
  getGetPublicJobQueryKey: () => ["public-job"],
  useAcceptPublicQuote: () => ({ mutateAsync: mocks.accept, isPending: false }),
  useDeclinePublicQuote: () => ({
    mutateAsync: mocks.decline,
    isPending: false,
  }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ refetchQueries: mocks.refresh }),
}));
import PublicQuote from "./public-quote";
import PublicStatus from "./public-status";
beforeEach(() => {
  mocks.failed = false;
  mocks.noData = false;
  mocks.accept.mockReset();
  mocks.decline.mockReset();
  mocks.refresh.mockReset();
});
afterEach(cleanup);

describe("loaded public quote refresh failures", () => {
  it.each(["quote", "portal"])(
    "keeps %s signature input visible and responses blocked after a failed refresh",
    async (kind) => {
      mocks.accept.mockRejectedValue({ status: 409 });
      mocks.refresh.mockImplementation(async () => {
        mocks.failed = true;
        throw { status: 503 };
      });
      const Component = kind === "quote" ? PublicQuote : PublicStatus;
      const view = render(<Component />);
      if (kind === "portal")
        fireEvent.mouseDown(screen.getByRole("tab", { name: "Quote" }), {
          button: 0,
          ctrlKey: false,
        });
      fireEvent.change(
        await screen.findByLabelText("Type your full name to sign"),
        { target: { value: "Retained Customer" } },
      );
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "I have reviewed and accept this quote and its terms.",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Accept & Sign Quote" }),
      );
      await screen.findByText(/This quote changed since you opened it/);
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh current terms" }),
      );
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      view.rerender(<Component />);
      expect(
        await screen.findByText(/The current quote could not be loaded/),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Type your full name to sign")).toHaveValue(
        "Retained Customer",
      );
      expect(
        screen.getByRole("button", { name: "Accept & Sign Quote" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Refresh current terms" }),
      ).toBeEnabled();
    },
  );
  it.each(["quote", "portal"])(
    "shows the initial %s load error when there is no saved display data",
    (kind) => {
      mocks.failed = true;
      mocks.noData = true;
      render(kind === "quote" ? <PublicQuote /> : <PublicStatus />);
      expect(
        screen.getByRole("heading", {
          name:
            kind === "quote"
              ? "Quote could not load"
              : "Project could not load",
        }),
      ).toBeInTheDocument();
    },
  );
});
