export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
  requirements: PasswordRequirement[];
}

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "12345678901",
  "admin123",
  "admin123!",
  "changeme",
  "football",
  "iloveyou",
  "letmein",
  "monkey123",
  "password",
  "password1",
  "password!",
  "password123",
  "password123!",
  "passw0rd",
  "princess",
  "qwerty123",
  "qwertyuiop",
  "welcome1",
]);

export function getPasswordRequirements(
  password: string,
): PasswordRequirement[] {
  const normalized = password.toLowerCase();

  return [
    {
      id: "length",
      label: "At least 10 characters",
      met: password.length >= 10,
    },
    {
      id: "uppercase",
      label: "At least one uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "At least one lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "At least one number",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "At least one special character",
      met: /[^A-Za-z0-9]/.test(password),
    },
    {
      id: "common",
      label: "Not a common password",
      met: password.length > 0 && !COMMON_PASSWORDS.has(normalized),
    },
  ];
}

export function validatePassword(password: string): PasswordValidation {
  const requirements = getPasswordRequirements(password);
  const errors = requirements
    .filter((requirement) => !requirement.met)
    .map((requirement) => requirement.label);

  return {
    valid: errors.length === 0,
    errors,
    requirements,
  };
}
