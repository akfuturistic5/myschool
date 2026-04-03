import Swal from "sweetalert2";

const DEPLOY_HINT =
  "If this continues after a code change: confirm the API was deployed (push → commit → deploy), CORS/session are correct, then hard-refresh the app.";

export async function alertLogoUploadError(err: unknown): Promise<void> {
  const e = err as Error & { status?: number };
  const msg = (e?.message || "Failed to upload school logo").trim();
  const status = e?.status ?? 0;
  const showDeploy =
    status >= 500 || /registry|platform|sync|deploy|configuration|session/i.test(msg);
  await Swal.fire({
    icon: "error",
    title: "Logo not saved",
    html: showDeploy
      ? `<p class="text-start mb-0">${escapeHtml(msg)}</p><p class="text-start small text-body-secondary mt-3 mb-0">${escapeHtml(
          DEPLOY_HINT
        )}</p>`
      : `<p class="text-start mb-0">${escapeHtml(msg)}</p>`,
  });
}

export async function alertLogoUploadSuccess(): Promise<void> {
  await Swal.fire({
    icon: "success",
    title: "Logo saved",
    text: "Your school logo was updated. It will show in the header and sidebar.",
    timer: 2800,
    showConfirmButton: true,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
