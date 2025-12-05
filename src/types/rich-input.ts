/**
 * RichInput 相关类型定义
 * 将类型与组件实现解耦，便于在各页面与模块中复用
 */

export type FieldType = 'input' | 'select'

export interface InputField {
  type: 'input'
  placeholder: string
  defaultValue: string
}

export interface SelectField {
  type: 'select'
  options: string[]
  defaultValue: string
}

export type Field = InputField | SelectField

export interface RichInputConfig {
  template: string
  fields: Record<string, Field>
}

