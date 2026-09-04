import { useQueryClient } from "@tanstack/react-query";
import {
  useListJobs,
  useListMaterials,
  useListProposals,
  useListLeads,
  useGetSettings,
  useCreateJob,
  useUpdateJob as useUpdateJobMutation,
  useDeleteJob,
  useCreateProposal,
  useUpdateProposal,
  useConvertProposal,
  useCreateLead,
  useUpdateLead as useUpdateLeadMutation,
  useDeleteLead,
  useUpdateSettings as useUpdateSettingsMutation,
  useListJobPhotos,
  useCreateJobPhoto,
  useDeleteJobPhoto,
  useListSalespeople,
  useCreateSalesperson,
  useUpdateSalesperson,
  useDeleteSalesperson,
  useListInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useListJobMaterials,
  useCreateJobMaterial,
  useUpdateJobMaterial,
  useDeleteJobMaterial,
  useListLaborEntries,
  useCreateLaborEntry,
  useUpdateLaborEntry,
  useDeleteLaborEntry,
  useListMaterialUsage,
  useCreateMaterialUsage,
  useUpdateMaterialUsage,
  useDeleteMaterialUsage,
  useListCommunications,
  useSendEmail,
  useSendSms,
  useListMeasurements,
  useCreateMeasurement,
  useUpdateMeasurement,
  useDeleteMeasurement,
  useSyncMeasurements,
  useGetMeasureSquareStatus,
  getListMeasurementsQueryKey,
  getGetMeasureSquareStatusQueryKey,
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useGetGoogleCalendarStatus,
  useSyncGoogleCalendar,
  getListTasksQueryKey,
  getGetGoogleCalendarStatusQueryKey,
  getListCommunicationsQueryKey,
  getListJobsQueryKey,
  getListProposalsQueryKey,
  getListLeadsQueryKey,
  getGetSettingsQueryKey,
  getListJobPhotosQueryKey,
  getListSalespeopleQueryKey,
  getListInvoicesQueryKey,
  getListProductsQueryKey,
  getListJobMaterialsQueryKey,
  getListMaterialsQueryKey,
  getListLaborEntriesQueryKey,
  getListMaterialUsageQueryKey,
  type JobInput,
  type JobUpdate,
  type ProposalInput,
  type ProposalUpdate,
  type LeadInput,
  type LeadUpdate,
  type SettingsUpdate,
  type JobPhotoInput,
  type SalespersonInput,
  type SalespersonUpdate,
  type InvoiceInput,
  type InvoiceUpdate,
  type ProductInput,
  type ProductUpdate,
  type JobMaterialInput,
  type JobMaterialUpdate,
  type LaborEntryInput,
  type LaborEntryUpdate,
  type MaterialUsageInput,
  type MaterialUsageUpdate,
  type MeasurementInput,
  type MeasurementUpdate,
  type SyncMeasurementsRequest,
  type TaskInput,
  type TaskUpdate,
} from "@workspace/api-client-react";
import {
  Job,
  JobMaterial,
  JobPhoto,
  LaborEntry,
  MaterialRecord,
  MaterialUsage,
  Product,
  Proposal,
  Salesperson,
  Invoice,
  Lead,
  Settings,
  Communication,
  Measurement,
  MeasureSquareStatus,
  SyncMeasurementsResult,
  Task,
} from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  ownerName: "",
  ownerRole: "",
  companyName: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  defaultWasteFactor: 10,
  defaultLaborRateLVP: 2.5,
  defaultLaborRateHardwood: 4.0,
  defaultLaborRateCarpet: 1.5,
  defaultLaborRateTile: 5.0,
  commissionBasis: "Gross Profit",
  defaultCommissionRate: 5,
};

