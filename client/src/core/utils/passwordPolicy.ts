import Swal from 'sweetalert2';

/**
 * Keep in sync with server/src/utils/passwordPolicy.js (MIN_LEN, MAX_LEN, regex rules).
 */
export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 20;

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,20}$/;

export function strongPasswordPolicyText(): string {
  return `Password must be ${PASSWORD_MIN_LEN} to ${PASSWORD_MAX_LEN} characters and include uppercase, lowercase, a number, and a special character.`;
}

/** Returns null if valid, otherwise the message to show the user. */
export function validateStrongPassword(plain: string): string | null {
  const s = String(plain || '');
  if (!STRONG_PASSWORD_REGEX.test(s)) {
    return strongPasswordPolicyText();
  }
  return null;
}

export async function showPasswordRequirementsAlert(
  message: string,
  title = 'Password requirements'
): Promise<void> {
  await Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'OK',
    width: 480,
    padding: '1.5rem',
    customClass: {
      popup: 'rounded-4 shadow',
      title: 'fw-semibold',
      confirmButton: 'btn btn-primary px-4 py-2 rounded-3',
      actions: 'mt-3',
    },
    buttonsStyling: false,
  });
}

export async function showPasswordSuccessAlert(text: string): Promise<void> {
  await Swal.fire({
    icon: 'success',
    title: 'Success',
    text,
    confirmButtonText: 'OK',
    timer: 4000,
    timerProgressBar: true,
    customClass: {
      popup: 'rounded-4 shadow',
      confirmButton: 'btn btn-primary px-4 py-2 rounded-3',
    },
    buttonsStyling: false,
  });
}
