<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { Settings, Action } from './background/types';

const settings = ref<Settings | null>(null);
const selectedActionId = ref<string | null>(null);
const hasUnsavedChanges = ref(false);
const originalAction = ref<Action | null>(null);

// 获取当前选中的配置
const currentAction = computed(() => {
  if (!settings.value || !selectedActionId.value) return null;
  return settings.value.actions[selectedActionId.value];
});

// 获取当前配置的显示名称
const currentActionName = computed(() => {
  if (!selectedActionId.value) return '';
  return `配置 ${selectedActionId.value}`;
});

// 监听当前配置的变化
watch(currentAction, (newVal) => {
  if (newVal) {
    // 保存原始配置的深拷贝
    originalAction.value = JSON.parse(JSON.stringify(newVal));
  }
}, { immediate: true });

// 跟踪新创建的配置
const isNewAction = ref(false);

// 检查是否有未保存的更改
const checkUnsavedChanges = () => {
  if (isNewAction.value) return true;
  if (!currentAction.value || !originalAction.value) return false;
  return JSON.stringify(currentAction.value) !== JSON.stringify(originalAction.value);
};

// 切换配置前的确认
const handleActionSelect = async (id: string) => {
  if (checkUnsavedChanges()) {
    if (confirm('当前配置有未保存的更改，是否继续？\n点击确定放弃更改并切换，点击取消保持当前编辑。')) {
      if (settings.value && selectedActionId.value) {
        if (isNewAction.value) {
          // 如果是未保存的新配置，删除它
          delete settings.value.actions[selectedActionId.value];
        } else {
          // 恢复原始配置
          settings.value.actions[selectedActionId.value] = JSON.parse(JSON.stringify(originalAction.value));
        }
      }
      selectedActionId.value = id;
      isNewAction.value = false;
    }
  } else {
    selectedActionId.value = id;
    isNewAction.value = false;
  }
};

// 生成新的配置 ID
const generateNewId = () => {
  if (!settings.value?.actions) return '101';
  const ids = Object.keys(settings.value.actions).map(Number);
  return String(Math.max(...ids) + 1);
};

// 创建新配置
const addNewAction = async () => {
  if (!settings.value) return;

  const newId = generateNewId();
  const newAction: Action = {
    mouse: 0,
    key: 90,
    type: 'tabs',
    action: 'tabs',
    color: '#FFA500',
    options: {
      smart: 0,
      ignore: [0],
      delay: 0,
      close: 0,
      block: true,
      reverse: false,
      end: false,
    },
  };

  settings.value.actions[newId] = newAction;
  selectedActionId.value = newId;
  isNewAction.value = true; // 标记为新配置
};

// 保存单个配置
const saveAction = async (id: string, action: Action) => {
  if (!settings.value) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'updateAction',
      actionId: id,
      action: action
    });
    console.log('Action saved successfully');
    // 更新原始配置
    originalAction.value = JSON.parse(JSON.stringify(action));
  } catch (error) {
    console.error('Failed to save action:', error);
    throw error;
  }
};

// 保存配置
const saveSettings = async () => {
  if (!settings.value || !selectedActionId.value || !currentAction.value) return;

  try {
    await saveAction(selectedActionId.value, currentAction.value);
    isNewAction.value = false; // 保存成功后清除新配置标记
    alert('保存成功！');
  } catch (error) {
    alert('保存失败，请重试！');
  }
};