export function useStore() {
  const queryClient = useQueryClient();

  const jobsQuery = useListJobs();
  const materialsQuery = useListMaterials();
  const proposalsQuery = useListProposals();
  const leadsQuery = useListLeads();
  const settingsQuery = useGetSettings();
  const salespeopleQuery = useListSalespeople();
  const invoicesQuery = useListInvoices();
  const productsQuery = useListProducts();

  const createJobMutation = useCreateJob();
  const updateJobMutation = useUpdateJobMutation();
  const deleteJobMutation = useDeleteJob();
  const createProposalMutation = useCreateProposal();
  const updateProposalMutation = useUpdateProposal();
  const convertProposalMutation = useConvertProposal();
  const createLeadMutation = useCreateLead();
  const updateLeadMutation = useUpdateLeadMutation();
  const deleteLeadMutation = useDeleteLead();
  const updateSettingsMutation = useUpdateSettingsMutation();
  const createSalespersonMutation = useCreateSalesperson();
  const updateSalespersonMutation = useUpdateSalesperson();
  const deleteSalespersonMutation = useDeleteSalesperson();
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  const invalidateJobs = () =>
    queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
  const invalidateProposals = () =>
    queryClient.invalidateQueries({ queryKey: getListProposalsQueryKey() });
  const invalidateLeads = () =>
    queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
  const invalidateSettings = () =>
    queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  const invalidateSalespeople = () =>
    queryClient.invalidateQueries({ queryKey: getListSalespeopleQueryKey() });
  const invalidateInvoices = () =>
    queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
  const invalidateProducts = () =>
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });

  const addJob = async (
    jobData: Omit<
      Job,
      | "id"
      | "jobNumber"
      | "createdAt"
      | "updatedAt"
      | "stageHistory"
      | "shareToken"
    >,
  ): Promise<Job> => {
    const newJob = await createJobMutation.mutateAsync({
      data: jobData as JobInput,
    });
    await invalidateJobs();
    return newJob as Job;
  };

  const updateJob = async (id: string, updates: Partial<Job>): Promise<void> => {
    await updateJobMutation.mutateAsync({ id, data: updates as JobUpdate });
    await invalidateJobs();
  };

  const deleteJob = async (id: string): Promise<void> => {
    await deleteJobMutation.mutateAsync({ id });
    await invalidateJobs();
  };

  const addProposal = async (
    proposalData: Omit<
      Proposal,
      | "id"
      | "createdAt"
      | "shareToken"
      | "signature"
      | "sentAt"
      | "viewedAt"
      | "acceptedAt"
      | "declinedAt"
      | "convertedJobId"
      | "convertedInvoiceId"
      | "depositType"
      | "depositValue"
      | "paymentTerms"
    > &
      Partial<
        Pick<Proposal, "depositType" | "depositValue" | "paymentTerms">
      >,
  ): Promise<Proposal> => {
    const newProposal = await createProposalMutation.mutateAsync({
      data: proposalData as ProposalInput,
    });
    await invalidateProposals();
    return newProposal as Proposal;
  };

  const updateProposalStatus = async (
    id: string,
    status: Proposal["status"],
  ): Promise<void> => {
    await updateProposalMutation.mutateAsync({
      id,
      data: { status } as ProposalUpdate,
    });
    await invalidateProposals();
  };

  const updateProposal = async (
    id: string,
    updates: Partial<Proposal>,
  ): Promise<void> => {
    await updateProposalMutation.mutateAsync({
      id,
      data: updates as ProposalUpdate,
    });
    await invalidateProposals();
  };

  const convertProposal = async (id: string): Promise<Job> => {
    const result = await convertProposalMutation.mutateAsync({ id });
    await invalidateProposals();
    await invalidateJobs();
    await invalidateInvoices();
    await queryClient.invalidateQueries({
      queryKey: getListJobMaterialsQueryKey(result.job.id),
    });
    await queryClient.invalidateQueries({
      queryKey: getListMaterialsQueryKey(),
    });
    return result.job as Job;
  };

  const addLead = async (
    leadData: Omit<Lead, "id" | "createdAt" | "updatedAt">,
  ): Promise<Lead> => {
    const newLead = await createLeadMutation.mutateAsync({
      data: leadData as LeadInput,
    });
    await invalidateLeads();
    return newLead as Lead;
  };

  const updateLead = async (
    id: string,
    updates: Partial<Lead>,
  ): Promise<void> => {
    await updateLeadMutation.mutateAsync({ id, data: updates as LeadUpdate });
    await invalidateLeads();
  };

  const deleteLead = async (id: string): Promise<void> => {
    await deleteLeadMutation.mutateAsync({ id });
    await invalidateLeads();
  };

  const updateSettings = async (
    updates: Partial<Settings>,
  ): Promise<void> => {
    await updateSettingsMutation.mutateAsync({
      data: updates as SettingsUpdate,
    });
    await invalidateSettings();
  };

  const addSalesperson = async (
    data: Omit<Salesperson, "id" | "createdAt">,
  ): Promise<Salesperson> => {
    const created = await createSalespersonMutation.mutateAsync({
      data: data as SalespersonInput,
    });
    await invalidateSalespeople();
    return created as Salesperson;
  };

  const updateSalesperson = async (
    id: string,
    updates: Partial<Salesperson>,
  ): Promise<void> => {
    await updateSalespersonMutation.mutateAsync({
      id,
      data: updates as SalespersonUpdate,
    });
    await invalidateSalespeople();
  };

  const deleteSalesperson = async (id: string): Promise<void> => {
    await deleteSalespersonMutation.mutateAsync({ id });
    await invalidateSalespeople();
    await invalidateJobs();
  };

  const addInvoice = async (
    data: Omit<
      Invoice,
      | "id"
      | "invoiceNumber"
      | "subtotal"
      | "taxableAmount"
      | "taxAmount"
      | "discountAmount"
      | "total"
      | "paidAmount"
      | "balanceAmount"
      | "refundedAmount"
      | "taxCode"
      | "paymentReference"
      | "paidAt"
      | "createdAt"
      | "updatedAt"
    >,
  ): Promise<Invoice> => {
    const created = await createInvoiceMutation.mutateAsync({
      data: data as InvoiceInput,
    });
    await invalidateInvoices();
    return created as Invoice;
  };

  const updateInvoice = async (
    id: string,
    updates: Partial<Invoice>,
  ): Promise<void> => {
    await updateInvoiceMutation.mutateAsync({
      id,
      data: updates as InvoiceUpdate,
    });
    await invalidateInvoices();
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    await deleteInvoiceMutation.mutateAsync({ id });
    await invalidateInvoices();
  };

  const addProduct = async (
    data: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product> => {
    const created = await createProductMutation.mutateAsync({
      data: data as ProductInput,
    });
    await invalidateProducts();
    return created as Product;
  };

  const updateProduct = async (
    id: string,
    updates: Partial<Product>,
  ): Promise<void> => {
    await updateProductMutation.mutateAsync({
      id,
      data: updates as ProductUpdate,
    });
    await invalidateProducts();
  };

  const deleteProduct = async (id: string): Promise<void> => {
    await deleteProductMutation.mutateAsync({ id });
    await invalidateProducts();
  };

  return {
    jobs: (jobsQuery.data ?? []) as Job[],
    materials: (materialsQuery.data ?? []) as MaterialRecord[],
    proposals: (proposalsQuery.data ?? []) as Proposal[],
    leads: (leadsQuery.data ?? []) as Lead[],
    settings: (settingsQuery.data ?? DEFAULT_SETTINGS) as Settings,
    salespeople: (salespeopleQuery.data ?? []) as Salesperson[],
    invoices: (invoicesQuery.data ?? []) as Invoice[],
    products: (productsQuery.data ?? []) as Product[],
    addJob,
    updateJob,
    deleteJob,
    addProposal,
    updateProposalStatus,
    updateProposal,
    convertProposal,
    addLead,
    updateLead,
    deleteLead,
    updateSettings,
    addSalesperson,
    updateSalesperson,
    deleteSalesperson,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addProduct,
    updateProduct,
    deleteProduct,
  };
}

