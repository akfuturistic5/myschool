import { apiService } from "../services/apiService";

export type CheckUserUniqueParams = {
  mobile?: string;
  email?: string;
  excludeId?: number | null;
};

export type CheckUserUniqueResult = {
  mobileExists: boolean;
  emailExists: boolean;
  status?: string;
};

/**
 * Reusable active-user uniqueness check (mobile digits + email).
 * Use for Add/Edit Parent, teachers, admin users, etc.
 */
export async function checkUserUnique(params: CheckUserUniqueParams): Promise<CheckUserUniqueResult> {
  const res = await apiService.checkUserUnique(params);
  const d = (res as { data?: CheckUserUniqueResult })?.data ?? res;
  return {
    mobileExists: Boolean((d as CheckUserUniqueResult)?.mobileExists),
    emailExists: Boolean((d as CheckUserUniqueResult)?.emailExists),
    status: (d as { status?: string })?.status,
  };
}