// 添加窗口关闭前的检查
window.addEventListener('beforeunload', (event) => {
  if (checkUnsavedChanges()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

// 删除配置
const deleteAction = (id: string) => {
  if (!settings.value || Object.keys(settings.value.actions).length <= 1) return;
  delete settings.value.actions[id];
  if (selectedActionId.value === id) {
    selectedActionId.value = Object.keys(settings.value.actions)[0];
  }
};

onMounted(async () => {
  try {
    // 从 background 获取设置
    const response = await chrome.runtime.sendMessage({ type: 'init' });
    console.log('Received settings:', response);

    if (response) {
      settings.value = response;
    } else {
      // 如果没有设置，使用默认值
      settings.value = {
        actions: {
          '101': {
            mouse: 0,
            key: 90,
            type: 'tabs',
            action: 'tabs',
            color: '#FFA500',
            options: {
              smart: 0,
              ignore: [0],
              delay: 0,
              close: 0,
              block: true,
              reverse: false,
              end: false,
            },
          },
        },
        blocked: [],
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
});
</script>

<template>
  <div class="settings-page">
    <h1>Linkclump 设置</h1>

    <div v-if="settings" class="settings-content">
      <div class="settings-layout">
        <!-- 左侧配置列表 -->
        <div class="actions-list">
          <div class="actions-header">
            <h2>配置列表</h2>
            <button @click="addNewAction" class="add-button">新建</button>
          </div>

          <div class="action-items">
            <div
              v-for="(action, id) in settings.actions"
              :key="id"
              class="action-list-item"
              :class="{ active: selectedActionId === id }"
              @click="handleActionSelect(id)"
            >
              <div class="action-summary">
                <span class="action-name">配置 {{ id }}</span>
                <span class="action-type">{{ action.type }}</span>
              </div>
              <button
                v-if="Object.keys(settings.actions).length > 1"
                @click.stop="deleteAction(id)"
                class="delete-button"
              >
                删除
              </button>
            </div>
          </div>
        </div>

        <!-- 右侧配置详情 -->
        <div class="details-panel">
          <div v-if="currentAction" class="action-details">
            <div class="details-header">
              <h3>{{ currentActionName }}</h3>
              <span class="action-type-badge">{{ currentAction.type }}</span>
              <span v-if="checkUnsavedChanges()" class="unsaved-badge">
                未保存的更改
              </span>
            </div>
            <div class="form-group">
              <label>鼠标按键:</label>
              <select v-model="currentAction.mouse">
                <option value="0">左键</option>
                <option value="1">中键</option>
                <option value="2">右键</option>
              </select>
            </div>
            <div class="form-group">
              <label>键盘按键:</label>
              <input v-model="currentAction.key" type="number" min="0" max="255" />
            </div>
            <div class="form-group">
              <label>动作类型:</label>
              <select v-model="currentAction.type">
                <option value="tabs">新标签页打开</option>
                <option value="copy">复制链接</option>
                <option value="bookmark">添加书签</option>
                <option value="win">新窗口打开</option>
              </select>
            </div>
            <div class="form-group">
              <label>选择框颜色:</label>
              <input v-model="currentAction.color" type="color" />
            </div>
            <div class="options-section">
              <h4>选项</h4>
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="currentAction.options.block" />
                  阻止重复链接
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="currentAction.options.reverse" />
                  反向选择
                </label>
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="currentAction.options.end" />
                  在末尾打开
                </label>
              </div>
            </div>
            <button
              @click="saveSettings"
              class="save-button"
              :disabled="!checkUnsavedChanges()"
            >
              {{ isNewAction ? '保存新配置' : (checkUnsavedChanges() ? '保存更改' : '无更改') }}
            </button>
          </div>
          <div v-else class="no-selection">
            <div class="empty-state">
              <span class="material-icons">settings</span>
              <p>请从左侧选择一个配置进行编辑</p>
              <button @click="addNewAction" class="create-button">
                或创建新配置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="loading">加载中...</div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-content {
  margin-top: 20px;
}

.settings-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  min-height: 500px;
}

.actions-list {
  border-right: 1px solid #eee;
  padding-right: 20px;
}

.action-list-item {
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-list-item:hover {
  background-color: #f5f5f5;
}

.action-list-item.active {
  background-color: #e3f2fd;
  border-color: #2196F3;
}

.action-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-name {
  font-weight: bold;
}

.action-type {
  font-size: 0.9em;
  color: #666;
}

.details-panel {
  background-color: #f9f9f9;
  border-radius: 4px;
  min-height: 500px;
  display: flex;
}

.details-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.action-type-badge {
  background-color: #e3f2fd;
  color: #1976D2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-state .material-icons {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 8px 0 16px;
}

.create-button {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.create-button:hover {
  background-color: #1976D2;
}

.action-details {
  flex: 1;
  padding: 24px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.no-selection {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin: 10px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.options-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.save-button {
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-button:hover {
  background-color: #45a049;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.add-button {
  padding: 8px 16px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-button:hover {
  background-color: #1976D2;
}

.delete-button {
  padding: 4px 8px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.delete-button:hover {
  background-color: #d32f2f;
}

.unsaved-badge {
  background-color: #fff3e0;
  color: #f57c00;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 500;
}

.save-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.save-button:disabled:hover {
  background-color: #cccccc;
}
</style>
