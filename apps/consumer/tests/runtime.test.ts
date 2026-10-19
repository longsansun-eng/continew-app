import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticated, clearLocal, enterMerchant, request, restore, runtime } from '../src/platform/runtime'

const mocks = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@continew-app/core', () => ({ createRequestor: () => ({ request: mocks.call }) }))

const storage = new Map<string, string>()
beforeEach(() => {
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) })
  vi.stubGlobal('uni', { getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: string) => storage.set(key, value) })
  storage.clear()
  clearLocal()
  runtime.entry = { appCode: 'h5' }
  mocks.call.mockReset()
})
describe('consumer platform boundary', () => {
  it('unwraps Java response centrally', async () => {
    mocks.call.mockResolvedValue({ code: 200, data: { version: 'v1' } })
    expect(await request('/public/privacy')).toEqual({ version: 'v1' })
  })
  it('does not inject employee or merchant headers into public calls', async () => {
    runtime.merchant = { token: 'merchant', refreshToken: 'refresh' }
    mocks.call.mockResolvedValue({})
    await request('/public/privacy')
    expect(mocks.call.mock.calls[0]?.[1].header).toEqual({})
  })
  it('switching clears the previous merchant before a failed request', async () => {
    runtime.platform = { token: 'platform', refreshToken: 'refresh' }
    runtime.merchant = { token: 'old', refreshToken: 'old-refresh' }
    mocks.call.mockRejectedValue(new Error('entry disabled'))
    await expect(enterMerchant({ appCode: 'h5', entryCode: 'new-entry' })).rejects.toThrow('entry disabled')
    expect(runtime.merchant).toBeUndefined()
    expect(runtime.entry.entryCode).toBe('new-entry')
  })
  it('explicit merchant chooser does not silently re-enter the last merchant', async () => {
    runtime.platform = { token: 'platform', refreshToken: 'refresh' }
    runtime.merchant = { token: 'old', refreshToken: 'refresh' }
    await enterMerchant({ appCode: 'h5' })
    expect(runtime.merchant).toBeUndefined()
    expect(mocks.call).not.toHaveBeenCalled()
  })
  it('restores only current tab storage', async () => {
    await enterMerchant({ appCode: 'h5', tenantId: '12' })
    runtime.entry = { appCode: 'different-tab' }
    restore()
    expect(runtime.entry.tenantId).toBe('12')
  })
  it('concurrent unauthorized calls share one refresh', async () => {
    runtime.merchant = { token: 'old', refreshToken: 'refresh' }
    const unauthorized = Object.assign(new Error('expired'), { status: 401 })
    mocks.call.mockImplementation(async (path: string, config: { header?: { Authorization?: string } }) => {
      if (path === '/consumer/auth/refresh')
        return { token: 'new', refreshToken: 'rotated' }
      if (config.header?.Authorization === 'Bearer old')
        throw unauthorized
      return { success: true }
    })
    await Promise.all([authenticated('/me'), authenticated('/contacts')])
    expect(mocks.call.mock.calls.filter(call => call[0] === '/consumer/auth/refresh')).toHaveLength(1)
    expect(runtime.merchant.token).toBe('new')
  })
})
