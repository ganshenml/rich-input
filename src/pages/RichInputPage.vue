<script setup lang="ts">
import { ref } from 'vue'
import RichInput from '@/components/RichInput.vue'
import type { RichInputConfig } from '@/types/rich-input'

/**
 * 独立的智能编辑器页面
 * 提供单独入口以便从首页跳转进入
 */

// 默认模板配置（与首页示例一致，便于直接使用）
const defaultConfig: RichInputConfig = {
  // 使用多行模板字面量以呈现换行，配合 .smart-input 的 white-space: pre-wrap
  template: `我是一名{role}
需要写一篇关于{topic}的{format}。
面向{audience}宣传产品。`,
  fields: {
    role: { type: 'input', placeholder: '公众号博主', defaultValue: '公众号博主' },
    topic: { type: 'select', options: ['科技', '教育', '健康'], defaultValue: '[主题]' },
    format: { type: 'select', options: ['文章', '报告', '论文'], defaultValue: '文章' },
    audience: { type: 'input', placeholder: '[人群]', defaultValue: '' }
  }
}

// 当前配置（可扩展为从路由或状态管理注入）
const currentConfig = ref<RichInputConfig>(defaultConfig)
</script>

<template>
  <div class="editor-page">
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-center mb-8 text-gray-800">智能文本编辑器</h1>
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-lg shadow-lg p-6">
          <p class="text-gray-600 mb-6">
            这是一个支持动态模板和智能提示的富文本输入组件，点击高亮区域可以编辑或选择内容。
          </p>
          <RichInput :config="currentConfig" />
        </div>

        <div class="mt-6 text-center">
          <RouterLink to="/" class="inline-block px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
            返回首页
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
  
</template>

<style scoped>
.editor-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.container {
  max-width: 1200px;
}
</style>
