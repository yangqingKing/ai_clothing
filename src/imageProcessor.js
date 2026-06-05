/**
 * 图像处理模块
 * 负责图像加载、预处理和基本的图像操作
 */

class ImageProcessor {
    constructor() {
        this.sourceImage = null;
        this.targetImage = null;
        this.sourceCanvas = null;
        this.targetCanvas = null;
    }

    /**
     * 从 File 对象加载图像
     * @param {File} file - 图像文件
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('图像加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * 设置源图像
     * @param {HTMLImageElement} img - 图像元素
     */
    setSourceImage(img) {
        this.sourceImage = img;
        this.sourceCanvas = this.imageToCanvas(img);
    }

    /**
     * 设置目标图像
     * @param {HTMLImageElement} img - 图像元素
     */
    setTargetImage(img) {
        this.targetImage = img;
        this.targetCanvas = this.imageToCanvas(img);
    }

    /**
     * 将 Image 对象转换为 Canvas
     * @param {HTMLImageElement} img - 图像元素
     * @param {number} maxWidth - 最大宽度（可选）
     * @returns {HTMLCanvasElement}
     */
    imageToCanvas(img, maxWidth = null) {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 如果指定了最大宽度，按比例缩放
        if (maxWidth && width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    }

    /**
     * 获取图像数据
     * @param {HTMLCanvasElement} canvas - Canvas 元素
     * @returns {ImageData}
     */
    getImageData(canvas) {
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    /**
     * 获取 CV Mat（用于 OpenCV）
     * @param {HTMLCanvasElement} canvas - Canvas 元素
     * @returns {cv.Mat}
     */
    canvasToCvMat(canvas) {
        const src = cv.imread(canvas);
        return src;
    }

    /**
     * 将 CV Mat 转换回 Canvas
     * @param {cv.Mat} mat - OpenCV Mat
     * @param {HTMLCanvasElement} canvas - 目标 Canvas
     */
    cvMatToCanvas(mat, canvas) {
        cv.imshow(canvas, mat);
    }

    /**
     * 创建图像的缩略图用于预览
     * @param {HTMLCanvasElement} canvas - 源 Canvas
     * @param {number} maxSize - 最大尺寸
     * @returns {HTMLCanvasElement}
     */
    createThumbnail(canvas, maxSize = 256) {
        const ratio = Math.min(maxSize / canvas.width, maxSize / canvas.height);
        const thumbnail = document.createElement('canvas');
        thumbnail.width = canvas.width * ratio;
        thumbnail.height = canvas.height * ratio;
        const ctx = thumbnail.getContext('2d');
        ctx.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
        return thumbnail;
    }

    /**
     * 调整图像尺寸
     * @param {HTMLCanvasElement} canvas - 源 Canvas
     * @param {number} width - 目标宽度
     * @param {number} height - 目标高度
     * @returns {HTMLCanvasElement}
     */
    resizeImage(canvas, width, height) {
        const resized = document.createElement('canvas');
        resized.width = width;
        resized.height = height;
        const ctx = resized.getContext('2d');
        ctx.drawImage(canvas, 0, 0, width, height);
        return resized;
    }

    /**
     * 获取图像的 blob 数据
     * @param {HTMLCanvasElement} canvas - Canvas 元素
     * @param {string} type - 图像类型
     * @param {number} quality - 质量(0-1)
     * @returns {Promise<Blob>}
     */
    canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, type, quality);
        });
    }

    /**
     * 将图像灰度化
     * @param {HTMLCanvasElement} canvas - 源 Canvas
     * @returns {HTMLCanvasElement}
     */
    grayscale(canvas) {
        const src = this.canvasToCvMat(canvas);
        const dst = new cv.Mat();
        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
        const result = document.createElement('canvas');
        this.cvMatToCanvas(dst, result);
        src.delete();
        dst.delete();
        return result;
    }

    /**
     * 获取图像的尺寸信息
     * @returns {object}
     */
    getDimensions() {
        return {
            source: this.sourceCanvas ? {
                width: this.sourceCanvas.width,
                height: this.sourceCanvas.height
            } : null,
            target: this.targetCanvas ? {
                width: this.targetCanvas.width,
                height: this.targetCanvas.height
            } : null
        };
    }

    /**
     * 清空图像数据
     */
    clear() {
        this.sourceImage = null;
        this.targetImage = null;
        this.sourceCanvas = null;
        this.targetCanvas = null;
    }
}

// 创建全局实例
const imageProcessor = new ImageProcessor();