export const FIRST_USER_PASSWORD_REQUIREMENTS = [
  { id: 'minLength', message: 'Password must be at least 8 characters long.' },
  { id: 'uppercase', message: 'Password must include at least one uppercase letter.' },
  { id: 'lowercase', message: 'Password must include at least one lowercase letter.' },
  { id: 'number', message: 'Password must include at least one number.' },
  { id: 'special', message: 'Password must include at least one special character.' },
] as const

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface FirstUserInput {
  name: string
  email: string
  password: string
  workspaceName?: string
}

export interface NormalizedFirstUserInput {
  name: string
  email: string
  password: string
  workspaceName: string
}

export function getPasswordValidationErrors(password: string): string[] {
  const errors: string[] = []

  if (password.length < 8) errors.push(FIRST_USER_PASSWORD_REQUIREMENTS[0].message)
  if (!/[A-Z]/.test(password)) errors.push(FIRST_USER_PASSWORD_REQUIREMENTS[1].message)
  if (!/[a-z]/.test(password)) errors.push(FIRST_USER_PASSWORD_REQUIREMENTS[2].message)
  if (!/[0-9]/.test(password)) errors.push(FIRST_USER_PASSWORD_REQUIREMENTS[3].message)
  if (!/[#?!@$%^&*-]/.test(password)) errors.push(FIRST_USER_PASSWORD_REQUIREMENTS[4].message)

  return errors
}

export function normalizeFirstUserInput(input: FirstUserInput): NormalizedFirstUserInput {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const workspaceName = input.workspaceName?.trim() || `${name || 'My'} Workspace`

  return {
    name,
    email,
    password: input.password,
    workspaceName,
  }
}

export function validateFirstUserInput(input: FirstUserInput): {
  valid: boolean
  errors: string[]
  value: NormalizedFirstUserInput
} {
  const value = normalizeFirstUserInput(input)
  const errors: string[] = []

  if (!value.name) errors.push('Full name is required.')
  if (value.name.length > 120) errors.push('Full name must be 120 characters or fewer.')
  if (!EMAIL_REGEX.test(value.email)) errors.push('Please enter a valid email address.')
  if (value.workspaceName.length > 120) {
    errors.push('Workspace name must be 120 characters or fewer.')
  }

  errors.push(...getPasswordValidationErrors(value.password))

  return {
    valid: errors.length === 0,
    errors,
    value,
  }
}
