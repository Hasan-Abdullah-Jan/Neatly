const ERROR_LOG_KEY = 'neatly-client-errors-v1'
const MAX_ERRORS = 20

export interface ClientErrorRecord {
  occurredAt: string
  name: string
}

export function reportClientError(error: Error): void {
  const record: ClientErrorRecord = {
    occurredAt: new Date().toISOString(),
    name: error.name.slice(0, 80),
  }

  try {
    const previous = JSON.parse(sessionStorage.getItem(ERROR_LOG_KEY) ?? '[]') as unknown
    const records = Array.isArray(previous) ? previous as ClientErrorRecord[] : []
    sessionStorage.setItem(ERROR_LOG_KEY, JSON.stringify([...records.slice(-(MAX_ERRORS - 1)), record]))
  } catch (storageError) {
    console.warn('Could not save the device-local error diagnostic.', storageError)
  }
}
