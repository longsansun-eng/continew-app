<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { authenticated, logout, message, request, runtime } from '@/platform/runtime'

const nickname = ref('')
const avatarSrc = ref('')
const smsOptIn = ref(false)
const version = ref('')
const error = ref('')
const status = ref('')
onLoad(async () => {
  try {
    const [profile, privacy] = await Promise.all([authenticated<{ nickname?: string, sms_opt_in: boolean, avatar_file_id?: string }>('/me'), request<{ version: string }>('/public/privacy')])
    if (profile.avatar_file_id && runtime.merchant) {
      uni.downloadFile({ url: `${import.meta.env.VITE_API_BASE_URL ?? ''}/consumer/me/avatar/${profile.avatar_file_id}`, header: { Authorization: `Bearer ${runtime.merchant.token}` }, success: (result) => {
        if (result.statusCode === 200)
          avatarSrc.value = result.tempFilePath
      } })
    }
    nickname.value = profile.nickname ?? ''
    smsOptIn.value = profile.sms_opt_in
    version.value = privacy.version
  }
  catch (cause) {
    error.value = message(cause)
  }
})
async function save() {
  try {
    await authenticated('/me', { method: 'PUT', body: { nickname: nickname.value, smsOptIn: smsOptIn.value, privacyVersion: version.value } })
    status.value = '资料已保存'
  }
  catch (cause) {
    error.value = message(cause)
  }
}
async function leave() {
  try {
    await logout()
    uni.reLaunch({ url: '/pages/home/index' })
  }
  catch (cause) {
    error.value = message(cause)
  }
}
function avatar() {
  uni.chooseImage({ count: 1, success: (selection) => {
    const filePath = selection.tempFilePaths[0]
    if (!filePath || !runtime.merchant)
      return
    uni.uploadFile({ url: `${import.meta.env.VITE_API_BASE_URL ?? ''}/consumer/me/avatar`, filePath, name: 'file', header: { Authorization: `Bearer ${runtime.merchant.token}` }, success: (result) => {
      if (result.statusCode === 200)
        avatarSrc.value = filePath
      status.value = result.statusCode === 200 ? '头像已更新' : '头像更新失败，请使用256KB以内、1024像素以内的位图'
    }, fail: () => {
      error.value = '头像上传失败，请稍后重试'
    } })
  } })
}
</script>

<template>
  <ConsumerTheme>
    <view class="px-4 py-6">
      <text class="type-page-title text-main">
        我的资料
      </text>
      <image v-if="avatarSrc" :src="avatarSrc" class="mt-4 h-20 w-20 rounded-full" mode="aspectFill" />
      <view class="mt-4 rounded-card bg-card p-4">
        <wd-input v-model="nickname" label="昵称" :maxlength="100" />
        <wd-checkbox v-model="smsOptIn" class="mt-3">
          接收业务短信
        </wd-checkbox>
      </view>
      <text v-if="error" class="mt-4 block text-secondary">
        {{ error }}
      </text>
      <text v-if="status" class="mt-4 block text-secondary">
        {{ status }}
      </text>
      <wd-button block class="mt-4" @click="save">
        保存资料
      </wd-button>
      <wd-button block plain class="mt-3" @click="avatar">
        上传头像
      </wd-button>
      <wd-button block plain class="mt-3" @click="leave">
        退出登录
      </wd-button>
    </view>
  </ConsumerTheme>
</template>
