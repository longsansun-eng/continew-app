<script setup lang="ts">
import { ref } from 'vue'

const value = ref('')
</script>

<template>
  <DemoTheme>
    <view class="px-4 py-6">
      <text class="type-page-title text-main">
        组件与主题展示
      </text>
      <view class="mt-4 rounded-card bg-card p-4">
        <wd-input v-model="value" label="输入框" placeholder="仅展示组件，不提交业务数据" />
        <wd-button block class="mt-4">
          按钮展示
        </wd-button>
        <text class="mt-4 block text-secondary">
          正式消费者服务请启动 consumer 应用，此页无登录和演示后台。
        </text>
      </view>
      <DemoTabBar current="profile" />
    </view>
  </DemoTheme>
</template>
