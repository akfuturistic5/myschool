import { useCallback, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { apiService } from "../services/apiService";
import { patchAuthUser, selectUser } from "../data/redux/authSlice";
import { alertLogoUploadError, alertLogoUploadSuccess } from "../utils/schoolLogoUploadAlerts";
import { isHeadmasterRole } from "../utils/roleUtils";

function isUserHeadmaster(user: ReturnType<typeof selectUser>): boolean {
  return isHeadmasterRole(user);
}

/**
 * Headmaster (Admin) can upload a new school logo from anywhere this hook is used.
 * Syncs tenant profile + master_db.schools.logo on the server; refreshes Redux school_logo.
 */
export function useSchoolLogoUpload() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isHeadmaster = isUserHeadmaster(user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const openFilePicker = useCallback(() => {
    if (!isHeadmaster || uploading) return;
    inputRef.current?.click();
  }, [isHeadmaster, uploading]);

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isHeadmaster) return;
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const uploadRes = await apiService.uploadSchoolLogo(file);
        const fromUpload = (uploadRes as { data?: { logo_url?: string } })?.data?.logo_url;
        try {
          const me = await apiService.getMe();
          if (me?.status === "SUCCESS" && me.data && me.data.school_logo !== undefined) {
            dispatch(patchAuthUser({ school_logo: me.data.school_logo ?? null }));
          } else if (fromUpload) {
            dispatch(patchAuthUser({ school_logo: fromUpload }));
          }
        } catch {
          if (fromUpload) {
            dispatch(patchAuthUser({ school_logo: fromUpload }));
          }
        }
        await alertLogoUploadSuccess();
      } catch (err) {
        await alertLogoUploadError(err);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [dispatch, isHeadmaster]
  );

  return {
    isHeadmaster,
    uploading,
    inputRef,
    openFilePicker,
    onFileChange,
  };
}
