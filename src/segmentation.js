/**
 * 分割模块
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

            // 使用 MediaPipe 进行人体检测
            const detectionResult = await personDetector.detectPerson(canvas);

            // 提取衣服掩码
            const clothingMask = personDetector.extractClothingMask(detectionResult);

            // 增强衣服特征
            const enhancedMask = this.enhanceClothingFeatures(canvas, clothingMask);

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
     * 对目标图像进行分割（找到人物区域）
     * @param {HTMLCanvasElement} canvas - 目标图像 canvas
     * @returns {Promise<object>}
     */
    async segmentPerson(canvas) {
        try {
            console.log('正在分割目标图像人物区域...');

            // 使用 MediaPipe 进行人体检测
            const detectionResult = await personDetector.detectPerson(canvas);

            // 创建人体掩码
            const personMask = this.createPersonMask(detectionResult);

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
     * 增强衣服特征
     * @param {HTMLCanvasElement} originalCanvas - 原始图像
     * @param {HTMLCanvasElement} clothingMask - 衣服掩码
     * @returns {HTMLCanvasElement}
     */
    enhanceClothingFeatures(originalCanvas, clothingMask) {
        const canvas = document.createElement('canvas');
        canvas.width = clothingMask.width;
        canvas.height = clothingMask.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 复制衣服掩码
        ctx.drawImage(clothingMask, 0, 0);

        // 应用高斯模糊以平滑边界
        const src = cv.imread(canvas);
        const dst = new cv.Mat();
        cv.GaussianBlur(src, dst, new cv.Size(5, 5), 0);

        // 应用膨胀操作以扩展衣服区域
        const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        const dilated = new cv.Mat();
        cv.dilate(dst, dilated, kernel, new cv.Point(-1, -1), 1);

        cv.imshow(canvas, dilated);

        src.delete();
        dst.delete();
        dilated.delete();
        kernel.delete();

        return canvas;
    }

    /**
     * 创建人体掩码
     * @param {object} detectionResult - 检测结果
     * @returns {HTMLCanvasElement}
     */
    createPersonMask(detectionResult) {
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
        const maskData = new Uint8ClampedArray(mask.data);

        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const maskValue = maskData[pixelIndex];

            // 如果是人体区域
            if (maskValue > 0.3) {
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
        const maskData = new Uint8ClampedArray(mask.data);

        let minX = width, minY = height, maxX = 0, maxY = 0;

        for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] > 0.3) {
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