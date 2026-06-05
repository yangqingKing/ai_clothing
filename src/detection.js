/**
 * 人物检测模块
 * 使用 TensorFlow.js + BodyPix 进行精准人体分割
 */

class PersonDetector {
    constructor() {
        this.net = null;
        this.isInitialized = false;
    }

    /**
     * 初始化模型
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('初始化人体分割模型 (BodyPix)...');
            
            // 加载 BodyPix 模型
            this.net = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });
            
            this.isInitialized = true;
            console.log('BodyPix 模型加载成功');
        } catch (error) {
            console.error('模型初始化失败:', error);
            throw new Error('BodyPix 模型加载失败: ' + error.message);
        }
    }

    /**
     * 检测图像中的人体
     * @param {HTMLCanvasElement|HTMLImageElement} input - 输入图像
     * @returns {Promise<object>} 分割结果
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

            // 进行人体分割
            const segmentation = await this.net.segmentPerson(canvas, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.5
            });

            // 获取部位数据
            const partSegmentation = await this.net.partSegmentation(canvas, {
                flipHorizontal: false,
                internalResolution: 'medium',
                segmentationThreshold: 0.5
            });

            // 创建掩码
            const mask = this.createMaskFromSegmentation(segmentation, canvas.width, canvas.height);

            return {
                mask: mask,
                segmentation: segmentation,
                partSegmentation: partSegmentation,
                canvas: canvas,
                width: canvas.width,
                height: canvas.height
            };
        } catch (error) {
            console.error('人体检测失败:', error);
            throw error;
        }
    }

    /**
     * 从分割结果创建掩码
     * @param {object} segmentation - 分割结果
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {object}
     */
    createMaskFromSegmentation(segmentation, width, height) {
        const maskData = new Float32Array(width * height);
        
        for (let i = 0; i < segmentation.data.length; i++) {
            maskData[i] = segmentation.data[i] > 0 ? 1.0 : 0.0;
        }

        return {
            data: maskData,
            width: width,
            height: height
        };
    }

    /**
     * 提取衣服区域
     * @param {object} detectionResult - 检测结果
     * @returns {HTMLCanvasElement}
     */
    extractClothingMask(detectionResult) {
        const { partSegmentation, canvas, width, height } = detectionResult;
        const clothingMask = document.createElement('canvas');
        clothingMask.width = width;
        clothingMask.height = height;
        const ctx = clothingMask.getContext('2d', { willReadFrequently: true });

        // 创建衣服掩码
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // BodyPix 部位定义
        // 0: left_face, 1: right_face, 2: left_upper_arm_front, 3: left_upper_arm_back,
        // 4: right_upper_arm_front, 5: right_upper_arm_back, 6: left_forearm_front,
        // 7: left_forearm_back, 8: right_forearm_front, 9: right_forearm_back,
        // 10: left_hand, 11: right_hand, 12: torso_front, 13: torso_back,
        // 14: left_upper_leg_front, 15: left_upper_leg_back, 16: right_upper_leg_front,
        // 17: right_upper_leg_back, 18: left_lower_leg_front, 19: left_lower_leg_back,
        // 20: right_lower_leg_front, 21: right_lower_leg_back, 22: left_foot, 23: right_foot, 24: background

        const clothingParts = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13]; // 上半身衣服部位

        for (let i = 0; i < partSegmentation.data.length; i++) {
            const partId = partSegmentation.data[i];
            
            if (clothingParts.includes(partId)) {
                // 衣服区域
                data[i * 4] = 255;     // R
                data[i * 4 + 1] = 255; // G
                data[i * 4 + 2] = 255; // B
                data[i * 4 + 3] = 255; // A
            } else {
                data[i * 4 + 3] = 0;   // 透明
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return clothingMask;
    }

    /**
     * 清空缓存
     */
    clear() {
        // 保持模型在内存中以便重用
    }
}

// 创建全局实例
const personDetector = new PersonDetector();
