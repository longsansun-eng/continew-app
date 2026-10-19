<script setup lang="ts">
import { useList } from '@continew-app/core'
import { onLoad } from '@dcloudio/uni-app'
import { onMounted, onUnmounted, ref } from 'vue'
import { configuredAppCode, enterMerchant, exchange, message, request, restore, runtime } from '@/platform/runtime'

interface Merchant { id: string, name: string }
interface Brand { merchantName: string, brandName?: string, welcomeText?: string, arrivalGuide?: string, themeColor?: string, logoUrl?: string }
const keyword = ref('')
const { list: merchants, loading: merchantLoading, error: merchantError, refresh: search } = useList<Merchant>({
  fetcher: () => request(`/public/merchants?appCode=${encodeURIComponent(runtime.entry.appCode)}&keyword=${encodeURIComponent(keyword.value)}`),
  immediate: false,
})
const brand = ref<Brand>()
const loading = ref(false)
const error = ref('')
let brandRevision = 0
let selectionRevision = 0
// #ifdef H5
function refreshHomeEntry() {
  if (/^#\/pages\/home\/index(?:\?|$)/.test(location.hash))
    location.reload()
}
onMounted(() => window.addEventListener('hashchange', refreshHomeEntry))
onUnmounted(() => window.removeEventListener('hashchange', refreshHomeEntry))
// #endif
function rememberEntry() {
  // #ifdef H5
  const query = runtime.entry.entryCode ? `entryCode=${encodeURIComponent(runtime.entry.entryCode)}` : `tenantId=${encodeURIComponent(runtime.entry.tenantId ?? '')}`
  history.replaceState(null, '', `${location.pathname}#/pages/home/index?${query}`)
  // #endif
}
async function loadBrand() {
  const current = ++brandRevision
  loading.value = true
  error.value = ''
  brand.value = undefined
  try {
    const result = await request<{ branding: Brand }>('/public/resolve', { method: 'POST', body: runtime.entry })
    if (current === brandRevision) {
      brand.value = result.branding
      rememberEntry()
    }
  }
  catch (cause) {
    if (current === brandRevision)
      error.value = message(cause)
  }
  finally {
    if (current === brandRevision)
      loading.value = false
  }
}
async function choose(merchant: Merchant) {
  const current = ++selectionRevision
  try {
    await enterMerchant({ appCode: runtime.entry.appCode, tenantId: merchant.id })
    if (current === selectionRevision)
      await loadBrand()
  }
  catch (cause) {
    if (current === selectionRevision)
      error.value = message(cause)
  }
}
async function switchMerchant() {
  selectionRevision++
  brandRevision++
  error.value = ''
  brand.value = undefined
  await enterMerchant({ appCode: runtime.entry.appCode })
  await search()
}
function open(page: string) {
  uni.navigateTo({ url: `/pages/${page}/index` })
}
onLoad(async (options) => {
  restore()
  // #ifdef MP-WEIXIN
  const target = options?.entryCode ? `?entryCode=${encodeURIComponent(options.entryCode)}` : options?.scene ? `?scene=${encodeURIComponent(options.scene)}` : options?.tenantId ? `?tenantId=${encodeURIComponent(options.tenantId)}` : ''
  uni.reLaunch({ url: `/pages/shell/index${target}` })
  return
  // #endif
  // #ifdef H5
  try {
    const hash = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    const ticket = options?.ticket ?? hash.get('ticket')
    if (ticket) {
      history.replaceState(null, '', `${window.location.pathname}#/pages/home/index`)
      await exchange(ticket)
      await loadBrand()
      return
    }
    const entryCode = options?.entryCode ?? options?.e ?? new URLSearchParams(location.search).get('e') ?? location.pathname.match(/^\/e\/([\w-]{24})$/)?.[1]
    if (entryCode) {
      await enterMerchant({ appCode: runtime.context && runtime.entry.entryCode === entryCode ? runtime.entry.appCode : configuredAppCode, entryCode })
      await loadBrand()
    }
    else if (options?.tenantId) {
      await enterMerchant({ appCode: runtime.entry.appCode, tenantId: options?.tenantId })
      await loadBrand()
    }
    else {
      const boot = await request<{ selectionRequired: boolean, context?: { appCode: string, entryCode?: string, tenantId: string }, branding?: Brand }>(`/public/bootstrap?appCode=${encodeURIComponent(configuredAppCode)}`)
      if (!boot.selectionRequired && boot.context) {
        await enterMerchant({ appCode: boot.context?.appCode ?? configuredAppCode, entryCode: boot.context?.entryCode, tenantId: boot.context?.tenantId })
        brand.value = boot.branding
        rememberEntry()
      }
      else {
        await enterMerchant({ appCode: configuredAppCode })
        await search()
      }
    }
  }
  catch (cause) {
    error.value = message(cause)
  }
  // #endif
})
</script>

<template>
  <ConsumerTheme :brand-color="brand?.themeColor">
    <view class="px-4 py-6">
      <text class="type-page-title text-main">
        {{ brand?.brandName || brand?.merchantName || '选择商户' }}
      </text>
      <text v-if="loading" class="mt-4 block text-secondary">
        正在加载
      </text>
      <view v-if="error" class="mt-4 rounded-card bg-card p-4">
        <text class="text-secondary">
          {{ error }}
        </text>
        <wd-button block class="mt-4" @click="(runtime.entry.entryCode || runtime.entry.tenantId) ? loadBrand() : search()">
          重试当前入口
        </wd-button>
        <wd-button block plain class="mt-3" @click="switchMerchant">
          主动选择其他商户
        </wd-button>
      </view>
      <template v-if="brand">
        <view class="mt-4 rounded-card bg-card p-5">
          <image v-if="brand.logoUrl" :src="brand.logoUrl" class="mb-3 h-16 w-16 rounded-card" mode="aspectFit" />
          <text class="type-title text-main">
            {{ brand.welcomeText || '欢迎使用商户服务' }}
          </text>
          <text class="mt-3 block text-secondary">
            {{ brand.arrivalGuide }}
          </text>
        </view>
        <wd-button block class="mt-6" @click="open(runtime.merchant ? 'profile' : 'login')">
          {{ runtime.merchant ? '我的资料' : '手机号登录' }}
        </wd-button>
        <wd-button v-if="runtime.merchant" block plain class="mt-3" @click="open('contacts')">
          常用联系人
        </wd-button>
        <wd-button block plain class="mt-3" @click="switchMerchant">
          选择其他商户
        </wd-button>
      </template>
      <template v-else-if="!error && !loading">
        <wd-input v-model="keyword" label="商户名称" placeholder="搜索公开商户" />
        <wd-button block class="mt-3" @click="search">
          查询
        </wd-button>
        <CmPage :loading="merchantLoading" :error="merchantError" :empty="!merchants.length" empty-text="暂无可选择商户，请向商户获取有效入口" @retry="search">
          <view v-for="merchant in merchants" :key="merchant.id" class="mt-3 rounded-card bg-card p-4" @click="choose(merchant)">
            <text class="text-main">
              {{ merchant.name }}
            </text>
          </view>
        </CmPage>
      </template>
    </view>
  </ConsumerTheme>
</template>
