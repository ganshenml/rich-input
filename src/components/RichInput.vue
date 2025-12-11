<template>
  <div class="rich-input-container" ref="containerRef">
    <!-- 智能输入框主体 -->
    <div ref="smartInputRef" class="smart-input" contenteditable="true" :key="renderKey" @click="handleInputClick" @input="handleContainerInput">
      <template v-for="(segment, index) in templateSegments" :key="index">
        <!-- 普通文本片段 -->
        <template v-if="segment.type === 'text'">
          {{ segment.content }}
        </template>

        <!-- 输入字段片段 -->
        <span v-else-if="segment.fieldConfig?.type === 'input'" contenteditable="true" class="highlight editable-field"
          :data-placeholder="segment.fieldConfig.placeholder" :data-field-key="segment.fieldKey"
          @click="handleEditableClick">
          <span class="input" style="padding-left: 0">
            {{ segment.fieldConfig.defaultValue || '' }}
          </span>
          <!-- 占位符显隐改由 data-has-content 属性 + CSS 控制，避免交互后重置为默认样式 -->
          <span contenteditable="false" class="placeholder" :style="{
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: '0.7'
          }">
            {{ segment.fieldConfig.placeholder }}
          </span>
        </span>

        <!-- 选择字段片段 -->
        <span v-else-if="segment.fieldConfig?.type === 'select'" class="highlight dropdown-field"
          :data-type="segment.fieldKey" :data-value="segment.content" :data-field-key="segment.fieldKey"
          contenteditable="false" @click="handleDropdownClick">
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
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import type { CSSProperties } from 'vue'

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
    // 模板支持换行显示：使用多行模板字面量，结合 .smart-input 的 white-space: pre-wrap
    template: `我是一名{role}
需要写一篇关于{topic}的{format}。
面向{audience}宣传产品。`,
    fields: {
      role: { type: 'input', placeholder: '公众号博主', defaultValue: '公众号博主' },
      topic: { type: 'select', options: ['科技', '教育', '健康'], defaultValue: '[主题]' },
      format: { type: 'select', options: ['文章', '报告', '论文'], defaultValue: '文章' },
      audience: { type: 'input', placeholder: '[人群]', defaultValue: '' }
    }
  })
})

/**
 * 组件事件：当字段值变更时通知父组件
 * 提供完整的当前文本与字段值快照
 */
const emit = defineEmits<{
  (e: 'change', payload: { text: string; values: Record<string, string> }): void
}>()

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
const containerRef = ref<HTMLDivElement | null>(null)
const smartInputRef = ref<HTMLDivElement | null>(null)
const dropdownMenuRef = ref<HTMLDivElement | null>(null)

// 下拉菜单状态
const showDropdown = ref(false)
const currentField = ref('') // 当前激活的字段
const currentTarget = ref<HTMLElement | null>(null) // 当前点击的目标元素
const currentOptions = ref<string[]>([]) // 当前字段的选项列表

