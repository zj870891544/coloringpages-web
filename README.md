# 花瓣填色

一个简单易用的在线填色应用。

## 功能特性
- 智能填色工具
- 橡皮擦功能
- 取色器
- 上一步/下一步操作
- 撤销/清空功能
- 图片上传功能
- 画布缩放功能

## 技术栈
- HTML5 Canvas
- 原生 JavaScript
- CSS3

## 主要功能
1. 填色功能
   - 智能边界识别
   - 防止颜色溢出
2. 历史记录
   - 支持多步撤销/重做
   - 保存原始状态
3. 图片处理
   - 支持上传自定义图片
   - 自动缩放适配画布
4. 用户界面
   - 响应式设计
   - 直观的操作方式

## 项目结构 coloringpages-web/
├── index.html # 主页面
├── styles.css # 样式文件
├── app.js # 主应用逻辑
├── gallery.js # 画廊管理
├── convert.html # 图片转换页面
├── icons/ # 图标文件夹
│ ├── fill.svg
│ ├── eraser.svg
│ ├── eyedropper.svg
│ ├── prev.svg
│ ├── next.svg
│ ├── undo.svg
│ └── clear.svg
└── templates/ # 模板文件夹
## 开发者
samzhang

## 许可证
MIT