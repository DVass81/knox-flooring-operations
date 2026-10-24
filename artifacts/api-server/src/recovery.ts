// This entry cannot enable writes through an accidental deployment environment override.
process.env.READ_ONLY_RECOVERY = "true";
process.env.BACKGROUND_WORKERS_ENABLED = "false";
process.env.DEMO_ACCESS_ENABLED = "false";
await import("./index");
export {};
