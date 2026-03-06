<template>
  <div class="space-y-6">
    <!-- 代理控制面板 -->
    <section class="rounded-3xl border border-border bg-card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-foreground">代理控制</h3>
        <button @click="previewConfig" class="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
          预览配置
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-6">
        <label class="flex items-center gap-3 cursor-pointer">
          <ToggleSwitch v-model="proxyControl.master_enabled" @update:model-value="saveProxyControl" />
          <span class="text-sm text-foreground">代理总开关</span>
        </label>
        <Checkbox v-model="proxyControl.auth_enabled" @update:modelValue="saveProxyControl">
          用于 Auth
        </Checkbox>
        <Checkbox v-model="proxyControl.chat_enabled" @update:modelValue="saveProxyControl">
          用于 Chat
        </Checkbox>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">端口:</span>
          <input v-model.number="proxyControl.port" @change="onPortChange" type="number" min="1024" max="65535" class="w-24 rounded-lg border border-input bg-background px-3 py-1 text-sm" />
          <span class="text-xs text-amber-600">⚠️ 修改后需重启程序生效</span>
        </div>
      </div>
    </section>

    <!-- 订阅导入面板 -->
    <section class="rounded-3xl border border-border bg-card p-6">
      <h3 class="text-base font-semibold text-foreground mb-4">导入节点</h3>
      <div class="flex gap-2 mb-4 border-b border-border">
        <button @click="importTab = 'subscription'" :class="importTab === 'subscription' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'" class="px-4 py-2 text-sm font-medium transition-colors">订阅链接</button>
        <button @click="importTab = 'yaml'" :class="importTab === 'yaml' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'" class="px-4 py-2 text-sm font-medium transition-colors">YAML 配置</button>
      </div>
      <div v-if="importTab === 'subscription'" class="flex gap-2">
        <input v-model="subscriptionUrl" placeholder="输入订阅链接" class="flex-1 rounded-2xl border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary" />
        <button @click="importSubscription" :disabled="!subscriptionUrl.trim()" class="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">导入</button>
      </div>
      <div v-else class="flex flex-col gap-2">
        <textarea v-model="yamlContent" rows="6" placeholder="粘贴 Clash YAML 配置（包含 proxies 字段）" class="w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm font-mono outline-none focus:border-primary resize-none"></textarea>
        <button @click="importYaml" :disabled="!yamlContent.trim()" class="self-end rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">导入</button>
      </div>
      <p v-if="importResult" class="mt-3 text-xs text-primary">✓ {{ importResult }}</p>
      <p v-if="importError" class="mt-3 text-xs text-destructive">✗ {{ importError }}</p>
    </section>

    <!-- 头部操作栏 -->
    <section class="rounded-3xl border border-border bg-card p-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-foreground">节点管理</h3>
          <p class="mt-0.5 text-xs text-muted-foreground">管理代理节点，系统自动按成功率选择最优节点</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input v-model="searchQuery" placeholder="搜索节点..." class="rounded-full border border-border bg-background px-4 py-2 text-sm w-48" />
          <SelectMenu
            v-model="sortBy"
            :options="sortOptions"
            class="!w-36"
          />
          <button @click="toggleSelectAll" class="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
            {{ allSelected ? '取消全选' : '全选' }}
          </button>
          <button v-if="selectedIds.length > 0" @click="deleteSelected" class="rounded-full border border-destructive px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white">
            删除选中 ({{ selectedIds.length }})
          </button>
          <button @click="openAddNode" class="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            + 添加节点
          </button>
        </div>
      </div>
    </section>

    <!-- 节点列表 -->
    <section class="rounded-3xl border border-border bg-card">
      <div v-if="isLoading" class="flex items-center justify-center py-16">
        <svg class="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <div v-else-if="sortedNodes.length === 0" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <svg viewBox="0 0 24 24" class="h-12 w-12 opacity-30" fill="currentColor">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm1-13h-2v6h2zm0 8h-2v2h2z"/>
        </svg>
        <p class="mt-3 text-sm">暂无节点，点击右上角添加</p>
      </div>

      <div v-else class="divide-y divide-border">
        <div v-for="node in sortedNodes" :key="node.id" class="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-4">
          <!-- 复选框 -->
          <Checkbox
            :modelValue="selectedIds.includes(node.id)"
            @update:modelValue="(checked) => setNodeSelection(node.id, checked)"
          />

          <!-- 状态指示 -->
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              :class="node.enabled ? 'bg-primary' : 'bg-muted-foreground/40'"
            ></span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">{{ node.name }}</p>
              <p class="truncate text-xs text-muted-foreground font-mono">{{ node.url }}</p>
            </div>
          </div>

          <!-- 标签 -->
          <div class="flex flex-wrap gap-1.5 ml-5 sm:ml-0">
            <span v-if="node.use_for_auth" class="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">Auth</span>
            <span v-if="node.use_for_chat" class="inline-flex items-center rounded-full border border-border bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">Chat</span>
          </div>

          <!-- 成功率 -->
          <div class="ml-5 sm:ml-auto flex items-center gap-4 shrink-0">
            <div class="text-center min-w-[80px]">
              <div class="flex items-center gap-1 text-xs text-muted-foreground justify-center">
                <span class="text-primary font-medium">{{ node.success }}</span>
                <span>/</span>
                <span class="text-destructive font-medium">{{ node.fail }}</span>
              </div>
              <div class="mt-1 h-1 w-20 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary transition-all"
                  :style="{ width: successRatePercent(node) }"
                ></div>
              </div>
              <p class="mt-0.5 text-[10px] text-muted-foreground">{{ successRateLabel(node) }}</p>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-1">
              <button
                type="button"
                @click="toggleEnabled(node)"
                :title="node.enabled ? '禁用' : '启用'"
                :aria-label="node.enabled ? '禁用节点' : '启用节点'"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
                  <path v-if="node.enabled" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  <path v-else d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 6H8v8h8V8z"/>
                </svg>
              </button>
              <button
                type="button"
                @click="openEditNode(node)"
                title="编辑"
                aria-label="编辑节点"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button
                type="button"
                @click="confirmResetStats(node)"
                title="重置统计"
                aria-label="重置统计"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
                  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
              </button>
              <button
                type="button"
                @click="confirmDelete(node)"
                title="删除"
                aria-label="删除节点"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 添加/编辑节点弹窗 -->
    <Teleport to="body">
      <div v-if="nodeDialog.open" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4">
        <div class="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl">
          <p class="text-sm font-medium text-foreground">{{ nodeDialog.isEdit ? '编辑节点' : '添加节点' }}</p>
          <div class="mt-4 space-y-3">
            <div>
              <label class="text-xs text-muted-foreground">名称</label>
              <input v-model="nodeDialog.form.name" type="text" placeholder="如：HK-1"
                class="mt-1 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label class="text-xs text-muted-foreground">代理 URL</label>
              <input v-model="nodeDialog.form.url" type="text" placeholder="http://127.0.0.1:17700"
                class="mt-1 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary" />
            </div>
            <div class="flex flex-wrap items-center gap-4">
              <Checkbox v-model="nodeDialog.form.use_for_auth">
                用于 Auth
              </Checkbox>
              <Checkbox v-model="nodeDialog.form.use_for_chat">
                用于 Chat
              </Checkbox>
              <Checkbox v-model="nodeDialog.form.enabled">
                启用
              </Checkbox>
            </div>
            <p v-if="nodeDialog.error" class="text-xs text-destructive">{{ nodeDialog.error }}</p>
          </div>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button @click="nodeDialog.open = false" class="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">取消</button>
            <button @click="submitNode" :disabled="nodeDialog.submitting"
              class="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {{ nodeDialog.submitting ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 预览配置弹窗 -->
    <Teleport to="body">
      <div v-if="configPreview.open" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-8">
        <div class="w-full h-full flex flex-col rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm font-medium text-foreground">运行时 YAML 配置预览</p>
            <button @click="configPreview.open = false" class="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">关闭</button>
          </div>
          <div v-if="configPreview.content" class="flex-1 overflow-auto rounded-2xl border border-border bg-muted p-4">
            <pre class="text-sm font-mono leading-relaxed text-foreground whitespace-pre">{{ configPreview.content }}</pre>
          </div>
          <p v-else-if="configPreview.loading" class="text-sm text-muted-foreground">加载中...</p>
          <p v-else-if="configPreview.error" class="text-sm text-destructive">{{ configPreview.error }}</p>
        </div>
      </div>
    </Teleport>

    <!-- 确认弹窗 -->
    <ConfirmDialog
      :open="confirmDialog.open.value"
      :title="confirmDialog.title.value"
      :message="confirmDialog.message.value"
      @confirm="confirmDialog.confirm"
      @cancel="confirmDialog.cancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { nodesApi, type Node } from '@/api/nodes'
