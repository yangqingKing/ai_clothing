/**
 * UI 交互和控制模块
 */

class UIController {
    constructor() {
        this.sourceFile = null;
        this.targetFile = null;
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 文件输入处理
        const sourceInput = document.getElementById('sourceInput');
        const targetInput = document.getElementById('targetInput');
        
        // 修复：直接选择图像容器
        const sourceContainer = document.querySelectorAll('.image-container')[0];
        const targetContainer = document.querySelectorAll('.image-container')[1];

        if (!sourceInput || !targetInput || !sourceContainer || !targetContainer) {
            console.error('DOM 元素加载失败，请检查 HTML 结构');\
            return;
        }

        sourceInput.addEventListener('change', (e) => this.handleSourceFileSelect(e));
        targetInput.addEventListener('change', (e) => this.handleTargetFileSelect(e));

        // 拖拽支持
        this.setupDragAndDrop('sourceInput', sourceContainer);
        this.setupDragAndDrop('targetInput', targetContainer);

        // 按钮处理
        const processBtn = document.getElementById('processBtn');
        const resetBtn = document.getElementById('resetBtn');
        const downloadBtn = document.getElementById('downloadBtn');

        if (processBtn) processBtn.addEventListener('click', () => this.processImages());
        if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadResult());
    }

    setupDragAndDrop(inputId, container) {
        if (!container) {
            console.error(`容器不存在: ${inputId}`);
            return;
        }

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('dragover');
        });

        container.addEventListener('dragleave', () => {
            container.classList.remove('dragover');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const input = document.getElementById(inputId);
                if (input) {
                    // 创建 DataTransfer 对象来设置文件
                    const dataTransfer = new DataTransfer();
                    for (let i = 0; i < files.length; i++) {
                        dataTransfer.items.add(files[i]);
                    }
                    input.files = dataTransfer.files;

                    if (inputId === 'sourceInput') {
                        this.handleSourceFileSelect({ target: { files: dataTransfer.files } });
                    } else {
                        this.handleTargetFileSelect({ target: { files: dataTransfer.files } });
                    }
                }
            }
        });
    }

    async handleSourceFileSelect(e) {
        const files = e.target.files;
        if (files.length === 0) return;

        try {
            const file = files[0];
            this.sourceFile = file;
            const img = await imageProcessor.loadImageFromFile(file);
            imageProcessor.setSourceImage(img);

            // 显示预览
            const sourceImg = document.getElementById('sourceImage');
            const sourcePlaceholder = document.getElementById('sourcePlaceholder');
            if (sourceImg && sourcePlaceholder) {
                sourceImg.src = img.src;
                sourceImg.style.display = 'block';
                sourcePlaceholder.style.display = 'none';
            }

            this.updateProcessButtonState();
            this.clearError();
        } catch (error) {
            this.showError('源图像加载失败: ' + error.message);
        }
    }

    async handleTargetFileSelect(e) {
        const files = e.target.files;
        if (files.length === 0) return;

        try {
            const file = files[0];
            this.targetFile = file;
            const img = await imageProcessor.loadImageFromFile(file);
            imageProcessor.setTargetImage(img);

            // 显示预览
            const targetImg = document.getElementById('targetImage');
            const targetPlaceholder = document.getElementById('targetPlaceholder');
            if (targetImg && targetPlaceholder) {
                targetImg.src = img.src;
                targetImg.style.display = 'block';
                targetPlaceholder.style.display = 'none';
            }

            this.updateProcessButtonState();
            this.clearError();
        } catch (error) {
            this.showError('目标图像加载失败: ' + error.message);
        }
    }

    updateProcessButtonState() {
        const processBtn = document.getElementById('processBtn');
        if (!processBtn) return;

        const hasBothImages = imageProcessor.sourceImage && imageProcessor.targetImage;
        processBtn.disabled = !hasBothImages || this.isProcessing;
    }

    async processImages() {
        if (!imageProcessor.sourceImage || !imageProcessor.targetImage) {
            this.showError('请上传两张图片');
            return;
        }

        if (this.isProcessing) return;

        this.isProcessing = true;
        this.updateProcessButtonState();
        this.showLoading();
        this.clearError();

        try {
            // 显示处理步骤
            this.updateProcessingStep('初始化模型...');
            await personDetector.initialize();

            this.updateProcessingStep('分割衣服区域...');
            const sourceSegmentation = await segmentationEngine.segmentClothing(imageProcessor.sourceCanvas);

            this.updateProcessingStep('分割目标人物...');
            const targetSegmentation = await segmentationEngine.segmentPerson(imageProcessor.targetCanvas);

            const segmentationResults = {
                source: sourceSegmentation,
                target: targetSegmentation
            };

            this.updateProcessingStep('合成衣服转移...');
            const result = await clothingSynthesis.transferClothing(
                imageProcessor.sourceCanvas,
                imageProcessor.targetCanvas,
                segmentationResults
            );

            this.displayResult(result);
            this.hideLoading();

        } catch (error) {
            console.error('处理失败:', error);
            this.showError('处理失败: ' + error.message);
            this.hideLoading();
        } finally {
            this.isProcessing = false;
            this.updateProcessButtonState();
        }
    }

    displayResult(canvas) {
        const resultCanvas = document.getElementById('resultCanvas');
        const resultSection = document.getElementById('resultSection');
        
        if (!resultCanvas || !resultSection) return;

        const ctx = resultCanvas.getContext('2d');
        resultCanvas.width = canvas.width;
        resultCanvas.height = canvas.height;
        ctx.drawImage(canvas, 0, 0);

        resultSection.style.display = 'block';
    }

    async downloadResult() {
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas || resultCanvas.width === 0) {
            this.showError('没有可下载的结果');
            return;
        }

        try {
            const blob = await imageProcessor.canvasToBlob(resultCanvas);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clothing-swap-result-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            this.showError('下载失败: ' + error.message);
        }
    }

    reset() {
        // 清空图像
        const sourceImage = document.getElementById('sourceImage');
        const targetImage = document.getElementById('targetImage');
        const sourcePlaceholder = document.getElementById('sourcePlaceholder');
        const targetPlaceholder = document.getElementById('targetPlaceholder');
        const sourceInput = document.getElementById('sourceInput');
        const targetInput = document.getElementById('targetInput');
        const resultSection = document.getElementById('resultSection');
        const resultCanvas = document.getElementById('resultCanvas');

        if (sourceImage) sourceImage.style.display = 'none';
        if (targetImage) targetImage.style.display = 'none';
        if (sourcePlaceholder) sourcePlaceholder.style.display = 'flex';
        if (targetPlaceholder) targetPlaceholder.style.display = 'flex';
        if (sourceImage) sourceImage.src = '';
        if (targetImage) targetImage.src = '';
        if (sourceInput) sourceInput.value = '';
        if (targetInput) targetInput.value = '';

        // 清空结果
        if (resultSection) resultSection.style.display = 'none';
        if (resultCanvas) {
            resultCanvas.width = 0;
            resultCanvas.height = 0;
        }

        // 清空缓存
        imageProcessor.clear();
        segmentationEngine.clear();
        clothingSynthesis.clear();
        personDetector.clear();

        this.sourceFile = null;
        this.targetFile = null;
        this.isProcessing = false;
        this.updateProcessButtonState();
        this.clearError();
    }

    showLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }

    updateProcessingStep(step) {
        const processingStep = document.getElementById('processingStep');
        if (processingStep) processingStep.textContent = step;
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    clearError() {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) errorDiv.style.display = 'none';
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.uiController = new UIController();
    });
} else {
    window.uiController = new UIController();
}
