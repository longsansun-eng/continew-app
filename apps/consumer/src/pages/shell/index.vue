<script setup lang="ts">
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { authenticated, configuredAppCode, enterMerchant, message, request, restore, runtime } from '@/platform/runtime'

const url = ref('')
const error = ref('')
const loading = ref(false)
const merchants = ref<{ id: string, name: string }[]>([])
async function open() {
  loading.value = true
  error.value = ''
  try {
    await request('/public/resolve', { method: 'POST', body: runtime.entry })
    if (!runtime.merchant) {
      uni.navigateTo({ url: '/pages/login/index' })
      return
    }
    const result = await authenticated<{ ticket: string, h5BaseUrl: string }>('/bridge/tickets', { method: 'POST' })
    const base = result.h5BaseUrl
    if (base.replace(/\/$/, '') !== String(import.meta.env.VITE_CONSUMER_H5_URL ?? '').replace(/\/$/, ''))
      throw new Error('H5承载地址与受控配置不一致')
    if (!base.startsWith('https://'))
      throw new Error('小程序承载地址必须是已登记的HTTPS地址')
    url.value = `${base.replace(/\/$/, '')}/#/pages/home/index?ticket=${encodeURIComponent(result.ticket)}`
  }
  catch (cause) {
    error.value = message(cause)
  }
  finally {
    loading.value = false
  }
}
async function choose(id: string) {
  try {
    await enterMerchant({ appCode: runtime.entry.appCode, tenantId: id })
    await open()
  }
  catch (cause) {
    error.value = message(cause)
  }
}
onLoad(async (options) => {
  restore()
  try {
    const entry = options?.entryCode ?? (options?.scene ? decodeURIComponent(options.scene) : undefined)
    if (entry) {
      await enterMerchant({ appCode: configuredAppCode, entryCode: entry })
      await open()
    }
    else if (options?.tenantId) {
      await enterMerchant({ appCode: configuredAppCode, tenantId: options.tenantId })
      await open()
    }
    else {
      await enterMerchant({ appCode: configuredAppCode })
      merchants.value = await request(`/public/merchants?appCode=${encodeURIComponent(runtime.entry.appCode)}`)
    }
  }
  catch (cause) {
    error.value = message(cause)
  }
})
onShareAppMessage(() => ({ title: '商户服务', path: runtime.entry.entryCode ? `/pages/shell/index?entryCode=${encodeURIComponent(runtime.entry.entryCode)}` : '/pages/shell/index' }))
</script>

<template>
  <web-view v-if="url" :src="url" />
  <ConsumerTheme v-else>
    <view class="px-4 py-6">
      <text class="type-page-title text-main">
        商户服务
      </text>
      <text v-if="loading" class="mt-4 block text-secondary">
        正在连接商户
      </text>
      <text v-if="error" class="mt-4 block text-secondary">
        {{ error }}
      </text>
      <wd-button v-if="error" block class="mt-4" @click="open">
        重试当前入口
      </wd-button>
      <text v-if="!loading && !error && !merchants.length" class="mt-4 block text-secondary">
        请使用商户提供的有效入口
      </text>
      <view v-for="merchant in merchants" :key="merchant.id" class="mt-4 rounded-card bg-card p-4" @click="choose(merchant.id)">
        <text class="text-main">
          {{ merchant.name }}
        </text>
      </view>
    </view>
  </ConsumerTheme>
</template>
