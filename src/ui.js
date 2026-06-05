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
        const sourceContainer = document.querySelector('[onclick*="sourceInput"]').parentElement.previousElementSibling;
        const targetContainer = document.querySelector('[onclick*="targetInput"]').parentElement.previousElementSibling;

        sourceInput.addEventListener('change', (e) => this.handleSourceFileSelect(e));
        targetInput.addEventListener('change', (e) => this.handleTargetFileSelect(e));

        // 拖拽支持
        this.setupDragAndDrop('sourceInput', sourceContainer);
        this.setupDragAndDrop('targetInput', targetContainer);

        // 按钮处理
        document.getElementById('processBtn').addEventListener('click', () => this.processImages());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadResult());
    }

    setupDragAndDrop(inputId, container) {
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
                document.getElementById(inputId).files = files;
                if (inputId === 'sourceInput') {
                    this.handleSourceFileSelect({ target: { files } });
                } else {
                    this.handleTargetFileSelect({ target: { files } });
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
            sourceImg.src = img.src;
            sourceImg.style.display = 'block';
            document.getElementById('sourcePlaceholder').style.display = 'none';

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
            targetImg.src = img.src;
            targetImg.style.display = 'block';
            document.getElementById('targetPlaceholder').style.display = 'none';

            this.updateProcessButtonState();
            this.clearError();
        } catch (error) {
            this.showError('目标图像加载失败: ' + error.message);
        }
    }

    updateProcessButtonState() {
        const processBtn = document.getElementById('processBtn');
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
        const ctx = resultCanvas.getContext('2d');
        resultCanvas.width = canvas.width;
        resultCanvas.height = canvas.height;
        ctx.drawImage(canvas, 0, 0);

        document.getElementById('resultSection').style.display = 'block';
    }

    async downloadResult() {
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas) return;

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
        document.getElementById('sourceImage').style.display = 'none';
        document.getElementById('targetImage').style.display = 'none';
        document.getElementById('sourcePlaceholder').style.display = 'flex';
        document.getElementById('targetPlaceholder').style.display = 'flex';
        document.getElementById('sourceImage').src = '';
        document.getElementById('targetImage').src = '';
        document.getElementById('sourceInput').value = '';
        document.getElementById('targetInput').value = '';

        // 清空结果
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('resultCanvas').width = 0;
        document.getElementById('resultCanvas').height = 0;

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
        document.getElementById('loadingIndicator').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loadingIndicator').style.display = 'none';
    }

    updateProcessingStep(step) {
        document.getElementById('processingStep').textContent = step;
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    clearError() {
        document.getElementById('errorMessage').style.display = 'none';
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