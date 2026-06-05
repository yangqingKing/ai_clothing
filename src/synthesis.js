/**
 * 合成模块 (纯 JavaScript - 不依赖 OpenCV)
 * 将衣服从源图像转移到目标图像
 */

class ClothingSynthesis {
    constructor() {
        this.resultCanvas = null;
    }

    /**
     * 执行衣服转移
     * @param {HTMLCanvasElement} sourceCanvas - 源图像
     * @param {HTMLCanvasElement} targetCanvas - 目标图像
     * @param {object} segmentationResults - 分割结果
     * @returns {Promise<HTMLCanvasElement>}
     */
    async transferClothing(sourceCanvas, targetCanvas, segmentationResults) {
        try {
            console.log('开始衣服转移合成...');

            // 1. 调整尺寸和对齐
            const aligned = await this.alignImages(sourceCanvas, targetCanvas, segmentationResults);

            // 2. 提取和转换衣服纹理
            const clothingTexture = this.extractClothingTexture(aligned.sourceAligned, segmentationResults.source);

            // 3. 应用衣服到目标图像
            const result = this.applyClothingToTarget(aligned.targetAligned, clothingTexture, segmentationResults.target);

            // 4. 进行边界融合和优化（纯 JS 版本）
            const optimized = this.optimizeResultJS(result, targetCanvas, segmentationResults.target);

            this.resultCanvas = optimized;
            return optimized;
        } catch (error) {
            console.error('衣服转移失败:', error);
            throw error;
        }
    }

    /**
     * 图像对齐和尺寸调整
     * @param {HTMLCanvasElement} sourceCanvas - 源图像
     * @param {HTMLCanvasElement} targetCanvas - 目标图像
     * @param {object} segmentationResults - 分割结果
     * @returns {Promise<object>}
     */
    async alignImages(sourceCanvas, targetCanvas, segmentationResults) {
        console.log('对齐图像...');

        const sourceBounds = segmentationResults.source.detectionResult;
        const targetBounds = segmentationResults.target.detectionResult;

        // 计算目标尺寸
        const targetSize = Math.max(targetCanvas.width, targetCanvas.height);
        const sourceSize = Math.max(sourceCanvas.width, sourceCanvas.height);

        // 创建对齐的画布
        const sourceAligned = imageProcessor.resizeImage(
            sourceCanvas,
            (sourceCanvas.width * targetSize) / sourceSize,
            (sourceCanvas.height * targetSize) / sourceSize
        );

        const targetAligned = imageProcessor.resizeImage(
            targetCanvas,
            targetSize,
            targetSize
        );

        return {
            sourceAligned,
            targetAligned,
            scale: targetSize / sourceSize
        };
    }

    /**
     * 提取衣服纹理
     * @param {HTMLCanvasElement} sourceCanvas - 对齐后的源图像
     * @param {object} sourceSegmentation - 源分割结果
     * @returns {HTMLCanvasElement}
     */
    extractClothingTexture(sourceCanvas, sourceSegmentation) {
        console.log('提取衣服纹理...');

        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 绘制源图像
        ctx.drawImage(sourceCanvas, 0, 0);

        // 使用衣服掩码提取纹理
        const sourceImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const maskCanvas = sourceSegmentation.mask;
        const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

        const sourceData = sourceImageData.data;
        const maskData = maskImageData.data;
        const resultData = ctx.createImageData(canvas.width, canvas.height);
        const result = resultData.data;

        // 根据掩码复制像素
        for (let i = 0; i < sourceData.length; i += 4) {
            const maskAlpha = maskData[i + 3];
            if (maskAlpha > 128) {
                result[i] = sourceData[i];
                result[i + 1] = sourceData[i + 1];
                result[i + 2] = sourceData[i + 2];
                result[i + 3] = sourceData[i + 3];
            } else {
                result[i + 3] = 0;
            }
        }

        ctx.putImageData(resultData, 0, 0);
        return canvas;
    }

    /**
     * 将衣服应用到目标图像
     * @param {HTMLCanvasElement} targetCanvas - 目标图像
     * @param {HTMLCanvasElement} clothingTexture - 衣服纹理
     * @param {object} targetSegmentation - 目标分割结果
     * @returns {HTMLCanvasElement}
     */
    applyClothingToTarget(targetCanvas, clothingTexture, targetSegmentation) {
        console.log('应用衣服到目标图像...');

        const result = document.createElement('canvas');
        result.width = targetCanvas.width;
        result.height = targetCanvas.height;
        const ctx = result.getContext('2d', { willReadFrequently: true });

        // 首先绘制目标图像
        ctx.drawImage(targetCanvas, 0, 0);

        // 获取衣服纹理的上半部分（躯干）
        const bounds = targetSegmentation.bodyBounds;
        const clothingHeight = clothingTexture.height * 0.6; // 只取上面60%作为衣服

        // 计算目标区域的位置
        const targetClothingY = bounds.y + bounds.height * 0.2;
        const targetClothingHeight = bounds.height * 0.5;

        // 调整衣服纹理的尺寸以匹配目标
        const scaledClothing = imageProcessor.resizeImage(
            clothingTexture,
            bounds.width * 1.1,
            targetClothingHeight
        );

        // 使用混合模式应用衣服
        ctx.globalAlpha = 0.85;
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(
            scaledClothing,
            bounds.x - (bounds.width * 0.05),
            targetClothingY
        );
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        return result;
    }

