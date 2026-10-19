<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { acceptAuth, message, request, runtime } from '@/platform/runtime'

const phone = ref('')
const code = ref('')
const accepted = ref(false)
const smsOptIn = ref(false)
const privacy = ref({ version: '', text: '' })
const error = ref('')
const busy = ref(false)
const sent = ref(false)
onLoad(async () => {
  try {
    privacy.value = await request('/public/privacy')
  }
  catch (cause) {
    error.value = message(cause)
  }
})
async function send() {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  try {
    await request('/auth/sms', { method: 'POST', body: { entry: runtime.entry, phone: phone.value } })
    sent.value = true
  }
  catch (cause) {
    error.value = message(cause)
  }
  finally {
    busy.value = false
  }
}
async function login() {
  if (busy.value || !accepted.value)
    return
  busy.value = true
  error.value = ''
  try {
    acceptAuth(await request('/auth/login', { method: 'POST', body: {
      entry: runtime.entry,
      phone: phone.value,
      code: code.value,
      privacyVersion: privacy.value.version,
      privacyAccepted: accepted.value,
      smsOptIn: smsOptIn.value,
    } }))
    const target = runtime.entry.entryCode ? `entryCode=${encodeURIComponent(runtime.entry.entryCode)}` : `tenantId=${encodeURIComponent(runtime.entry.tenantId ?? '')}`
    // #ifdef H5
    uni.reLaunch({ url: `/pages/home/index?${target}` })
    // #endif
    // #ifdef MP-WEIXIN
    uni.reLaunch({ url: `/pages/shell/index?${target}` })
    // #endif
  }
  catch (cause) {
    error.value = message(cause)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <ConsumerTheme>
    <view class="px-4 py-6">
      <text class="type-page-title text-main">
        手机号登录
      </text>
      <view class="mt-4 rounded-card bg-card p-4">
        <wd-input v-model="phone" label="手机号" placeholder="请输入手机号" type="text" :maxlength="11" />
        <wd-button block plain class="mt-3" :loading="busy" @click="send">
          {{ sent ? '重新获取验证码' : '获取验证码' }}
        </wd-button>
        <wd-input v-model="code" label="验证码" placeholder="请输入6位验证码" type="text" :maxlength="6" />
        <text class="my-4 block text-secondary">
          {{ privacy.text }}
        </text>
        <wd-checkbox v-model="accepted">
          我已阅读并同意隐私告知
        </wd-checkbox>
        <wd-checkbox v-model="smsOptIn" class="mt-3">
          接收业务短信（可不选）
        </wd-checkbox>
      </view>
      <text v-if="error" class="mt-4 block text-secondary">
        {{ error }}
      </text>
      <wd-button block class="mt-6" :disabled="!accepted || !privacy.version" :loading="busy" @click="login">
        登录当前商户
      </wd-button>
    </view>
  </ConsumerTheme>
</template>
