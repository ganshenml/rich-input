<script setup lang="ts">
import { ref } from 'vue'
import RichInput from '@/components/RichInput.vue'
import type { RichInputConfig } from '@/types/rich-input'

/**
 * 首页组件
 * 集成智能输入组件展示
 */

// 示例配置1：默认配置
const defaultConfig: RichInputConfig = {
  // 多行模板字面量 + pre-wrap，确保默认示例也显示换行
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

// 示例配置2：产品介绍模板
const productConfig: RichInputConfig = {
  template: "我们的{product}是一款{category}产品，主要面向{target}用户，具有{feature}特点，价格为{price}。",
  fields: {
    product: { type: 'input', placeholder: '产品名称', defaultValue: '' },
    category: { type: 'select', options: ['软件', '硬件', '服务'], defaultValue: '软件' },
    target: { type: 'select', options: ['企业', '个人', '学生'], defaultValue: '企业' },
    feature: { type: 'input', placeholder: '核心特点', defaultValue: '' },
    price: { type: 'input', placeholder: '价格', defaultValue: '' }
  }
}

// 示例配置3：活动策划模板
const eventConfig: RichInputConfig = {
  template: "计划在{date}举办{event}活动，地点在{location}，预计参与人数{people}人，活动主题是{theme}。",
  fields: {
    date: { type: 'input', placeholder: '活动日期', defaultValue: '' },
    event: { type: 'select', options: ['会议', '培训', '聚会', '展览'], defaultValue: '会议' },
    location: { type: 'input', placeholder: '活动地点', defaultValue: '' },
    people: { type: 'input', placeholder: '人数', defaultValue: '' },
    theme: { type: 'input', placeholder: '活动主题', defaultValue: '' }
  }
}

// 当前选中的配置
const currentConfig = ref<RichInputConfig>(defaultConfig)
const selectedTemplate = ref('default')

/**
 * 切换模板配置
 * @param templateType - 模板类型
 */
const switchTemplate = (templateType: string): void => {
  selectedTemplate.value = templateType
  switch (templateType) {
    case 'product':
      currentConfig.value = productConfig
      break
    case 'event':
      currentConfig.value = eventConfig
      break
    default:
      currentConfig.value = defaultConfig
  }
}
</script>

<template>
  <div class="home-page">
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-center mb-8 text-gray-800">
        智能输入组件演示
      </h1>
      
      <div class="max-w-4xl mx-auto">
        <!-- 模板选择器 -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4 text-gray-700">
            模板选择器
          </h2>
          <p class="text-gray-600 mb-4">
            选择不同的模板来体验动态文本渲染功能：
          </p>
          
          <div class="flex flex-wrap gap-3 mb-4">
            <button 
              @click="switchTemplate('default')"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors',
                selectedTemplate === 'default' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              内容创作模板
            </button>
            <button 
              @click="switchTemplate('product')"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors',
                selectedTemplate === 'product' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              产品介绍模板
            </button>
            <button 
              @click="switchTemplate('event')"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-colors',
                selectedTemplate === 'event' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              活动策划模板
            </button>
          </div>
          
          <div class="text-sm text-gray-500">
            <p><strong>当前模板：</strong></p>
            <code class="bg-gray-100 px-2 py-1 rounded text-xs mt-1 inline-block">
              {{ currentConfig.template }}
            </code>
          </div>
        </div>
        
        <!-- 智能输入组件演示 -->
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-xl font-semibold mb-4 text-gray-700">
            智能文本编辑器
          </h2>
          <p class="text-gray-600 mb-6">
            这是一个支持动态模板和智能提示的富文本输入组件，点击高亮区域可以编辑或选择内容。
          </p>

          <!-- 独立入口：点击进入编辑器页面 -->
          <div class="mb-6">
            <RouterLink
              to="/editor"
              class="inline-block px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              进入智能编辑器
            </RouterLink>
          </div>
          
          <!-- 集成RichInput组件，传入动态配置 -->
          <RichInput :config="currentConfig" />
          
          <div class="mt-6 text-sm text-gray-500">
            <p>功能说明：</p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              <li>深蓝色文本区域支持直接编辑输入</li>
              <li>高亮区域支持选择预设选项</li>
              <li>支持占位符提示和动态模板渲染</li>
              <li>基于JSON配置的灵活模板系统</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.container {
  max-width: 1200px;
}
</style>
