const TOKEN_KEY = 'codepilot.auth.token'
const EMAIL_KEY = 'codepilot.auth.email'
const MACHINE_NAME_KEY = 'codepilot.machine.name'
const FIRST_LAUNCH_KEY = 'codepilot.machine.firstLaunchSeen'

export const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  getEmail: () => localStorage.getItem(EMAIL_KEY),
  setEmail: (email: string) => localStorage.setItem(EMAIL_KEY, email),
  clearEmail: () => localStorage.removeItem(EMAIL_KEY),

  getMachineName: () => localStorage.getItem(MACHINE_NAME_KEY),
  setMachineName: (name: string) => localStorage.setItem(MACHINE_NAME_KEY, name),
  clearMachineName: () => localStorage.removeItem(MACHINE_NAME_KEY),

  hasSeenFirstLaunchNotice: () => localStorage.getItem(FIRST_LAUNCH_KEY) === 'true',
  markFirstLaunchNoticeSeen: () => localStorage.setItem(FIRST_LAUNCH_KEY, 'true'),
}
