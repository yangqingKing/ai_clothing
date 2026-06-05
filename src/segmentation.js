/**
 * 分割模块 (纯 JavaScript - 不依赖 OpenCV)
 * 处理图像分割和掩码生成
 */

class SegmentationEngine {
    constructor() {
        this.sourceSegmentation = null;
        this.targetSegmentation = null;
    }

    /**
     * 对源图像进行分割（提取衣服）
     * @param {HTMLCanvasElement} canvas - 源图像 canvas
     * @returns {Promise<object>}
     */
    async segmentClothing(canvas) {
        try {
            console.log('正在分割源图像衣服区域...');

            // 使用检测器获取人物掩码
            const detectionResult = await personDetector.detectPerson(canvas);

            // 提取衣服掩码
            const clothingMask = personDetector.extractClothingMask(detectionResult);

            // 改进衣服特征
            const enhancedMask = this.enhanceClothingFeaturesJS(canvas, clothingMask);

            this.sourceSegmentation = {
                mask: enhancedMask,
                originalCanvas: canvas,
                detectionResult: detectionResult
            };

            return this.sourceSegmentation;
        } catch (error) {
            console.error('衣服分割失败:', error);
            throw error;
        }
    }

    /**
     * 对目标图像进行分割（提取人物区域）
     * @param {HTMLCanvasElement} canvas - 目标图像 canvas
     * @returns {Promise<object>}
     */
    async segmentPerson(canvas) {
        try {
            console.log('正在分割目标图像人物区域...');

            // 使用检测器获取人物掩码
            const detectionResult = await personDetector.detectPerson(canvas);

            // 创建人物掩码
            const personMask = this.createPersonMaskJS(detectionResult);

            this.targetSegmentation = {
                mask: personMask,
                originalCanvas: canvas,
                detectionResult: detectionResult,
                bodyBounds: this.getBodyBounds(detectionResult)
            };

            return this.targetSegmentation;
        } catch (error) {
            console.error('人物分割失败:', error);
            throw error;
        }
    }

    /**
     * 增强衣服特征（纯 JavaScript 版本）
     * @param {HTMLCanvasElement} originalCanvas - 原始图像
     * @param {HTMLCanvasElement} clothingMask - 衣服掩码
     * @returns {HTMLCanvasElement}
     */
    enhanceClothingFeaturesJS(originalCanvas, clothingMask) {
        console.log('增强衣服特征...');

        const canvas = document.createElement('canvas');
        canvas.width = clothingMask.width;
        canvas.height = clothingMask.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 复制衣服掩码
        ctx.drawImage(clothingMask, 0, 0);

        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 应用高斯模糊（简单实现 - 箱形滤波器）
        const blurred = this.applyBoxBlur(data, canvas.width, canvas.height, 2);

        // 应用膨胀操作来扩展衣服区域
        const dilated = this.applyDilation(blurred, canvas.width, canvas.height, 1);

        // 将处理后的数据写回
        for (let i = 0; i < data.length; i++) {
            data[i] = dilated[i];
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * 应用箱形模糊（简单的高斯模糊近似）
     * @param {Uint8ClampedArray} data - 图像数据
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} radius - 模糊半径
     * @returns {Uint8ClampedArray}
     */
    applyBoxBlur(data, width, height, radius) {
        const blurred = new Uint8ClampedArray(data);
        
        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                const idx = (y * width + x) * 4;
                
                let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
                let count = 0;

                // 收集周围像素
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nidx = ((y + dy) * width + (x + dx)) * 4;
                        sumR += data[nidx];
                        sumG += data[nidx + 1];
                        sumB += data[nidx + 2];
                        sumA += data[nidx + 3];
                        count++;
                    }
                }

                // 计算平均值
                blurred[idx] = sumR / count;
                blurred[idx + 1] = sumG / count;
                blurred[idx + 2] = sumB / count;
                blurred[idx + 3] = sumA / count;
            }
        }

        return blurred;
    }

    /**
     * 应用膨胀操作（扩展前景区域）
     * @param {Uint8ClampedArray} data - 图像数据
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} iterations - 迭代次数
     * @returns {Uint8ClampedArray}
     */
    applyDilation(data, width, height, iterations) {
        let result = new Uint8ClampedArray(data);

        for (let iter = 0; iter < iterations; iter++) {
            const dilated = new Uint8ClampedArray(result);

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // 检查邻域中的最大值（膨胀）
                    let maxAlpha = result[idx + 3];

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nidx = ((y + dy) * width + (x + dx)) * 4;
                            maxAlpha = Math.max(maxAlpha, result[nidx + 3]);
                        }
                    }

                    dilated[idx + 3] = maxAlpha;
                }
            }

            result = dilated;
        }

        return result;
    }

    /**
     * 创建人物掩码（纯 JavaScript 版本）
     * @param {object} detectionResult - 检测结果
     * @returns {HTMLCanvasElement}
     */
    createPersonMaskJS(detectionResult) {
        const { mask, width, height } = detectionResult;
        const personMask = document.createElement('canvas');
        personMask.width = width;
        personMask.height = height;
        const ctx = personMask.getContext('2d');

        // 创建白色背景
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // 根据掩码创建图像
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        const maskData = new Float32Array(mask.data);

        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const maskValue = maskData[pixelIndex];

            // 如果是人体区域
            if (maskValue > 0.2) {
                data[i] = 255;     // R
                data[i + 1] = 255; // G
                data[i + 2] = 255; // B
                data[i + 3] = 255; // A
            } else {
                data[i + 3] = 0;   // 透明
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return personMask;
    }

    /**
     * 获取人体边界框
     * @param {object} detectionResult - 检测结果
     * @returns {object}
     */
    getBodyBounds(detectionResult) {
        const { mask, width, height } = detectionResult;
        const maskData = new Float32Array(mask.data);

        let minX = width, minY = height, maxX = 0, maxY = 0;

        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] > 0.2) {
                const x = i % width;
                const y = Math.floor(i / width);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * 获取分割结果
     * @returns {object}
     */
    getResults() {
        return {
            source: this.sourceSegmentation,
            target: this.targetSegmentation
        };
    }

    /**
     * 清空分割数据
     */
    clear() {
        this.sourceSegmentation = null;
        this.targetSegmentation = null;
    }
}

// 创建全局实例
const segmentationEngine = new SegmentationEngine();
