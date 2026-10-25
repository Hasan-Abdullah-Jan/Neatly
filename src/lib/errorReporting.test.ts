import { beforeEach, describe, expect, it } from 'vitest'
import { reportClientError } from './errorReporting'

describe('device-local error reporting', () => {
  beforeEach(() => sessionStorage.clear())

  it('stores only error type and time locally, not message or stack', () => {
    const error = new Error('private user text')
    error.stack = 'private stack'
    reportClientError(error)
    const saved = sessionStorage.getItem('neatly-client-errors-v1')
    expect(saved).toContain('"name":"Error"')
    expect(saved).not.toContain('private user text')
    expect(saved).not.toContain('private stack')
  })
})
