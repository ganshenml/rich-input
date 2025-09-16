<template>
  <div class="rich-input-container">
    <!-- 智能输入框主体 -->
    <div ref="smartInputRef" class="smart-input" contenteditable="true" @click="handleInputClick">
      <template v-for="(segment, index) in templateSegments" :key="index">
        <!-- 普通文本片段 -->
        <template v-if="segment.type === 'text'">
          {{ segment.content }}
        </template>
        
        <!-- 输入字段片段 -->
        <span 
          v-else-if="segment.fieldConfig?.type === 'input'"
          contenteditable="true" 
          class="highlight editable-field" 
          :style="{
            display: 'inline-flex',
            minWidth: '55px'
          }"
          :data-placeholder="segment.fieldConfig.placeholder"
          :data-field-key="segment.fieldKey"
          @click="handleEditableClick"
        >
          <span class="input" style="padding-left: 1px;">
            {{ segment.fieldConfig.defaultValue || '' }}
            <span v-if="!segment.fieldConfig.defaultValue">&#xFEFF;</span>
          </span>
          <span 
            contenteditable="false" 
            class="placeholder" 
            :style="{
              display: segment.fieldConfig.defaultValue ? 'none' : 'inline-block',
              pointerEvents: 'none',
              userSelect: 'none',
              opacity: '0.7'
            }"
          >
            {{ segment.fieldConfig.placeholder }}
          </span>
        </span>
        
        <!-- 选择字段片段 -->
        <span 
          v-else-if="segment.fieldConfig?.type === 'select'"
          class="highlight dropdown-field" 
          :data-type="segment.fieldKey"
          :data-value="segment.content"
          :data-field-key="segment.fieldKey"
          contenteditable="false"
          @click="handleDropdownClick"
        >
          {{ segment.content }}
        </span>
      </template>
    </div>

    <!-- 下拉菜单容器 -->
    <div ref="dropdownMenuRef" class="dropdown-menu" :style="dropdownStyle" v-if="showDropdown">
      <div v-for="item in currentOptions" :key="item" class="dropdown-item" @click="selectOption(item)">
        {{ item }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

/**
 * 字段类型枚举
 * 支持输入框和下拉选择两种类型
 */
type FieldType = 'input' | 'select'

/**
 * 输入字段接口
 * 用于定义可编辑的文本输入区域
 */
interface InputField {
  type: 'input'
  placeholder: string // 占位符文本
  defaultValue: string // 默认值
}

/**
 * 选择字段接口
 * 用于定义下拉选择区域
 */
interface SelectField {
  type: 'select'
  options: string[] // 可选项列表
  defaultValue: string // 默认选中值
}

/**
 * 字段联合类型
 * 支持输入和选择两种字段类型
 */
type Field = InputField | SelectField

/**
 * RichInput组件配置接口
 * 定义模板字符串和字段配置
 */
interface RichInputConfig {
  template: string // 模板字符串，包含占位符
  fields: Record<string, Field> // 字段配置映射
}

/**
 * 组件Props接口
 */
interface Props {
  config?: RichInputConfig
}

/**
 * 定义组件props，提供默认配置
 */
const props = withDefaults(defineProps<Props>(), {
  config: () => ({
    template: "我是一名{role}需要写一篇关于{topic}的{format}。面向{audience}宣传产品。",
    fields: {
      role: { type: 'input', placeholder: '公众号博主', defaultValue: '公众号博主' },
      topic: { type: 'select', options: ['科技', '教育', '健康'], defaultValue: '[主题]' },
      format: { type: 'select', options: ['文章', '报告', '论文'], defaultValue: '文章' },
      audience: { type: 'input', placeholder: '[人群]', defaultValue: '' }
    }
  })
})

/**
 * 模板片段接口
 * 用于描述模板解析后的文本片段和字段片段
 */
interface TemplateSegment {
  type: 'text' | 'field' // 片段类型：普通文本或字段
  content: string // 片段内容
  fieldKey?: string // 字段键名（仅字段片段有效）
  fieldConfig?: Field // 字段配置（仅字段片段有效）
}

/**
 * 响应式数据定义
 */
// DOM引用
const smartInputRef = ref<HTMLDivElement | null>(null)
const dropdownMenuRef = ref<HTMLDivElement | null>(null)

// 下拉菜单状态
const showDropdown = ref(false)
const currentField = ref('') // 当前激活的字段
const currentTarget = ref<HTMLElement | null>(null) // 当前点击的目标元素
const currentOptions = ref<string[]>([]) // 当前字段的选项列表

// 下拉菜单样式
const dropdownStyle = ref({
  position: 'absolute',
  top: '0px',
  left: '0px',
  zIndex: 1000
})

/**
 * 字段值存储
 * 保存用户输入或选择的值
 */
const fieldValues = ref<Record<string, string>>({})

/**
 * 动态生成OPTIONS配置
 * 基于props.config提取所有select类型字段的选项
 */
const OPTIONS = computed(() => {
  const options: Record<string, string[]> = {}
  Object.entries(props.config.fields).forEach(([key, field]) => {
    if (field.type === 'select') {
      options[key] = field.options
    }
  })
  return options
})

/**
 * 模板解析计算属性
 * 将模板字符串解析为可渲染的片段数组
 * 支持占位符替换和动态内容生成
 */
const templateSegments = computed(() => {
  const segments: TemplateSegment[] = []
  const template = props.config.template
  const regex = /\{([^}]+)\}/g // 匹配 {fieldName} 格式的占位符
  let lastIndex = 0
  let match

  // 逐个处理占位符
  while ((match = regex.exec(template)) !== null) {
    // 添加占位符前的普通文本
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: template.slice(lastIndex, match.index)
      })
    }

    // 添加字段片段
    const fieldKey = match[1]
    const fieldConfig = props.config.fields[fieldKey]
    if (fieldConfig) {
      segments.push({
        type: 'field',
        content: fieldValues.value[fieldKey] || fieldConfig.defaultValue || `[${fieldKey}]`,
        fieldKey,
        fieldConfig
      })
    }

    lastIndex = regex.lastIndex
  }

  // 添加模板末尾的剩余文本
  if (lastIndex < template.length) {
    segments.push({
      type: 'text',
      content: template.slice(lastIndex)
    })
  }

  return segments
})



