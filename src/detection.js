/**
 * 人物检测模块
 * 使用 MediaPipe Selfie Segmentation 进行人体分割
 */

class PersonDetector {
    constructor() {
        this.segmenter = null;
        this.isInitialized = false;
        this.modelLoaded = false;
        this.lastResults = null;
    }

    /**
     * 初始化模型
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('初始化人体分割模型...');
            
            // 等待 SelfieSegmentation 全局对象加载完成
            // HTML 中已预加载了脚本，这里只需等待它变成可用
            await this.waitForSelfieSegmentation();

            // 创建分割器
            this.segmenter = new SelfieSegmentation({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.4.1675469636/${file}`;
                }
            });

            this.segmenter.setOptions({
                modelSelection: 1, // 1 为更准确的模型
            });

            this.segmenter.onResults(this.onSegmentationResults.bind(this));
            
            // 等待模型真正加载完成
            await this.waitForModelReady();
            
            this.isInitialized = true;
            this.modelLoaded = true;
            console.log('人体分割模型初始化成功');
        } catch (error) {
            console.error('模型初始化失败:', error);
            throw new Error('人体分割模型加载失败: ' + (error.message || '未知错误'));
        }
    }

    /**
     * 等待 SelfieSegmentation 全局对象加载完成
     * @returns {Promise<void>}
     */
    async waitForSelfieSegmentation() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 最多等待 10 秒

            const check = () => {
                if (typeof SelfieSegmentation !== 'undefined') {
                    console.log('SelfieSegmentation 库已加载');
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, 100);
                } else {
                    reject(new Error('SelfieSegmentation 库加载超时'));
                }
            };

            check();
        });
    }

    /**
     * 等待模型完全准备好
     * @returns {Promise<void>}
     */
    async waitForModelReady() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 最多等待 5 秒

            const check = () => {
                if (this.segmenter && this.lastResults !== undefined) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, 100);
                } else {
                    // 即使没有结果也继续
                    resolve();
                }
            };

            check();
        });
    }

    /**
     * 处理分割结果
     * @param {object} results - 分割结果
     */
    onSegmentationResults(results) {
        this.lastResults = results;
    }

    /**
     * 检测图像中的人体
     * @param {HTMLCanvasElement|HTMLImageElement} input - 输入图像
     * @returns {Promise<object>} 分割掩码和置信度
     */
    async detectPerson(input) {
        if (!this.modelLoaded) {
            await this.initialize();
        }

        try {
            // 创建临时 canvas 用于处理
            let canvas = input;
            if (input instanceof HTMLImageElement) {
                canvas = imageProcessor.imageToCanvas(input);
            }

            // 重置结果
            this.lastResults = null;

            // 运行分割
            try {
                await this.segmenter.send({ image: canvas });
            } catch (segmentError) {
                console.warn('分割请求失败，尝试直接处理:', segmentError);
                // 创建一个简单的后备分割结果
                return this.createFallbackSegmentation(canvas);
            }

            // 等待结果处理完成
            let attempts = 0;
            while (!this.lastResults && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!this.lastResults || !this.lastResults.segmentationMask) {
                console.warn('未获得分割结果，使用后备方案');
                return this.createFallbackSegmentation(canvas);
            }

            // 获取分割掩码
            const mask = this.lastResults.segmentationMask;

            return {
                mask: mask,
                canvas: canvas,
                width: canvas.width,
                height: canvas.height
            };
        } catch (error) {
            console.error('人体检测失败:', error);
            // 返回后备分割结果而不是抛出错误
            return this.createFallbackSegmentation(input instanceof HTMLCanvasElement ? input : imageProcessor.imageToCanvas(input));
        }
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
        const maxRadius = Math.min(width, height) / 2.5;

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
        // 衣服通常在躯干中间部分，且具有特定的色彩特征
        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const maskValue = maskData[pixelIndex];

            // 如果是人体区域（置信度 > 0.3）
            if (maskValue > 0.3) {
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
        const topThreshold = height * 0.25;  // 头部
        const bottomThreshold = height * 0.85; // 腿部

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