    /**
     * 优化结果（纯 JavaScript 版本 - 不依赖 OpenCV）
     * @param {HTMLCanvasElement} resultCanvas - 原始结果
     * @param {HTMLCanvasElement} targetCanvas - 原始目标
     * @param {object} targetSegmentation - 目标分割结果
     * @returns {HTMLCanvasElement}
     */
    optimizeResultJS(resultCanvas, targetCanvas, targetSegmentation) {
        console.log('优化结果...');

        const canvas = document.createElement('canvas');
        canvas.width = resultCanvas.width;
        canvas.height = resultCanvas.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 复制结果
        ctx.drawImage(resultCanvas, 0, 0);

        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 应用简单的双边滤波器近似（使用中值滤波和高斯平滑）
        const blurred = this.applyBilateralFilterJS(data, canvas.width, canvas.height);

        // 应用对比度增强
        const enhanced = this.enhanceContrastJS(blurred, canvas.width, canvas.height);

        // 将处理后的数据写回
        for (let i = 0; i < data.length; i++) {
            data[i] = enhanced[i];
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * 应用双边滤波器（纯 JS 近似）
     * @param {Uint8ClampedArray} data - 图像数据
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {Uint8ClampedArray}
     */
    applyBilateralFilterJS(data, width, height) {
        const filtered = new Uint8ClampedArray(data);
        const radius = 2;
        const sigmaColor = 75;
        const sigmaSpace = 75;

        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                const idx = (y * width + x) * 4;
                const centerR = data[idx];
                const centerG = data[idx + 1];
                const centerB = data[idx + 2];
                const centerA = data[idx + 3];

                let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
                let weightSum = 0;

                // 遍历邻域
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nidx = ((y + dy) * width + (x + dx)) * 4;
                        const nR = data[nidx];
                        const nG = data[nidx + 1];
                        const nB = data[nidx + 2];
                        const nA = data[nidx + 3];

                        // 计算颜色差异
                        const colorDiff = Math.sqrt(
                            Math.pow(centerR - nR, 2) +
                            Math.pow(centerG - nG, 2) +
                            Math.pow(centerB - nB, 2)
                        );

                        // 计算空间距离
                        const spatialDist = Math.sqrt(dx * dx + dy * dy);

                        // 计算权重
                        const colorWeight = Math.exp(-colorDiff / (2 * sigmaColor));
                        const spatialWeight = Math.exp(-spatialDist / (2 * sigmaSpace));
                        const weight = colorWeight * spatialWeight;

                        sumR += nR * weight;
                        sumG += nG * weight;
                        sumB += nB * weight;
                        sumA += nA * weight;
                        weightSum += weight;
                    }
                }

                if (weightSum > 0) {
                    filtered[idx] = sumR / weightSum;
                    filtered[idx + 1] = sumG / weightSum;
                    filtered[idx + 2] = sumB / weightSum;
                    filtered[idx + 3] = sumA / weightSum;
                }
            }
        }

        return filtered;
    }

    /**
     * 增强对比度（纯 JS 版本）
     * @param {Uint8ClampedArray} data - 图像数据
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {Uint8ClampedArray}
     */
    enhanceContrastJS(data, width, height) {
        const enhanced = new Uint8ClampedArray(data);

        // 计算亮度直方图
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            histogram[Math.floor(brightness)]++;
        }

        // 计算累积直方图
        const cumulative = new Array(256);
        cumulative[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cumulative[i] = cumulative[i - 1] + histogram[i];
        }

        // 归一化
        const totalPixels = width * height;
        for (let i = 0; i < 256; i++) {
            cumulative[i] = Math.round((cumulative[i] / totalPixels) * 255);
        }

        // 应用均衡化（温和应用以避免过度处理）
        for (let i = 0; i < data.length; i += 4) {
            const brightness = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3);
            const mappedValue = cumulative[brightness];
            const alpha = 0.3; // 柔和应用

            enhanced[i] = Math.min(255, data[i] + (mappedValue - brightness) * alpha);
            enhanced[i + 1] = Math.min(255, data[i + 1] + (mappedValue - brightness) * alpha);
            enhanced[i + 2] = Math.min(255, data[i + 2] + (mappedValue - brightness) * alpha);
        }

        return enhanced;
    }

    /**
     * 获取结果画布
     * @returns {HTMLCanvasElement}
     */
    getResult() {
        return this.resultCanvas;
    }

    /**
     * 清空结果
     */
    clear() {
        this.resultCanvas = null;
    }
}

// 创建全局实例
const clothingSynthesis = new ClothingSynthesis();
