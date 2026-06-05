/**
 * 合成模块
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

            // 4. 进行边界融合和优化
            const optimized = this.optimizeResult(result, targetCanvas, segmentationResults.target);

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
     * 优化结果（边界融合、增强对比度等）
     * @param {HTMLCanvasElement} resultCanvas - 原始结果
     * @param {HTMLCanvasElement} targetCanvas - 原始目标
     * @param {object} targetSegmentation - 目标分割结果
     * @returns {HTMLCanvasElement}
     */
    optimizeResult(resultCanvas, targetCanvas, targetSegmentation) {
        console.log('优化结果...');

        const src = cv.imread(resultCanvas);
        const dst = new cv.Mat();

        // 应用双边滤波器以保护边缘同时平滑颜色
        cv.bilateralFilter(src, dst, 9, 75, 75);

        // 应用自适应直方图均衡化（CLAHE）以改善对比度
        const lab = new cv.Mat();
        cv.cvtColor(dst, lab, cv.COLOR_RGB2Lab);
        const channels = new cv.MatVector();
        cv.split(lab, channels);

        const l = channels.get(0);
        const clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
        const enhanced = new cv.Mat();
        clahe.apply(l, enhanced);
        channels.set(0, enhanced);

        const result = new cv.Mat();
        cv.merge(channels, result);
        cv.cvtColor(result, result, cv.COLOR_Lab2RGB);

        const finalCanvas = document.createElement('canvas');
        cv.imshow(finalCanvas, result);

        // 清理内存
        src.delete();
        dst.delete();
        lab.delete();
        channels.delete();
        enhanced.delete();
        result.delete();

        return finalCanvas;
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