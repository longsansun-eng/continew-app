<script setup lang="ts">
import { confirmDelete, useList } from '@continew-app/core'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { authenticated, message } from '@/platform/runtime'

interface Contact { id: string, contact_name: string, contact_phone: string, is_default: boolean }
const { list: rows, loading, error: listError, refresh: load } = useList<Contact>({ fetcher: () => authenticated('/contacts'), immediate: false })
const id = ref<string>()
const name = ref('')
const phone = ref('')
const primary = ref(false)
const error = ref('')
onLoad(load)
function edit(row: Contact) {
  id.value = row.id
  name.value = row.contact_name
  phone.value = row.contact_phone
  primary.value = row.is_default
}
async function save() {
  try {
    await authenticated('/contacts', { method: 'POST', body: { id: id.value, name: name.value, phone: phone.value, primary: primary.value } })
    id.value = undefined
    name.value = ''
    phone.value = ''
    primary.value = false
    await load()
  }
  catch (cause) {
    error.value = message(cause)
  }
}
async function remove(row: Contact) {
  if (!await confirmDelete({ content: '删除联系人不会修改历史预约。是否继续？' }))
    return
  try {
    await authenticated(`/contacts/${row.id}`, { method: 'DELETE' })
    await load()
  }
  catch (cause) {
    error.value = message(cause)
  }
}
</script>

<template>
  <ConsumerTheme>
    <view class="px-4 py-6">
      <text class="type-page-title text-main">
        当前商户常用联系人
      </text>
      <text v-if="error" class="mt-3 block text-secondary">
        {{ error }}
      </text>
      <CmPage :loading="loading" :error="listError" :empty="!rows.length" empty-text="还没有常用联系人" @retry="load">
        <view v-for="row in rows" :key="row.id" class="mt-3 rounded-card bg-card p-4">
          <text class="text-main">
            {{ row.contact_name }} · {{ row.contact_phone }} {{ row.is_default ? '默认' : '' }}
          </text>
          <wd-button plain class="mt-3" @click="edit(row)">
            编辑
          </wd-button>
          <wd-button plain class="mt-3" @click="remove(row)">
            删除
          </wd-button>
        </view>
      </CmPage>
      <view class="mt-6 rounded-card bg-card p-4">
        <text class="text-main">
          {{ id ? '编辑联系人' : '新增联系人' }}
        </text>
        <wd-input v-model="name" label="姓名" placeholder="请输入联系人姓名" :maxlength="64" />
        <wd-input v-model="phone" label="手机号" placeholder="请输入手机号" type="text" :maxlength="11" />
        <wd-checkbox v-model="primary">
          设为默认
        </wd-checkbox>
        <wd-button block class="mt-4" @click="save">
          保存联系人
        </wd-button>
      </view>
    </view>
  </ConsumerTheme>
</template>
