import type { ApiResponse } from "@shared/schema";

export function apiResponse<T>(draws: any[], data: T): ApiResponse<T> {
  return {
    ok: true,
    meta: {
      drawsUsed: draws.length,
      modernFormatOnly: true,
      generatedAt: new Date().toISOString(),
    },
    data,
  };
}
