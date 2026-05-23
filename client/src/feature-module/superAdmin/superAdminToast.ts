import Swal from 'sweetalert2';

const base = {
  toast: true as const,
  position: 'top-end' as const,
  showConfirmButton: false,
  timerProgressBar: true,
};

export const superAdminToast = {
  success: (title: string, timer = 2500) =>
    Swal.fire({ ...base, icon: 'success', title, timer }),
  /** Centered modal — validation / failure messages (readable body text) */
  error: (message: string) =>
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      position: 'center',
      showConfirmButton: true,
      confirmButtonText: 'OK',
      focusConfirm: true,
      width: 'min(32rem, 92vw)',
      customClass: {
        popup: 'sa-superadmin-error-modal',
        title: 'sa-superadmin-error-modal__title',
        htmlContainer: 'sa-superadmin-error-modal__text',
        confirmButton: 'btn btn-primary px-4',
      },
    }),
  info: (title: string, timer = 2500) =>
    Swal.fire({ ...base, icon: 'info', title, timer }),
};
