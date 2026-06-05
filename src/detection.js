/**
 * 人物检测模块
 * 使用 MediaPipe Selfie Segmentation 进行人体分割
 */

class PersonDetector {
    constructor() {
        this.segmenter = null;
        this.isInitialized = false;
        this.modelLoaded = false;
    }

    /**
     * 初始化模型
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('初始化人体分割模型...');
            
            // 加载 MediaPipe 自拍分割模型
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.4.1675469636/selfie_segmentation.js';
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });

            // 等待 MediaPipe 加载完成
            await new Promise(resolve => {
                const check = () => {
                    if (typeof SelfieSegmentation !== 'undefined') {
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });

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
            this.isInitialized = true;
            this.modelLoaded = true;
            console.log('人体分割模型初始化成功');
        } catch (error) {
            console.error('模型初始化失败:', error);
            throw new Error('人体分割模型加载失败: ' + error.message);
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

            // 运行分割
            await this.segmenter.send({ image: canvas });

            // 等待结果处理完成
            await new Promise(resolve => setTimeout(resolve, 50));

            if (!this.lastResults || !this.lastResults.segmentationMask) {
                throw new Error('分割失败');
            }

            // 获取分割掩码
            const mask = this.lastResults.segmentationMask;
            const confidence = this.lastResults.segmentationMask;

            return {
                mask: mask,
                canvas: canvas,
                width: canvas.width,
                height: canvas.height
            };
        } catch (error) {
            console.error('人体检测失败:', error);
            throw new Error('人体检测失败: ' + error.message);
        }
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
        const maskData = new Uint8ClampedArray(mask.data);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 优化衣服区域检测
        // 衣服通常在躯干中间部分，且具有特定的色彩特征
        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const maskValue = maskData[pixelIndex];

            // 如果是人体区域
            if (maskValue > 0.3) {
                // 保留该像素
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
     * @param {Uint8ClampedArray} maskData - 掩码数据
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