// 下拉菜单样式：使用 CSSProperties 保证 TS 校验通过
const dropdownStyle = ref<CSSProperties>({
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
 * 渲染键值
 * 用于强制Vue重新渲染整个组件
 */
const renderKey = ref(0)

/**
 * 生成当前完整文本（替换模板中的占位符为当前字段值或默认值）
 */
const getCurrentText = (): string => {
  const template = props.config.template
  return template.replace(/\{([^}]+)\}/g, (_matched: string, key: string) => {
    const field = props.config.fields[key]
    if (!field) return `{${key}}`
    const value = fieldValues.value[key]
    // 两种字段类型都存在 defaultValue，缺失时退回到占位方括号
    return (value ?? (field as { defaultValue?: string }).defaultValue ?? `[${key}]`)
  })
}

/**
 * 获取可见文本（WYSIWYG）：读取 DOM 的 innerText，排除 display:none 的占位符
 * 同时移除零宽字符，保持文本干净
 */
const getDisplayText = (): string => {
  const el = smartInputRef.value
  if (!el) return getCurrentText()
  const raw = (el as HTMLElement).innerText || ''
  return raw.replace(/[\u200B\uFEFF]/g, '')
}

/**
 * 获取当前所有字段值的拷贝
 */
const getValues = (): Record<string, string> => ({ ...fieldValues.value })

/**
 * 获取指定选择字段的当前选项（若非选择字段也返回其值）
 */
const getSelection = (fieldKey: string): string | undefined => fieldValues.value[fieldKey]

/**
 * 获取所有选择字段的当前选项映射
 */
const getSelections = (): Record<string, string> => {
  const result: Record<string, string> = {}
  Object.entries(props.config.fields).forEach(([key, field]) => {
    if (field.type === 'select' && fieldValues.value[key] !== undefined) {
      result[key] = fieldValues.value[key]
    }
  })
  return result
}

/**
 * 触发变更事件，通知父组件当前文本与值
 */
const emitChange = (): void => {
  try {
    // 如有统一日志工具，可替换下行 console 为 logger.info
    emit('change', { text: getDisplayText(), values: { ...fieldValues.value } })
  } catch (err) {
    // 如项目有封装日志工具，请替换为 logger.warn/err
    // 这里通常不会抛错（无监听者时Vue内部忽略），保留catch以满足严格规则
    console.warn('[RichInput] emit change failed:', err)
  }
}

/**
 * 将内部API暴露给父组件使用
 */
defineExpose({
  // 兼容原 API：保留基于字段值生成的文本
  getText: getCurrentText,
  // 新增：返回可见文本（包括容器中的自由编辑）
  getRenderedText: getDisplayText,
  getValues,
  getSelection,
  getSelections,
  getActiveFieldKey: () => currentField.value
})

/**
 * 初始化字段值
 * 根据配置设置字段的默认值
 */
const initializeFieldValues = (): void => {
  const newFieldValues: Record<string, string> = {}

  Object.entries(props.config.fields).forEach(([key, field]) => {
    newFieldValues[key] = field.defaultValue || ''
  })

  fieldValues.value = newFieldValues
  console.log('字段值已初始化:', fieldValues.value)

  // 强制触发视图更新，确保DOM与数据同步
  nextTick(() => {
    resetInputFieldsDOM()
  })
}

/**
 * 重置输入字段的DOM状态
 * 确保输入字段的显示与fieldValues同步
 */
const resetInputFieldsDOM = (): void => {
  if (!smartInputRef.value) return

  // 查找所有可编辑字段并重置其DOM状态
  const editableFields = smartInputRef.value.querySelectorAll('.editable-field')
  editableFields.forEach((field) => {
    const fieldKey = field.getAttribute('data-field-key')
    if (!fieldKey) return

    const inputSpan = field.querySelector('.input') as HTMLElement
    const placeholderSpan = field.querySelector('.placeholder') as HTMLElement

    if (inputSpan && placeholderSpan) {
      const currentValue = fieldValues.value[fieldKey] || ''

      // 清空输入区域并设置新值
      inputSpan.innerHTML = ''
      if (currentValue) {
        inputSpan.appendChild(document.createTextNode(currentValue))
        // 使用属性控制占位符显隐，避免交互后样式回退
        ;(field as HTMLElement).setAttribute('data-has-content', 'true')
      } else {
        // 插入零宽占位字符，确保空内容时仍可聚焦和输入
        inputSpan.appendChild(document.createTextNode('\u200B'))
        ;(field as HTMLElement).setAttribute('data-has-content', 'false')
      }
    }
  })

  console.log('输入字段DOM状态已重置')
}

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

// 容器级输入事件：任意位置变更均上报（不修改 fieldValues，只更新 text）
const handleContainerInput = (_evt: Event): void => {
  emitChange()
}



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

  // 初始点击后将光标定位到 inputSpan 文本末尾，确保输入发生在字段内
  try {
    const textNode = inputSpan.firstChild as Text
    const range = document.createRange()
    const len = textNode?.textContent?.length ?? 0
    range.setStart(textNode, Math.max(len, 0))
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  } catch (err) {
    // 如项目有封装日志工具，这里可替换为 logger.warn
    console.warn('[RichInput] Failed to set caret to input end:', err)
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
      newSpan.appendChild(document.createTextNode('\u200B'))
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
    const rawText = currentSpan.textContent ?? ''
    const normalized = rawText.replace(/[\u200B\uFEFF]/g, '')
    const hasContent = normalized.trim() !== ''

    if (!hasContent) {
      // 空内容：插入零宽占位字符，保证可编辑和光标可定位
      isProgrammaticChange = true
      currentSpan.innerHTML = ''
      const textNode = document.createTextNode('\u200B')
      currentSpan.appendChild(textNode)

      // 将光标定位到占位字符后
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

    // 用属性控制占位符显隐，在任何交互下都不回退到模板的默认行内样式
    target.setAttribute('data-has-content', hasContent ? 'true' : 'false')

    // 同步可编辑字段值到内部存储，以便父组件查询与事件通知
    const fieldKey = target.getAttribute('data-field-key')
    if (fieldKey) {
      fieldValues.value[fieldKey] = normalized.trim()
      emitChange()
    }
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

  // 关键事件监听：绑定到高亮块（编辑宿主）
  const events = ['keydown', 'input', 'paste', 'cut', 'blur']
  events.forEach(evt => {
    target.addEventListener(evt, (e) => {
      if (e.type === 'keydown') {
        const key = (e as KeyboardEvent).key
        const raw = inputSpan.textContent ?? ''
        const isEmpty = raw.replace(/[\u200B\uFEFF]/g, '').trim() === ''

        if ((key === 'Backspace' || key === 'Delete') && isEmpty) {
          // 空内容下允许继续删除该高亮样式：移除整个 editable-field 包裹
          e.preventDefault()

          const parent = target.parentNode
          const prev = target.previousSibling
          const next = target.nextSibling
          target.remove()

          // 将光标定位到相邻节点（优先前一个，否则后一个），以便用户继续删除
          const range = document.createRange()
          const sel = window.getSelection()

          const focusNode = (node: Node | null): Node | null => {
            if (!node) return null
            if (node.nodeType === 3) return node
            // 寻找元素内最后一个文本节点
            const walker = document.createTreeWalker(node as Node, NodeFilter.SHOW_TEXT)
            let lastText: Node | null = null
            while (walker.nextNode()) lastText = walker.currentNode
            return lastText || node
          }

          const nodeForCaret = focusNode(prev) || focusNode(next) || parent || inputSpan
          const length = nodeForCaret.nodeType === 3 ? (nodeForCaret.textContent?.length || 0) : (nodeForCaret.childNodes.length)
          try {
            range.setStart(nodeForCaret, Math.max(length, 0))
            range.collapse(true)
            sel?.removeAllRanges()
            sel?.addRange(range)
          } catch (err) {
            // 光标定位失败时的降级处理：回退到整体输入容器末尾
            // 说明：在某些边界情况下（例如目标节点文本长度为 0，或不可编辑节点），setStart 可能抛出异常。
            // 为避免用户输入被中断，这里将光标安全地定位到 smart-input 容器的末尾。
            try {
              if (smartInputRef.value) {
                const endRange = document.createRange()
                endRange.selectNodeContents(smartInputRef.value)
                endRange.collapse(false)
                sel?.removeAllRanges()
                sel?.addRange(endRange)
              }
              // 如项目有封装的日志工具，这里可替换为 logger.warn
              console.warn('[RichInput] Caret fallback to container end due to setStart error:', err)
            } catch (fallbackErr) {
              // 二次降级失败：静默处理，确保不影响后续编辑
              // 如项目有封装的日志工具，这里可替换为 logger.error
              console.warn('[RichInput] Caret fallback failed:', fallbackErr)
            }
          }

          // 同步占位显示（父节点已移除，不再需要处理）
          return
        }

        // 非删除或非空内容，常规变化
        if (key === 'Backspace' || key === 'Delete') {
          setTimeout(handleChange, 0)
        } else {
          handleChange()
        }
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

  // 使用 getBoundingClientRect + 容器 rect 更稳健地计算相对位置
  const containerEl = containerRef.value
  if (!containerEl) return
  const targetRect = target.getBoundingClientRect()
  const containerRect = containerEl.getBoundingClientRect()

  // 相对容器的左上角坐标（加入容器滚动补偿）
  const anchorLeft = targetRect.left - containerRect.left + containerEl.scrollLeft
  const anchorTop = targetRect.bottom - containerRect.top + containerEl.scrollTop + 4 // 4px 下方间距

  dropdownStyle.value.top = `${anchorTop}px`
  dropdownStyle.value.left = `${anchorLeft}px`

  // 边界检查：仅水平回收，保证菜单始终在槽位下方
  if (dropdownMenuRef.value) {
    const dropdownWidth = dropdownMenuRef.value.offsetWidth
    const containerWidth = containerEl.clientWidth
    const predictedRight = anchorLeft + dropdownWidth
    if (predictedRight > containerWidth) {
      const adjustment = predictedRight - containerWidth + 10 // 右侧留白
      dropdownStyle.value.left = `${Math.max(anchorLeft - adjustment, 0)}px`
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
  // 通知父组件变更
  emitChange()
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
 * 监听配置变化，重新初始化字段值并强制重新渲染
 */
watch(
  () => props.config,
  (newConfig, oldConfig) => {
    if (newConfig !== oldConfig) {
      console.log('配置已变化，重新初始化字段值并强制重新渲染');
      // 更新渲染键值强制Vue重新渲染整个组件
      renderKey.value += 1
      // 重新初始化字段值
      initializeFieldValues()
    }
  },
  { deep: true, immediate: false }
)

/**
 * 组件挂载时添加全局点击事件监听并初始化字段值
 */
onMounted(() => {
  console.log('组件挂载监听handleClickOutside');
  document.addEventListener('click', handleClickOutside)

  // 初始化字段值
  initializeFieldValues()
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
  /* 科技感主题（indigo）：统一为 #6366F1 并增强圆角可见性 */
  border-radius: 12px;
  /* 默认不显示边框，仅在选中（focus-within）时显示 */
  border: none;
  background: #FFFFFF; /* 保证边框与背景对比 */
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.14); /* 轻微的 indigo 阴影 */
  /* 为内部编辑区留出内缩空间，确保外部圆角边框可见 */
  padding: 6px;
  min-height: 120px;
}

/* 容器选中态：显示更深的边框颜色 */
.rich-input-container:focus-within {
  border: 1.5px solid #4F46E5; /* indigo-600 更深一点 */
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.18);
}

.smart-input {
  padding: 8px;
  line-height: 1.4;
  min-height: 120px;
  display: block;
  background-color: #fff;
  font-size: 14px;
  /* 内部编辑区圆角，避免覆盖外部圆角边框 */
  border-radius: 8px;
  /* 默认不显示边框与阴影，仅在选中时呈现 */
  border: none;
  box-shadow: none;
  /* 确保容器能够根据内容自动增高 */
  height: auto;
  overflow: visible;
  /* 移除任何可能的高度限制 */
  max-height: none;
  /* 文本换行策略：
     - break-all：确保字符级别换行（适合中英文混排、避免长词溢出）
     - overflow-wrap:anywhere：作为补充，必要时在任意位置断行，防止超长不可断字符串溢出 */
  word-break: break-all;
  overflow-wrap: anywhere;
  /* 保留文本中的换行符与空白，用于渲染模板中的 \n 和多行字符串 */
  white-space: pre-wrap;
}

/* 移除浏览器默认的焦点轮廓，避免蓝色边框 */
.smart-input:focus,
.smart-input:focus-visible {
  outline: none;
}

/* 输入类型标签样式 */
.editable-field {
  padding: 4px;
}

/* 移除可编辑字段（contenteditable）的默认焦点轮廓 */
.editable-field:focus,
.editable-field:focus-visible {
  outline: none;
}

/* 内部编辑区选中态：不显示边框与阴影，统一由外层容器体现选中 */
/* 保持 .smart-input 无边框与阴影，以避免“内侧边框”视觉干扰 */

.highlight {
  /* 科技感 indigo：半透明背景与边框统一 #6366F1 */
  background-color: rgba(99, 102, 241, 0.12);
  /* 默认无边框，选中态才显示更深边框 */
  border: none;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  min-width: 20px;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

/* 标签字段保持inline-block以维持独立性和交互功能 */
.smart-input .highlight {
  display: inline-block;
  vertical-align: baseline;
}


/* 下拉槽位：为可下拉的字段添加向下箭头（纯CSS，无SVG） */
.dropdown-field {
  position: relative; /* 为伪元素定位提供参照 */
  /* 将箭头与文本间距缩小为当前一半（约2px） */
  padding-right: 18px; /* 16px 箭头 + 2px 间距 */
}
.dropdown-field::after {
  /* 使用Unicode字符作为指示符，不使用SVG */
  content: '▾'; /* U+25BE 小下三角，跨平台可读性好 */
  position: absolute;
  right: 4px; /* 维持右侧余量，实际文本与箭头间距≈2px */
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px; /* 调大箭头尺寸以提升可见性 */
  line-height: 1;
  color: #4F46E5; /* indigo-600，与选中态边框一致 */
  opacity: 0.9;
  pointer-events: none; /* 箭头不拦截点击，点击仍触发槽位 */
}
.dropdown-field:hover::after {
  color: #4338CA; /* indigo-700，悬停稍微加深 */
}

.highlight:hover {
  /* 悬停时加深背景并轻微发光 */
  background-color: rgba(99, 102, 241, 0.18);
  /* 不在悬停态展示边框，仅在选中态展示 */
}

/* 聚焦时的可视化强化，增强科技感反馈 */
/* 高亮块选中态：仅在焦点内显示更深边框 */
.editable-field:focus-within .highlight {
  border: 1.5px solid #4F46E5; /* indigo-600 更深一点 */
}

/* 输入文本样式 - 科技感 indigo */
.highlight .input {
  color: #6366F1; /* indigo-500 */
  font-weight: 600;
}

/* 占位符样式：略浅的 indigo，保持可读性 */
.highlight .placeholder {
  font-style: normal;
  color: #A5B4FC; /* indigo-300 */
  pointer-events: none;
}

/* 占位显隐通过 data-has-content 控制，避免因交互导致行内样式回退 */
.highlight.editable-field[data-has-content="true"] .placeholder {
  display: none;
}
.highlight.editable-field[data-has-content="false"] .placeholder {
  display: inline-block;
}

/* 已填写内容样式：当有内容时降低背景透明度，维持科技感 */
.highlight.editable-field[data-has-content="true"] {
  background-color: rgba(99, 102, 241, 0.06);
}

.dropdown-menu {
  position: absolute;
  /* 下拉菜单边框采用 indigo 并增加阴影 */
  border: 1px solid rgba(99, 102, 241, 0.35);
  background: white;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.16);
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
  /* 下拉项悬停背景为轻微 indigo 透明 */
  background: rgba(99, 102, 241, 0.08);
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
