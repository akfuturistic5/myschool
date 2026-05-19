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
  error: (title: string, timer = 3500) =>
    Swal.fire({ ...base, icon: 'error', title, timer }),
  info: (title: string, timer = 2500) =>
    Swal.fire({ ...base, icon: 'info', title, timer }),
};