import { settingsApi } from '@/api/settings'
import { proxyControlApi, type ProxyControl } from '@/api/proxyControl'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import SelectMenu from '@/components/ui/SelectMenu.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'

const nodes = ref<Node[]>([])
const isLoading = ref(false)
const confirmDialog = useConfirmDialog()
const toast = useToast()

type SortType = 'default' | 'success_rate' | 'success_count' | 'fail_count' | 'name'

const SORT_VALUES: SortType[] = ['default', 'success_rate', 'success_count', 'fail_count', 'name']
const savedSort = localStorage.getItem('nodes_sort_by') as SortType | null
const sortBy = ref<SortType>(savedSort && SORT_VALUES.includes(savedSort) ? savedSort : 'default')
const sortOptions = [
  { label: '默认排序', value: 'default' },
  { label: '成功率', value: 'success_rate' },
  { label: '成功次数', value: 'success_count' },
  { label: '失败次数', value: 'fail_count' },
  { label: '名称', value: 'name' },
]

watch(sortBy, (val) => localStorage.setItem('nodes_sort_by', val))
const searchQuery = ref('')
const selectedIds = ref<string[]>([])
const importTab = ref<'subscription' | 'yaml'>('subscription')

// 代理控制
const proxyControl = reactive<ProxyControl>({
  master_enabled: false,
  auth_enabled: false,
  chat_enabled: false,
  port: 7890,
})

