/**
 * 人物检测模块 (简化版 - 不依赖 MediaPipe)
 * 使用纯 JavaScript 算法进行人体检测和衣服区域识别
 */

class PersonDetector {
    constructor() {
        this.isInitialized = false;
        this.lastResults = null;
    }

    /**
     * 初始化模型（无需加载外部库）
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('初始化人体检测模块...');
            
            // 简单的初始化，无需等待外部库
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.isInitialized = true;
            console.log('人体检测模块初始化成功');
        } catch (error) {
            console.error('模块初始化失败:', error);
            throw new Error('人体检测初始化失败: ' + error.message);
        }
    }

    /**
     * 处理分割结果
     * @param {object} results - 分割结果
     */
    onSegmentationResults(results) {
        this.lastResults = results;
    }

    /**
     * 检测图像中的人体（基于肤色和对比度）
     * @param {HTMLCanvasElement|HTMLImageElement} input - 输入图像
     * @returns {Promise<object>} 分割掩码
     */
    async detectPerson(input) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // 创建临时 canvas 用于处理
            let canvas = input;
            if (input instanceof HTMLImageElement) {
                canvas = imageProcessor.imageToCanvas(input);
            }

            // 使用基于肤色的检测方法
            return this.detectBySkinColor(canvas);
        } catch (error) {
            console.error('人体检测失败:', error);
            // 返回后备分割结果而不是抛出错误
            return this.createFallbackSegmentation(input instanceof HTMLCanvasElement ? input : imageProcessor.imageToCanvas(input));
        }
    }

    /**
     * 基于肤色的人体检测
     * @param {HTMLCanvasElement} canvas - 输入画布
     * @returns {object}
     */
    detectBySkinColor(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 创建掩码数组
        const maskData = new Float32Array(width * height);

        // 遍历每个像素
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            const pixelIndex = i / 4;

            // 如果像素完全透明，跳过
            if (a === 0) {
                maskData[pixelIndex] = 0;
                continue;
            }

            // 计算肤色概率
            const skinProb = this.calculateSkinColorProbability(r, g, b);

            // 如果像素看起来像肤色，标记为前景
            if (skinProb > 0.3) {
                maskData[pixelIndex] = skinProb;
            } else {
                // 检查是否是衣服相关颜色（更深色或饱和度高）
                const clothingProb = this.calculateClothingColorProbability(r, g, b);
                maskData[pixelIndex] = clothingProb;
            }
        }

        // 应用图像处理改进掩码
        const improvedMask = this.improveMask(maskData, width, height);

        return {
            mask: { data: improvedMask },
            canvas: canvas,
            width: width,
            height: height
        };
    }

    /**
     * 计算像素是否为肤色的概率
     * @param {number} r - 红色分量
     * @param {number} g - 绿色分量
     * @param {number} b - 蓝色分量
     * @returns {number} 概率 (0-1)
     */
    calculateSkinColorProbability(r, g, b) {
        // 肤色通常满足：R > G > B，且 R 和 G 接近
        // 这是一个简化的肤色模型

        // 检查基本条件
        if (r < 50 || g < 40 || b < 30) {
            return 0; // 太暗
        }

        if (r > 250 && g > 240 && b > 240) {
            return 0; // 太亮（接近白色）
        }

        // 计算色度差异
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        const lightness = (maxVal + minVal) / 510;

        // 计算饱和度
        const saturation = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;

        // 肤色应该有适度的亮度和低饱和度
        let prob = 0;

        // 检查 R > G > B 的条件
        if (r > g && g > b) {
            prob = 0.7;
        } else if (r > g && g >= b) {
            prob = 0.5;
        }

        // 根据亮度调整
        if (lightness > 0.3 && lightness < 0.8) {
            prob *= 1.2;
        } else {
            prob *= 0.5;
        }

        // 低饱和度优先
        if (saturation < 0.4) {
            prob *= 1.3;
        }

        return Math.min(1, prob);
    }

    /**
     * 计算像素是否为衣服颜色的概率
     * @param {number} r - 红色分量
     * @param {number} g - 绿色分量
     * @param {number} b - 蓝色分量
     * @returns {number} 概率 (0-1)
     */
    calculateClothingColorProbability(r, g, b) {
        // 衣服颜色通常更暗或更饱和
        
        const maxVal = Math.max(r, g, b);
        const minVal = Math.min(r, g, b);
        
        // 避免纯白和纯黑
        if (maxVal < 30 || (r > 240 && g > 240 && b > 240)) {
            return 0;
        }

        // 计算平均值和饱和度
        const avg = (r + g + b) / 3;
        const saturation = maxVal === 0 ? 0 : (maxVal - minVal) / maxVal;
        
        // 衣服通常有高饱和度或中等深度
        let prob = 0;
        
        if (saturation > 0.3) {
            // 高饱和度 - 可能是衣服
            prob = Math.min(1, saturation);
        } else if (avg < 200 && avg > 50) {
            // 中等深度 - 可能是衣服
            prob = 0.4;
        }

        return prob;
    }

    /**
     * 改进掩码质量
     * @param {Float32Array} maskData - 原始掩码
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {Float32Array} 改进后的掩码
     */
    improveMask(maskData, width, height) {
        const improved = new Float32Array(maskData);
        
        // 应用简单的中值滤波来平滑掩码
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // 收集周围像素
                const neighbors = [
                    improved[(y - 1) * width + (x - 1)],
                    improved[(y - 1) * width + x],
                    improved[(y - 1) * width + (x + 1)],
                    improved[y * width + (x - 1)],
                    improved[idx],
                    improved[y * width + (x + 1)],
                    improved[(y + 1) * width + (x - 1)],
                    improved[(y + 1) * width + x],
                    improved[(y + 1) * width + (x + 1)]
                ];
                
                // 计算中值
                neighbors.sort((a, b) => a - b);
                const median = neighbors[4];
                
                // 应用平滑（权重中值）
                improved[idx] = improved[idx] * 0.6 + median * 0.4;
            }
        }

        return improved;
    }

    /**
     * 创建后备分割结果（当实际分割失败时使用）
     * @param {HTMLCanvasElement} canvas - 输入画布
     * @returns {object}
     */
    createFallbackSegmentation(canvas) {
        console.warn('使用后备分割方案');
        
        // 创建一个简单的前景/背景掩码
        const width = canvas.width;
        const height = canvas.height;
        const maskData = new Float32Array(width * height);
        
        // 简单策略：将中间区域标记为前景（人体）
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2.8;

        for (let i = 0; i < maskData.length; i++) {
            const y = Math.floor(i / width);
            const x = i % width;
            
            // 计算到中心的距离
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 距离中心越近，置信度越高
            maskData[i] = Math.max(0, 1 - distance / maxRadius);
        }

        return {
            mask: { data: maskData },
            canvas: canvas,
            width: width,
            height: height
        };
    }

    /**
     * 从分割掩码提取衣服区域
     * @param {object} detectionResult - 检测结果
     * @returns {HTMLCanvasElement} 衣服掩码
     */
    extractClothingMask(detectionResult) {
        const { mask, canvas, width, height } = detectionResult;
        const clothingMask = document.createElement('canvas');
        clothingMask.width = width;
        clothingMask.height = height;
        const ctx = clothingMask.getContext('2d', { willReadFrequently: true });

        // 绘制原图像
        ctx.drawImage(canvas, 0, 0);

        // 获取掩码数据
        const maskData = new Float32Array(mask.data);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 优化衣服区域检测
        // 衣服通常在躯干中间部分
        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const maskValue = maskData[pixelIndex];

            // 如果是人体区域（置信度 > 0.2）
            if (maskValue > 0.2) {
                // 衣服区域检测：检查是否在躯干区域
                const isInTrunkArea = this.isInClothingArea(pixelIndex, width, height, maskData);
                if (!isInTrunkArea) {
                    // 不在躯干区域，设为透明
                    data[i + 3] = 0;
                }
            } else {
                // 非人体区域，设为透明
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return clothingMask;
    }

    /**
     * 判断像素是否在衣服区域（躯干）
     * @param {number} pixelIndex - 像素索引
     * @param {number} width - 图像宽度
     * @param {number} height - 图像高度
     * @param {Float32Array} maskData - 掩码数据
     * @returns {boolean}
     */
    isInClothingArea(pixelIndex, width, height, maskData) {
        const y = Math.floor(pixelIndex / width);
        const x = pixelIndex % width;

        // 衣服通常位于图像的中间部分
        const topThreshold = height * 0.2;   // 头部
        const bottomThreshold = height * 0.9; // 腿部

        if (y < topThreshold || y > bottomThreshold) {
            return false;
        }

        return true;
    }

    /**
     * 清空缓存
     */
    clear() {
        this.lastResults = null;
    }
}

// 创建全局实例
const personDetector = new PersonDetector();