/**
 * 处理输入框点击事件
 * @param event - 点击事件对象
 */
const handleInputClick = (event: Event): void => {
  const target = (event.target as HTMLElement).closest('.highlight')
  if (!target) return

  // 处理可编辑字段
  if (target.classList.contains('editable-field')) {
    handleEditableField(target as HTMLElement)
  }

  // 处理下拉选择字段
  if (target.classList.contains('dropdown-field')) {
    const fieldKey = target.getAttribute('data-field-key')
    if (fieldKey && OPTIONS.value[fieldKey]) {
      showDropdownMenu(target as HTMLElement, fieldKey)
    }
  }
}

/**
 * 处理可编辑字段点击
 * @param target - 目标元素
 */
const handleEditableClick = (event: Event): void => {
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  handleEditableField(target)
}

/**
 * 处理下拉字段点击
 * @param event - 点击事件对象
 */
const handleDropdownClick = (event: Event): void => {
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  const fieldKey = target.getAttribute('data-field-key')

  if (fieldKey && OPTIONS.value[fieldKey]) {
    showDropdownMenu(target, fieldKey)
  }
}

/**
 * 处理可编辑字段逻辑
 * @param target - 目标高亮元素
 */
const handleEditableField = (target: HTMLElement): void => {
  const inputSpan = target.querySelector('.input') as HTMLElement
  const placeholderSpan = target.querySelector('.placeholder') as HTMLElement

  if (!inputSpan || !placeholderSpan) return

  // 初始化：确保至少有一个文本节点
  if (!inputSpan.firstChild || inputSpan.firstChild.nodeType !== 3) {
    inputSpan.innerHTML = ''
    inputSpan.appendChild(document.createTextNode(''))
  }

  // 防循环标志
  let isProgrammaticChange = false

  /**
   * 确保输入元素存在
   */
  const ensureInputElement = (): HTMLElement => {
    if (!inputSpan.isConnected) {
      // 如果元素被意外删除，重新创建（极端情况）
      const newSpan = document.createElement('span')
      newSpan.className = 'input'
      newSpan.appendChild(document.createTextNode(''))
      target.insertBefore(newSpan, placeholderSpan)
      return newSpan
    }
    return inputSpan
  }

  /**
   * 处理内容变化
   */
  const handleChange = (): void => {
    if (isProgrammaticChange) return

    const currentSpan = ensureInputElement()
    const hasContent = currentSpan.textContent?.trim() !== ''

    if (!hasContent) {
      isProgrammaticChange = true
      currentSpan.innerHTML = '' // 清空但保留元素
      const textNode = document.createTextNode('\uFEFF')
      currentSpan.appendChild(textNode)

      // 移动光标到零宽空格后
      const range = document.createRange()
      range.setStart(textNode, 1)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)

      setTimeout(() => {
        isProgrammaticChange = false
      }, 0)
    }

    placeholderSpan.style.display = hasContent ? 'none' : 'inline'
  }

  // 使用MutationObserver监听变化
  const observer = new MutationObserver(() => {
    if (!isProgrammaticChange) handleChange()
  })

  observer.observe(inputSpan, {
    childList: true,
    subtree: true,
    characterData: true
  })

  // 关键事件监听
  const events = ['keydown', 'input', 'paste', 'cut', 'blur']
  events.forEach(evt => {
    inputSpan.addEventListener(evt, (e) => {
      if (e.type === 'keydown' && ((e as KeyboardEvent).key === 'Backspace' || (e as KeyboardEvent).key === 'Delete')) {
        // 对删除操作做特殊处理
        setTimeout(handleChange, 0)
      } else {
        handleChange()
      }
    })
  })

  // 初始状态设置
  handleChange()
}