export function useJobPhotos(jobId: string) {
  const queryClient = useQueryClient();
  const photosQuery = useListJobPhotos(jobId, {
    query: {
      queryKey: getListJobPhotosQueryKey(jobId),
      enabled: Boolean(jobId),
    },
  });
  const createPhotoMutation = useCreateJobPhoto();
  const deletePhotoMutation = useDeleteJobPhoto();

  const invalidatePhotos = () =>
    queryClient.invalidateQueries({
      queryKey: getListJobPhotosQueryKey(jobId),
    });

  const addPhoto = async (
    photo: Omit<JobPhoto, "id" | "jobId" | "createdAt">,
  ): Promise<void> => {
    await createPhotoMutation.mutateAsync({
      id: jobId,
      data: photo as JobPhotoInput,
    });
    await invalidatePhotos();
  };

  const deletePhoto = async (photoId: string): Promise<void> => {
    await deletePhotoMutation.mutateAsync({ id: jobId, photoId });
    await invalidatePhotos();
  };

  return {
    photos: (photosQuery.data ?? []) as JobPhoto[],
    isLoading: photosQuery.isLoading,
    addPhoto,
    deletePhoto,
  };
}

export function useJobMaterials(jobId: string) {
  const queryClient = useQueryClient();
  const listQuery = useListJobMaterials(jobId, {
    query: {
      queryKey: getListJobMaterialsQueryKey(jobId),
      enabled: Boolean(jobId),
    },
  });
  const createMutation = useCreateJobMaterial();
  const updateMutation = useUpdateJobMaterial();
  const deleteMutation = useDeleteJobMaterial();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListJobMaterialsQueryKey(jobId),
    });

  const addMaterial = async (data: JobMaterialInput): Promise<void> => {
    await createMutation.mutateAsync({ id: jobId, data });
    await invalidate();
  };

  const updateMaterial = async (
    materialId: string,
    data: JobMaterialUpdate,
  ): Promise<void> => {
    await updateMutation.mutateAsync({ id: jobId, materialId, data });
    await invalidate();
  };

  const deleteMaterial = async (materialId: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id: jobId, materialId });
    await invalidate();
  };

  return {
    materials: (listQuery.data ?? []) as JobMaterial[],
    isLoading: listQuery.isLoading,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  };
}