watch(proxyControl, (val) => {
  localStorage.setItem('nodes_proxy_control', JSON.stringify(val))
}, { deep: true })

// 排序节点
const sortedNodes = computed(() => {
  let list = [...nodes.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(n => n.name.toLowerCase().includes(q) || n.url.toLowerCase().includes(q))
  }
  if (sortBy.value === 'success_rate') {
    return list.sort((a, b) => {
      const aTotal = a.success + a.fail
      const bTotal = b.success + b.fail
      const aRate = aTotal > 0 ? a.success / aTotal : 1
      const bRate = bTotal > 0 ? b.success / bTotal : 1
      return bRate - aRate
    })
  }
  if (sortBy.value === 'success_count') return list.sort((a, b) => b.success - a.success)
  if (sortBy.value === 'fail_count') return list.sort((a, b) => b.fail - a.fail)
  if (sortBy.value === 'name') return list.sort((a, b) => a.name.localeCompare(b.name))
  return list
})

const allSelected = computed(() => sortedNodes.value.length > 0 && sortedNodes.value.every(n => selectedIds.value.includes(n.id)))

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = sortedNodes.value.map(n => n.id)
  }
}

function setNodeSelection(id: string, checked: boolean) {
  const exists = selectedIds.value.includes(id)
  if (checked && !exists) {
    selectedIds.value.push(id)
  } else if (!checked && exists) {
    selectedIds.value = selectedIds.value.filter(item => item !== id)
  }
}

