# 🎨 AI 人物换装系统

纯前端的智能人物衣服转换应用。上传两张人物图片，AI 将自动识别并将第一张图中的衣服转移到第二张图中的人物身上。

## ✨ 功能特点

- 🤖 **AI 驱动**：采用 MediaPipe 和 TensorFlow.js 进行深度学习
- 👥 **人物检测**：自动检测图像中的人物和衣服区域
- 🧵 **精确分割**：使用先进的图像分割算法
- 🌈 **智能合成**：自然融合衣服纹理和色彩
- 📱 **响应式设计**：完全支持移动端
- ⚡ **高性能**：所有处理在客户端进行，无需服务器

## 🛠️ 技术栈

### 核心库
- **MediaPipe**：人体检测和分割
- **TensorFlow.js**：深度学习推理
- **OpenCV.js**：图像处理和计算机视觉
- **Canvas API**：图像合成和渲染

### 项目结构
```
ai_clothing/
├── index.html              # 主页面
├── styles/
│   └── style.css          # 样式表
├── src/
│   ├── imageProcessor.js  # 图像处理模块
│   ├── detection.js       # 人物检测模块
│   ├── segmentation.js    # 分割引擎
│   ├── synthesis.js       # 衣服合成模块
│   └── ui.js             # UI 交互控制
└── README.md
```

## 🚀 快速开始

### 本地运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/yangqingKing/ai_clothing.git
   cd ai_clothing
   ```

2. **启动本地服务器**
   ```bash
   # 使用 Python
   python -m http.server 8000
   
   # 或使用 Node.js
   npx http-server
   ```

3. **打开浏览器**
   访问 `http://localhost:8000`

### 在线使用
将项目部署到任何静态托管服务（GitHub Pages、Vercel、Netlify 等）

## 📖 使用指南

### 步骤 1：上传图片
- 上传**第一张图片**（衣服来源）：应该是穿着你想要的衣服的人物
- 上传**第二张图片**（目标人物）：应该是穿着其他衣服的人物

### 步骤 2：开始处理
- 点击 "🚀 开始换装" 按钮
- 等待 AI 处理（通常需要 5-10 秒）
- 系统会显示处理进度

### 步骤 3：保存结果
- 处理完成后，点击 "💾 下载结果" 保存生成的图片
- 或点击 "🔄 重置" 进行新的转换

## 💡 最佳实践

### 图像要求
- ✅ **清晰的人物正面照**：效果最佳
- ✅ **合适的尺寸**：建议 512×512 或更大
- ✅ **良好的光照**：避免过暗或过亮
- ✅ **简洁背景**：避免背景过于复杂

### 注意事项
- ⚠️ 避免极端角度或姿态
- ⚠️ 避免图像模糊或失焦
- ⚠️ 避免极端色调调整
- ⚠️ 避免极端肤色或衣服颜色对比

## 🔧 API 文档

### ImageProcessor
```javascript
// 从文件加载图像
const img = await imageProcessor.loadImageFromFile(file);

// 设置图像
imageProcessor.setSourceImage(img);
imageProcessor.setTargetImage(img);

// 格式转换
const canvas = imageProcessor.imageToCanvas(img);
const blob = await imageProcessor.canvasToBlob(canvas);
```

### PersonDetector
```javascript
// 初始化模型
await personDetector.initialize();

// 检测人物
const result = await personDetector.detectPerson(canvas);

// 提取衣服
const mask = personDetector.extractClothingMask(result);
```

### SegmentationEngine
```javascript
// 分割衣服
const clothingSeg = await segmentationEngine.segmentClothing(canvas);

// 分割人物
const personSeg = await segmentationEngine.segmentPerson(canvas);
```

### ClothingSynthesis
```javascript
// 转移衣服
const result = await clothingSynthesis.transferClothing(
    sourceCanvas,
    targetCanvas,
    segmentationResults
);
```

## 🎯 改进方向

未来计划的功能：
- [ ] 支持视频输入
- [ ] 多人物检测
- [ ] 衣服颜色调整
- [ ] 衣服风格变换
- [ ] 批量处理
- [ ] WebGL 加速
- [ ] 模型优化（使用更轻的模型）
- [ ] 实时摄像头预览

## 🌐 浏览器兼容性

| 浏览器 | 最低版本 | 状态 |
|--------|---------|------|
| Chrome | 90+ | ✅ 完全支持 |
| Firefox | 88+ | ✅ 完全支持 |
| Safari | 14+ | ✅ 完全支持 |
| Edge | 90+ | ✅ 完全支持 |

## ⚡ 性能优化

### 内存管理
- 使用 Web Worker 处理繁重计算
- 及时释放 OpenCV 的 Mat 对象
- 压缩中间图像尺寸

### 加载优化
- CDN 加载所有依赖库
- 延迟加载模型文件
- 使用渐进式增强

## 🐛 故障排除

### 模型加载失败
- 检查网络连接
- 清除浏览器缓存
- 尝试切换浏览器

### 处理超时
- 尝试使用更小的图像
- 关闭其他标签页释放内存
- 等待一段时间后重试

### 结果不理想
- 确保图像清晰
- 使用正面照片
- 调整衣服来源图片

## 📜 许可证

MIT License - 详见 LICENSE 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

- GitHub: [@yangqingKing](https://github.com/yangqingKing)
- Issue: [提交 Issue](https://github.com/yangqingKing/ai_clothing/issues)

---

**⭐ 如果这个项目对您有帮助，请给一个 Star！**