export function useLaborEntries(jobId: string) {
  const queryClient = useQueryClient();
  const listQuery = useListLaborEntries(jobId, {
    query: {
      queryKey: getListLaborEntriesQueryKey(jobId),
      enabled: Boolean(jobId),
    },
  });
  const createMutation = useCreateLaborEntry();
  const updateMutation = useUpdateLaborEntry();
  const deleteMutation = useDeleteLaborEntry();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListLaborEntriesQueryKey(jobId),
    });

  const addEntry = async (data: LaborEntryInput): Promise<void> => {
    await createMutation.mutateAsync({ id: jobId, data });
    await invalidate();
  };

  const updateEntry = async (
    entryId: string,
    data: LaborEntryUpdate,
  ): Promise<void> => {
    await updateMutation.mutateAsync({ id: jobId, entryId, data });
    await invalidate();
  };

  const deleteEntry = async (entryId: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id: jobId, entryId });
    await invalidate();
  };

  return {
    entries: (listQuery.data ?? []) as LaborEntry[],
    isLoading: listQuery.isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}

export function useMaterialUsage(jobId: string) {
  const queryClient = useQueryClient();
  const listQuery = useListMaterialUsage(jobId, {
    query: {
      queryKey: getListMaterialUsageQueryKey(jobId),
      enabled: Boolean(jobId),
    },
  });
  const createMutation = useCreateMaterialUsage();
  const updateMutation = useUpdateMaterialUsage();
  const deleteMutation = useDeleteMaterialUsage();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListMaterialUsageQueryKey(jobId),
    });

  const addUsage = async (data: MaterialUsageInput): Promise<void> => {
    await createMutation.mutateAsync({ id: jobId, data });
    await invalidate();
  };

  const updateUsage = async (
    usageId: string,
    data: MaterialUsageUpdate,
  ): Promise<void> => {
    await updateMutation.mutateAsync({ id: jobId, usageId, data });
    await invalidate();
  };

  const deleteUsage = async (usageId: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id: jobId, usageId });
    await invalidate();
  };

  return {
    usage: (listQuery.data ?? []) as MaterialUsage[],
    isLoading: listQuery.isLoading,
    addUsage,
    updateUsage,
    deleteUsage,
  };
}

export function useTasks() {
  const queryClient = useQueryClient();
  const listQuery = useListTasks();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });

  const addTask = async (
    data: Omit<
      Task,
      "id" | "googleEventId" | "createdAt" | "updatedAt"
    >,
  ): Promise<Task> => {
    const created = await createMutation.mutateAsync({
      data: data as TaskInput,
    });
    await invalidate();
    return created as Task;
  };

  const updateTask = async (
    id: string,
    updates: Partial<Task>,
  ): Promise<void> => {
    await updateMutation.mutateAsync({ id, data: updates as TaskUpdate });
    await invalidate();
  };

  const deleteTask = async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id });
    await invalidate();
  };

  return {
    tasks: (listQuery.data ?? []) as Task[],
    isLoading: listQuery.isLoading,
    addTask,
    updateTask,
    deleteTask,
  };
}

