import "server-only";
import { MonitorError } from "@waverti/monitoring";
import { apiError, handleApiError } from "./api";

export function monitorError(err: unknown): Response {
  if (err instanceof MonitorError) return apiError(err.status, err.code, err.message);
  return handleApiError(err);
}
