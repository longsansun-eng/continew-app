import type { RequestConfig } from '@continew-app/core'
import { createRequestor } from '@continew-app/core'
import { reactive } from 'vue'

export interface Entry {
  appCode: string
  entryCode?: string
  tenantId?: string
}
export interface Context { appCode: string, tenantId: string, channel: string, entryCode?: string }
export interface Pair { token: string, refreshToken: string }
interface AuthResult { platform?: Pair, merchant: Pair, context: Context }
interface Envelope<T> { code: number, data: T, message?: string }
interface SavedSession { platform?: Pair, merchant?: Pair, context?: Context, entry: Entry }
let selectedAppCode = import.meta.env.VITE_CONSUMER_H5_APP_CODE ?? import.meta.env.VITE_CONSUMER_APP_CODE ?? ''
// #ifdef MP-WEIXIN
selectedAppCode = import.meta.env.VITE_CONSUMER_MINI_APP_CODE ?? ''
// #endif
export const configuredAppCode = selectedAppCode
export const runtime = reactive<SavedSession>({ entry: { appCode: configuredAppCode } })
let generation = 0
// H5只使用当前标签页sessionStorage；两个商户标签页不共享可变令牌。
const cacheKey = 'consumer.foundation.session'
export function persist() {
  // #ifdef H5
  sessionStorage.setItem(cacheKey, JSON.stringify(runtime))
  // #endif
  // #ifdef MP-WEIXIN
  uni.setStorageSync(cacheKey, JSON.stringify(runtime))
  // #endif
}
export function restore() {
  let raw: string | null = null
  // #ifdef H5
  raw = sessionStorage.getItem(cacheKey)
  // #endif
  // #ifdef MP-WEIXIN
  raw = uni.getStorageSync(cacheKey) || null
  // #endif
  if (raw) {
    try {
      Object.assign(runtime, JSON.parse(raw))
    }
    catch {
      clearLocal()
    }
  }
}
export function clearLocal() {
  generation++
  runtime.platform = undefined
  runtime.merchant = undefined
  runtime.context = undefined
  persist()
}
const client = createRequestor({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '', toastOnError: false })
export async function request<T>(path: string, config: RequestConfig = {}, scope: 'MERCHANT' | 'PLATFORM' | 'PUBLIC' = 'PUBLIC'): Promise<T> {
  const pair = scope === 'MERCHANT' ? runtime.merchant : scope === 'PLATFORM' ? runtime.platform : undefined
  const header = { ...config.header, ...(pair ? { Authorization: `Bearer ${pair.token}` } : {}) }
  const before = generation
  const result = await client.request<T | Envelope<T>>(`/consumer${path}`, { ...config, header })
  if (scope !== 'PUBLIC' && before !== generation)
    throw new Error('商户或登录状态已变化，请重新加载')
  if (result && typeof result === 'object' && 'code' in result && 'data' in result)
    return (result as Envelope<T>).data
  return result as T
}
let refreshing: Promise<void> | undefined
export async function authenticated<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const current = generation
  try {
    return await request<T>(path, config, 'MERCHANT')
  }
  catch (error) {
    if (current !== generation || !(error instanceof Error) || !('status' in error) || error.status !== 401 || !runtime.merchant)
      throw error
    refreshing ??= request<Pair>('/auth/refresh', { method: 'POST', body: { refreshToken: runtime.merchant.refreshToken } })
      .then((pair) => {
        if (current !== generation)
          throw new Error('商户选择已变化')
        runtime.merchant = pair
        persist()
      })
      .catch((cause: unknown) => {
        if (current === generation)
          clearLocal()
        throw cause
      })
      .finally(() => { refreshing = undefined })
    await refreshing
    return request<T>(path, config, 'MERCHANT')
  }
}
export function acceptAuth(result: AuthResult) {
  runtime.platform = result.platform
  runtime.merchant = result.merchant
  runtime.context = result.context
  runtime.entry = { appCode: result.context.appCode, tenantId: result.context.tenantId, entryCode: result.context.entryCode || undefined }
  persist()
}
export async function enterMerchant(entry: Entry) {
  const current = ++generation
  runtime.merchant = undefined
  runtime.context = undefined
  runtime.entry = entry
  persist()
  if (runtime.platform && (entry.entryCode || entry.tenantId)) {
    try {
      const result = await request<AuthResult>('/sessions/merchant', { method: 'POST', body: entry }, 'PLATFORM')
      if (current !== generation)
        throw new Error('商户选择已变化')
      runtime.merchant = result.merchant
      runtime.context = result.context
      persist()
    }
    catch (error) {
      if (current === generation)
        runtime.platform = undefined
      persist()
      throw error
    }
  }
}
export async function logout() {
  const pairs = [runtime.merchant, runtime.platform]
  try {
    await Promise.allSettled(pairs.filter((pair): pair is Pair => !!pair).map(pair => request('/auth/logout', { method: 'POST', header: { Authorization: `Bearer ${pair.token}` } })))
  }
  finally {
    clearLocal()
  }
}
export async function exchange(ticket: string) {
  const result = await request<AuthResult>('/bridge/exchange', {
    method: 'POST',
    body: { ticket, targetAppCode: import.meta.env.VITE_CONSUMER_H5_APP_CODE },
  })
  acceptAuth(result)
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}