export function useGoogleCalendar() {
  const queryClient = useQueryClient();
  const statusQuery = useGetGoogleCalendarStatus();
  const syncMutation = useSyncGoogleCalendar();

  const sync = async () => {
    const result = await syncMutation.mutateAsync();
    await queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    await queryClient.invalidateQueries({
      queryKey: getGetGoogleCalendarStatusQueryKey(),
    });
    return result;
  };

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isSyncing: syncMutation.isPending,
    sync,
  };
}

type CommunicationsFilter =
  | { leadId: string; customerKey?: undefined }
  | { customerKey: string; leadId?: undefined };

export function useCommunications(filter: CommunicationsFilter) {
  const queryClient = useQueryClient();
  const params =
    "leadId" in filter && filter.leadId
      ? { leadId: filter.leadId }
      : "customerKey" in filter && filter.customerKey
        ? { customerKey: filter.customerKey }
        : {};
  const enabled = Boolean(params.leadId || params.customerKey);

  const listQuery = useListCommunications(params, {
    query: {
      queryKey: getListCommunicationsQueryKey(params),
      enabled,
    },
  });
  const sendEmailMutation = useSendEmail();
  const sendSmsMutation = useSendSms();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListCommunicationsQueryKey(params),
    });

  const sendEmail = async (input: {
    to: string;
    subject: string;
    body: string;
    customerName?: string;
  }): Promise<Communication> => {
    const created = await sendEmailMutation.mutateAsync({
      data: { ...input, ...params },
    });
    await invalidate();
    return created as Communication;
  };

  const sendSms = async (input: {
    to: string;
    body: string;
    customerName?: string;
  }): Promise<Communication> => {
    const created = await sendSmsMutation.mutateAsync({
      data: { ...input, ...params },
    });
    await invalidate();
    return created as Communication;
  };

  return {
    communications: (listQuery.data ?? []) as Communication[],
    isLoading: listQuery.isLoading,
    sendEmail,
    sendSms,
  };
}

type MeasurementsFilter =
  | { leadId: string; jobId?: undefined }
  | { jobId: string; leadId?: undefined };

export function useMeasurements(filter: MeasurementsFilter) {
  const queryClient = useQueryClient();
  const params =
    "leadId" in filter && filter.leadId
      ? { leadId: filter.leadId }
      : "jobId" in filter && filter.jobId
        ? { jobId: filter.jobId }
        : {};
  const enabled = Boolean(params.leadId || params.jobId);

  const listQuery = useListMeasurements(params, {
    query: {
      queryKey: getListMeasurementsQueryKey(params),
      enabled,
    },
  });
  const createMutation = useCreateMeasurement();
  const updateMutation = useUpdateMeasurement();
  const deleteMutation = useDeleteMeasurement();
  const syncMutation = useSyncMeasurements();

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListMeasurementsQueryKey(params),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetMeasureSquareStatusQueryKey(),
      }),
    ]);

  const addMeasurement = async (
    input: Omit<MeasurementInput, "leadId" | "jobId">,
  ): Promise<Measurement> => {
    const created = await createMutation.mutateAsync({
      data: { ...input, ...params },
    });
    await invalidate();
    return created as Measurement;
  };

  const updateMeasurement = async (
    id: string,
    input: MeasurementUpdate,
  ): Promise<Measurement> => {
    const updated = await updateMutation.mutateAsync({ id, data: input });
    await invalidate();
    return updated as Measurement;
  };

  const removeMeasurement = async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id });
    await invalidate();
  };

  const sync = async (): Promise<SyncMeasurementsResult> => {
    const data: SyncMeasurementsRequest = { ...params };
    const result = await syncMutation.mutateAsync({ data });
    await invalidate();
    return result as SyncMeasurementsResult;
  };

  return {
    measurements: (listQuery.data ?? []) as Measurement[],
    isLoading: listQuery.isLoading,
    addMeasurement,
    updateMeasurement,
    removeMeasurement,
    sync,
    isSyncing: syncMutation.isPending,
  };
}

export function useMeasureSquareStatus() {
  const statusQuery = useGetMeasureSquareStatus({
    query: { queryKey: getGetMeasureSquareStatusQueryKey() },
  });
  return {
    status: statusQuery.data as MeasureSquareStatus | undefined,
    isLoading: statusQuery.isLoading,
  };
}