/**
 * 显示下拉菜单并优化定位
 * @param target - 目标元素
 * @param type - 选项类型
 */
const showDropdownMenu = async (target: HTMLElement, type: string): Promise<void> => {
  currentTarget.value = target
  currentField.value = type
  currentOptions.value = OPTIONS.value[type] || []
  showDropdown.value = true

  await nextTick()

  // 使用getBoundingClientRect()获取精确位置
  const targetRect = target.getBoundingClientRect()
  const containerRect = smartInputRef.value?.getBoundingClientRect()

  if (!containerRect) return

  // 计算相对于容器的位置
  const relativeTop = targetRect.bottom - containerRect.top
  const relativeLeft = targetRect.left - containerRect.left

  // 设置下拉框位置，确保在标签正下方并保持适当间距
  dropdownStyle.value.top = `${relativeTop + 4}px` // 4px垂直间距
  dropdownStyle.value.left = `${relativeLeft}px`

  // 确保下拉框不超出视窗边界
  if (dropdownMenuRef.value) {
    const dropdownRect = dropdownMenuRef.value.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // 水平边界检查
    if (dropdownRect.right > viewportWidth) {
      const adjustment = dropdownRect.right - viewportWidth + 10
      dropdownStyle.value.left = `${relativeLeft - adjustment}px`
    }

    // 垂直边界检查 - 如果下方空间不足，显示在上方
    if (dropdownRect.bottom > viewportHeight) {
      const relativeTopAbove = targetRect.top - containerRect.top - dropdownRect.height
      dropdownStyle.value.top = `${relativeTopAbove - 4}px` // 4px垂直间距
    }
  }
}

/**
 * 选择下拉选项
 * 更新字段值并刷新显示内容
 */
const selectOption = (option: string) => {
  if (currentField.value && currentTarget.value) {
    // 更新字段值存储
    fieldValues.value[currentField.value] = option

    // 直接更新当前点击的目标元素显示内容
    currentTarget.value.textContent = option

    // 同时更新data-value属性
    currentTarget.value.setAttribute('data-value', option)
  }
  hideDropdown()
}

/**
 * 隐藏下拉菜单
 */
const hideDropdown = (): void => {
  showDropdown.value = false
  currentTarget.value = null
  currentOptions.value = []
}



/**
 * 处理点击外部区域事件
 * 当用户点击组件外部时自动隐藏下拉菜单
 */
const handleClickOutside = (event: Event): void => {
  if (!showDropdown.value) return

  const target = event.target as Node
  const isClickInsideDropdown = dropdownMenuRef.value?.contains(target)
  const isClickInsideContainer = smartInputRef.value?.contains(target)
  if (!isClickInsideDropdown) {
    hideDropdown()
  }
}

/**
 * 生命周期钩子
 */

/**
 * 组件挂载时添加全局点击事件监听
 */
onMounted(() => {
  console.log('组件挂载监听handleClickOutside');
  document.addEventListener('click', handleClickOutside)
})

/**
 * 组件卸载时移除事件监听，防止内存泄漏
 */
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.rich-input-container {
  position: relative;
  width: 100%;
  border-radius: 4px;
  border: 1px solid #ddd;
  min-height: 200px;
}

.smart-input {
  padding: 8px;
  line-height: 1.4;
  min-height: 200px;
  display: block;
  background-color: #fff;
  font-size: 14px;
  /* 确保容器能够根据内容自动增高 */
  height: auto;
  overflow: visible;
  /* 移除任何可能的高度限制 */
  max-height: none;
  /* 确保文本能够在字符级别换行 */
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
}

/* 标签字段保持inline-block以维持独立性和交互功能 */
.smart-input .highlight {
  display: inline-block;
  vertical-align: baseline;
}

.highlight {
  background-color: #e0f0ff;
  border-radius: 3px;
  padding: 4px;
  cursor: pointer;
  min-width: 20px;
  transition: background-color 0.2s ease;
}

/* 输入类型标签样式 */
.editable-field {
  padding: 4px;
}

.highlight:hover {
  background-color: #d0e8ff;
}

/* 输入文本样式 - 深蓝色显示 */
.highlight .input {
  color: #264cad;
  /* 深蓝色 RGB(0,0,139) */
  font-weight: 500;
}

/* 占位符样式 */
.highlight .placeholder {
  font-style: normal;
  color: #6e7ca0;
  pointer-events: none;
}

/* 已填写内容样式 */
.highlight:not(:has(.placeholder[style*="display: inline"])) {
  background-color: #e7eff7;
}

.dropdown-menu {
  position: absolute;
  border: 1px solid #eee;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  z-index: 1000;
  min-width: 120px;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.dropdown-item:hover {
  background: #f5f5f5;
}

.dropdown-item:first-child {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

.dropdown-item:last-child {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}
</style>