function clearSelectedIds() {
  const existingIds = new Set(nodes.value.map(item => item.id))
  selectedIds.value = selectedIds.value.filter(id => existingIds.has(id))
}

async function refreshNodes() {
  await loadNodes()
  clearSelectedIds()
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

async function deleteSelected() {
  if (selectedIds.value.length === 0) return
  const confirmed = await confirmDialog.ask({
    title: '确认删除',
    message: `确定要删除选中的 ${selectedIds.value.length} 个节点吗？`,
  })
  if (!confirmed) return

  const ids = [...selectedIds.value]
  try {
    for (const id of ids) {
      await nodesApi.delete(id)
    }
    selectedIds.value = []
    await refreshNodes()
    toast.success(`已删除 ${ids.length} 个节点`)
  } catch (error) {
    const message = getErrorMessage(error, '删除节点失败')
    toast.error(message)
    console.error('删除失败:', error)
  }
}

// 预览配置
const configPreview = reactive({
  open: false,
  loading: false,
  content: '',
  error: '',
})

async function previewConfig() {
  configPreview.open = true
  configPreview.loading = true
  configPreview.content = ''
  configPreview.error = ''
  try {
    configPreview.content = await proxyControlApi.getConfigPreview()
  } catch (error) {
    configPreview.error = getErrorMessage(error, '加载失败')
    toast.error(configPreview.error)
  } finally {
    configPreview.loading = false
  }
}

// 订阅导入
const subscriptionUrl = ref('')
const yamlContent = ref('')
const importResult = ref('')
const importError = ref('')

async function loadProxyControl() {
  const cached = localStorage.getItem('nodes_proxy_control')
  if (cached) {
    try {
      Object.assign(proxyControl, JSON.parse(cached))
    } catch (error) {
      console.error('Failed to parse cached proxy control:', error)
    }
  }
  try {
    const data = await proxyControlApi.get()
    Object.assign(proxyControl, data)
  } catch (error) {
    console.error(error)
  }
}

async function saveProxyControl(): Promise<boolean> {
  try {
    let hasSystemProxy = false
    if (proxyControl.master_enabled) {
      const settings = await settingsApi.get()
      hasSystemProxy = !!(settings.basic?.proxy_for_auth || settings.basic?.proxy_for_chat)

      if (hasSystemProxy) {
        settings.basic.proxy_for_auth = ''
        settings.basic.proxy_for_chat = ''
        await settingsApi.update(settings)
      }
    }

    await proxyControlApi.update({ ...proxyControl })

    if (proxyControl.master_enabled && hasSystemProxy) {
      toast.info('节点代理已启用，系统代理已自动关闭')
    }
    return true
  } catch (error) {
    const message = getErrorMessage(error, '代理配置保存失败')
    toast.error(message)
    console.error(error)
    return false
  }
}

async function onPortChange() {
  const saved = await saveProxyControl()
  if (saved) {
    toast.warning('端口已保存，需要重启程序后生效')
  }
}

async function importSubscription() {
  importResult.value = ''
  importError.value = ''
  try {
    const data = await nodesApi.importSubscription({ url: subscriptionUrl.value.trim() })
    if (data.success) {
      importResult.value = `成功导入 ${data.count} 个节点`
      subscriptionUrl.value = ''
      await refreshNodes()
      toast.success(importResult.value)
      return
    }
    importError.value = data.message || '导入失败'
    toast.error(importError.value)
  } catch (error) {
    importError.value = getErrorMessage(error, '导入失败')
    toast.error(importError.value)
  }
}

async function importYaml() {
  importResult.value = ''
  importError.value = ''
  try {
    const data = await nodesApi.importYaml({ content: yamlContent.value.trim() })
    if (data.success) {
      importResult.value = `成功导入 ${data.count} 个节点`
      yamlContent.value = ''
      await refreshNodes()
      toast.success(importResult.value)
      return
    }
    importError.value = data.message || '导入失败'
    toast.error(importError.value)
  } catch (error) {
    importError.value = getErrorMessage(error, '导入失败')
    toast.error(importError.value)
  }
}

// ---------- 工具函数 ----------

function successRatePercent(node: Node): string {
  const total = node.success + node.fail
  if (total === 0) return '100%'
  return `${Math.round((node.success / total) * 100)}%`
}

function successRateLabel(node: Node): string {
  const total = node.success + node.fail
  if (total === 0) return '未使用'
  return `${Math.round((node.success / total) * 100)}%`
}

// ---------- 加载节点 ----------

async function loadNodes() {
  isLoading.value = true
  try {
    const res = await nodesApi.list()
    nodes.value = res.nodes || []
  } catch (error) {
    nodes.value = []
    toast.error(getErrorMessage(error, '加载节点列表失败'))
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadNodes()
  void loadProxyControl()
})

// ---------- 添加/编辑节点弹窗 ----------

const nodeDialog = reactive({
  open: false,
  isEdit: false,
  editId: '',
  submitting: false,
  error: '',
  form: {
    name: '',
    url: '',
    use_for_auth: true,
    use_for_chat: true,
    enabled: true,
  },
})

function openAddNode() {
  nodeDialog.isEdit = false
  nodeDialog.editId = ''
  nodeDialog.error = ''
  nodeDialog.form = { name: '', url: '', use_for_auth: true, use_for_chat: true, enabled: true }
  nodeDialog.open = true
}

function openEditNode(node: Node) {
  nodeDialog.isEdit = true
  nodeDialog.editId = node.id
  nodeDialog.error = ''
  nodeDialog.form = {
    name: node.name,
    url: node.url,
    use_for_auth: node.use_for_auth,
    use_for_chat: node.use_for_chat,
    enabled: node.enabled,
  }
  nodeDialog.open = true
}

async function submitNode() {
  nodeDialog.error = ''
  if (!nodeDialog.form.name.trim()) { nodeDialog.error = '名称不能为空'; return }
  if (!nodeDialog.form.url.trim()) { nodeDialog.error = 'URL 不能为空'; return }
  nodeDialog.submitting = true
  try {
    if (nodeDialog.isEdit) {
      await nodesApi.update(nodeDialog.editId, nodeDialog.form)
    } else {
      await nodesApi.create(nodeDialog.form)
    }
    nodeDialog.open = false
    await refreshNodes()
    toast.success(nodeDialog.isEdit ? '节点已更新' : '节点已添加')
  } catch (error) {
    nodeDialog.error = getErrorMessage(error, '操作失败')
  } finally {
    nodeDialog.submitting = false
  }
}

// ---------- 快速启用/禁用 ----------

async function toggleEnabled(node: Node) {
  try {
    await nodesApi.update(node.id, { enabled: !node.enabled })
    await refreshNodes()
  } catch (error) {
    toast.error(getErrorMessage(error, '节点状态更新失败'))
    console.error(error)
  }
}

// ---------- 删除 ----------

async function confirmDelete(node: Node) {
  const ok = await confirmDialog.ask({
    title: '删除节点',
    message: `确定删除节点「${node.name}」？`,
  })
  if (!ok) return
  try {
    await nodesApi.delete(node.id)
    await refreshNodes()
    toast.success('节点已删除')
  } catch (error) {
    toast.error(getErrorMessage(error, '删除节点失败'))
    console.error(error)
  }
}

// ---------- 重置统计 ----------

async function confirmResetStats(node: Node) {
  const ok = await confirmDialog.ask({
    title: '重置统计',
    message: `确定将「${node.name}」的成功/失败计数清零？`,
  })
  if (!ok) return
  try {
    await nodesApi.resetStats(node.id)
    await refreshNodes()
    toast.success('统计已重置')
  } catch (error) {
    toast.error(getErrorMessage(error, '重置统计失败'))
    console.error(error)
  }
}
</script>
