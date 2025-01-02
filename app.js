let coloringApp;

class ColoringApp {
    constructor() {
        // 首先初始化所有属性
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentColor = '#FF3B30';
        this.currentTool = 'fill';
        
        // 初始化历史记录数组
        this.history = [];
        this.currentHistoryIndex = -1;
        this.maxHistorySteps = 50; // 最大历史记录步数
        
        // 添加防抖标志
        this.isProcessing = false;
        
        // 添加颜色选择器相关属性
        this.currentHue = 120; // 默认绿色
        this.currentSaturation = 100;
        this.currentLightness = 50;
        this.colorMode = 'hsl'; // 默认使用HSL模式
        
        // 添加缩放相关属性
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        
        // 初始化工具相关属性
        this.isDrawing = false;
        this.eraserSize = 20;
        
        // 添加原始图片状态存储
        this.originalImageData = null;
        this.initialStateIndex = -1; // 用于记录初始状态的索引
        
        // 然后再调用初始化方法
        this.initializeCanvas();
        this.setupEventListeners();
        this.createColorPalette();
        this.defaultTool = 'fill'; // 添加默认工具属性
        this.currentTool = this.defaultTool;
    }

    initializeCanvas() {
        // 设置画布大小为A4纸张比例
        const containerWidth = document.querySelector('.canvas-container').clientWidth || 800;
        const containerHeight = document.querySelector('.canvas-container').clientHeight || 1000;
        
        // A4纸张比例 1:1.414
        const aspectRatio = 1.414;
        
        // 设置默认尺寸
        this.canvas.width = 800;
        this.canvas.height = 1131; // 800 * 1.414
        
        if (containerWidth && containerHeight) {
            if (containerWidth / containerHeight > 1 / aspectRatio) {
                this.canvas.height = containerHeight * 0.9;
                this.canvas.width = this.canvas.height / aspectRatio;
            } else {
                this.canvas.width = containerWidth * 0.9;
                this.canvas.height = this.canvas.width * aspectRatio;
            }
        }
        
        // 设置白色背景
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 初始化时保存空白状态
        this.saveToHistory();
        
        // 添加缩放控制按钮
        const container = document.querySelector('.canvas-container');
        const zoomControls = document.createElement('div');
        zoomControls.className = 'canvas-zoom-controls';
        zoomControls.innerHTML = `
            <button class="zoom-in">+</button>
            <button class="zoom-out">-</button>
        `;
        container.appendChild(zoomControls);
    }

    setupEventListeners() {
        // 画布事件
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // 下载按钮
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadImage());
        }

        // 工具栏事件监听
        const tools = document.querySelectorAll('.tool');
        tools.forEach(tool => {
            const toolType = tool.dataset.tool;
            if (toolType === 'brush') {
                tool.style.display = 'none';
            } else {
                tool.addEventListener('click', () => {
                    switch(toolType) {
                        case 'prev':
                            this.undo();
                            break;
                        case 'next':
                            this.redo();
                            break;
                        case 'undo':
                            this.undo();
                            break;
                        case 'redo':
                            this.showClearConfirmation();
                            break;
                        default:
                            // 只有非操作类工具才更新工具状态和样式
                            tools.forEach(t => t.classList.remove('active'));
                            tool.classList.add('active');
                            this.currentTool = toolType;
                            this.canvas.style.cursor = toolType === 'fill' ? 'pointer' : 'crosshair';
                    }
                });
            }
        });

        // 添加缩放相关事件监听
        const container = document.querySelector('.canvas-container');
        const zoomInBtn = container.querySelector('.zoom-in');
        const zoomOutBtn = container.querySelector('.zoom-out');

        // 缩放按钮事件
        zoomInBtn.addEventListener('click', () => this.handleZoom(0.2));
        zoomOutBtn.addEventListener('click', () => this.handleZoom(-0.2));

        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.handleZoom(delta, e);
        });

        // 拖动画布
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
    }

    handleCanvasClick(event) {
        if (this.currentTool !== 'fill' || this.isProcessing) return;

        const rect = this.canvas.getBoundingClientRect();
        // 考虑缩放和平移的影响
        const x = Math.floor(((event.clientX - rect.left) / this.scale - this.translateX / this.scale) * (this.canvas.width / rect.width));
        const y = Math.floor(((event.clientY - rect.top) / this.scale - this.translateY / this.scale) * (this.canvas.height / rect.height));

        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) return;

        this.floodFill(x, y);
    }

    floodFill(startX, startY) {
        this.isProcessing = true;
        
        // 保存当前状态到历史记录
        this.saveToHistory();
        
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;
        
        const startPos = (startY * this.canvas.width + startX) * 4;
        const startR = pixels[startPos];
        const startG = pixels[startPos + 1];
        const startB = pixels[startPos + 2];
        const startA = pixels[startPos + 3];
        
        const targetColor = this.hexToRgb(this.currentColor);
        
        // 如果点击的颜色与目标颜色相同，则不需要填充
        if (this.colorMatch(
            [startR, startG, startB, startA],
            [targetColor.r, targetColor.g, targetColor.b, 255],
            2
        )) {
            this.isProcessing = false;
            return;
        }

        // 使用扫描线填充算法
        const stack = [[startX, startY]];
        const tolerance = 5; // 降低容差值以提高精确度
        
        while (stack.length > 0) {
            const [x, y] = stack.pop();
            let curX = x;
            
            // 找到当前扫描线最左边的点
            while (curX >= 0 && this.checkPixel(pixels, curX, y, startR, startG, startB, startA, tolerance)) {
                curX--;
            }
            curX++;
            
            let spanAbove = false;
            let spanBelow = false;
            
            // 向右扫描当前行
            while (curX < this.canvas.width && this.checkPixel(pixels, curX, y, startR, startG, startB, startA, tolerance)) {
                // 填充当前像素
                const pos = (y * this.canvas.width + curX) * 4;
                pixels[pos] = targetColor.r;
                pixels[pos + 1] = targetColor.g;
                pixels[pos + 2] = targetColor.b;
                pixels[pos + 3] = 255;
                
                // 检查上方像素
                if (!spanAbove && y > 0 && this.checkPixel(pixels, curX, y - 1, startR, startG, startB, startA, tolerance)) {
                    stack.push([curX, y - 1]);
                    spanAbove = true;
                } else if (spanAbove && y > 0 && !this.checkPixel(pixels, curX, y - 1, startR, startG, startB, startA, tolerance)) {
                    spanAbove = false;
                }
                
                // 检查下方像素
                if (!spanBelow && y < this.canvas.height - 1 && this.checkPixel(pixels, curX, y + 1, startR, startG, startB, startA, tolerance)) {
                    stack.push([curX, y + 1]);
                    spanBelow = true;
                } else if (spanBelow && y < this.canvas.height - 1 && !this.checkPixel(pixels, curX, y + 1, startR, startG, startB, startA, tolerance)) {
                    spanBelow = false;
                }
                
                curX++;
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        this.isProcessing = false;
    }

    // 添加像素检查辅助方法
    checkPixel(pixels, x, y, startR, startG, startB, startA, tolerance) {
        const pos = (y * this.canvas.width + x) * 4;
        return this.colorMatch(
            [pixels[pos], pixels[pos + 1], pixels[pos + 2], pixels[pos + 3]],
            [startR, startG, startB, startA],
            tolerance
        );
    }

    // 优化颜色匹配方法
    colorMatch(color1, color2, tolerance = 0) {
        // 使用欧几里得距离来计算颜色差异
        const deltaR = color1[0] - color2[0];
        const deltaG = color1[1] - color2[1];
        const deltaB = color1[2] - color2[2];
        const deltaA = color1[3] - color2[3];
        
        // 计算颜色差异的平方和的平方根
        const distance = Math.sqrt(
            deltaR * deltaR +
            deltaG * deltaG +
            deltaB * deltaB +
            deltaA * deltaA
        );
        
        return distance <= tolerance * 2;
    }

    // 添加历史记录相关方法
    saveToHistory() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // 如果当前不是最新状态，删除当前位置之后的所有记录
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentHistoryIndex + 1);
        }
        
        // 添加新的状态
        this.history.push(imageData);
        this.currentHistoryIndex++;
        
        // 限制历史记录数量
        if (this.history.length > this.maxHistorySteps) {
            this.history.shift();
            this.currentHistoryIndex--;
        }
        
        // 更新按钮状态
        this.updateUndoRedoState();
    }

    undo() {
        if (this.currentHistoryIndex > this.initialStateIndex) {
            this.currentHistoryIndex--;
            this.ctx.putImageData(this.history[this.currentHistoryIndex], 0, 0);
            this.updateUndoRedoState();
            this.restoreDefaultTool(); // 恢复默认工具状态
        }
    }

    redo() {
        if (this.currentHistoryIndex < this.history.length - 1) {
            this.currentHistoryIndex++;
            this.ctx.putImageData(this.history[this.currentHistoryIndex], 0, 0);
            this.updateUndoRedoState();
            this.restoreDefaultTool(); // 恢复默认工具状态
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    downloadImage() {
        const link = document.createElement('a');
        link.download = '填色作品.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // 清空画布
                this.ctx.fillStyle = 'white';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                // 计算图片缩放比例以适应画布
                const scale = Math.min(
                    this.canvas.width / img.width,
                    this.canvas.height / img.height
                ) * 0.8;
                
                const width = img.width * scale;
                const height = img.height * scale;
                
                // 居中绘制图片
                const x = (this.canvas.width - width) / 2;
                const y = (this.canvas.height - height) / 2;
                
                this.ctx.drawImage(img, x, y, width, height);
                
                // 更新原始图片状态
                this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                
                // 保存到历史记录
                this.saveToHistory();
                this.initialStateIndex = this.currentHistoryIndex; // 更新初始状态的索引
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    createColorPalette() {
        const colorPicker = document.querySelector('.color-picker');
        if (!colorPicker) return;

        // 修改颜色选择器的HTML结构
        colorPicker.innerHTML = `
            <div class="upload-section">
                <button class="upload-btn">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <span>上传图片</span>
                </button>
                <input type="file" accept="image/*" style="display: none">
            </div>
            <div class="color-preview"></div>
            <div class="color-selector">
                <div class="color-map">
                    <div class="color-picker-indicator"></div>
                </div>
                <div class="color-slider">
                    <div class="color-slider-track"></div>
                    <div class="color-slider-thumb"></div>
                    <input type="range" min="0" max="360" value="${this.currentHue}">
                </div>
            </div>
        `;

        // 获取DOM元素
        const colorPreview = colorPicker.querySelector('.color-preview');
        const colorMap = colorPicker.querySelector('.color-map');
        const colorIndicator = colorPicker.querySelector('.color-picker-indicator');
        const hueSlider = colorPicker.querySelector('.color-slider input');
        const hueThumb = colorPicker.querySelector('.color-slider-thumb');

        // 修改创建颜色地图的方法
        const createColorMap = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;

            // 创建白色到纯色的渐变
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, '#FFFFFF');
            gradient.addColorStop(1, `hsl(${this.currentHue}, 100%, 50%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 创建从透明到黑色的渐变
            const blackGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            blackGradient.addColorStop(0, 'rgba(0,0,0,0)');
            blackGradient.addColorStop(1, 'rgba(0,0,0,1)');
            ctx.fillStyle = blackGradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            colorMap.style.backgroundImage = `url(${canvas.toDataURL()})`;
        };

        // 更新颜色预览的方法
        const updateColorPreview = () => {
            const color = `hsl(${this.currentHue}, ${this.currentSaturation}%, ${this.currentLightness}%)`;
            colorPreview.style.backgroundColor = color;
            this.currentColor = this.hslToHex(this.currentHue, this.currentSaturation, this.currentLightness);
            
            // 同步更新颜色选择器的位置
            updateIndicatorPosition(
                (this.currentSaturation / 100) * colorMap.offsetWidth,
                ((100 - this.currentLightness) / 100) * colorMap.offsetHeight
            );
        };

        // 更新颜色选择器指示器位置
        const updateIndicatorPosition = (x, y) => {
            colorIndicator.style.left = `${x}px`;
            colorIndicator.style.top = `${y}px`;
        };

        // 更新色相滑块指示器位置
        const updateHueThumbPosition = (value) => {
            const percent = (value / 360) * 100;
            hueThumb.style.left = `${percent}%`;
        };

        // 颜色地图点击和拖动事件
        colorMap.addEventListener('mousedown', (e) => {
            const updateColor = (e) => {
                const rect = colorMap.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
                
                this.currentSaturation = (x / rect.width) * 100;
                this.currentLightness = 100 - (y / rect.height) * 100;
                
                updateColorPreview();
            };

            const handleMouseMove = (e) => {
                e.preventDefault();
                updateColor(e);
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            updateColor(e);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        // 色相滑块事件
        hueSlider.addEventListener('input', (e) => {
            this.currentHue = parseInt(e.target.value);
            updateHueThumbPosition(this.currentHue);
            createColorMap();
            updateColorPreview();
        });

        // 初始化颜色选择器
        createColorMap();
        updateColorPreview();
        updateHueThumbPosition(this.currentHue);

        // 修改图片上传相关代码
        const uploadBtn = colorPicker.querySelector('.upload-btn');
        const fileInput = colorPicker.querySelector('input[type="file"]');

        uploadBtn.addEventListener('click', () => {
            if (this.originalImageData) {
                // 如果已有图片，显示确认对话框
                this.showUploadConfirmation(() => {
                    fileInput.click();
                });
            } else {
                // 如果没有图片，直接打开文件选择器
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImage(file);
            }
            // 清空 input 的值，确保同一文件可以重复选择
            fileInput.value = '';
        });
    }

    // 修改 HSL 转 HEX 的方法，使其更准确
    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;
        
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        
        const rgb = [
            Math.round(255 * f(0)),
            Math.round(255 * f(8)),
            Math.round(255 * f(4))
        ];
        
        return '#' + rgb.map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    handleZoom(delta, event = null) {
        const oldScale = this.scale;
        this.scale = Math.max(1, Math.min(5, this.scale + delta));

        if (event) {
            // 计算鼠标位置相对于画布的偏移
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            // 调整偏移量，使缩放以鼠标位置为中心
            this.translateX += (x - this.translateX) * (1 - this.scale / oldScale);
            this.translateY += (y - this.translateY) * (1 - this.scale / oldScale);
        }

        this.updateCanvasTransform();
    }

    updateCanvasTransform() {
        // 限制平移范围
        const maxTranslateX = (this.scale - 1) * this.canvas.width / 2;
        const maxTranslateY = (this.scale - 1) * this.canvas.height / 2;

        this.translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, this.translateX));
        this.translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, this.translateY));

        this.canvas.style.transform = `scale(${this.scale}) translate(${this.translateX / this.scale}px, ${this.translateY / this.scale}px)`;
    }

    // 鼠标事件处理
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / this.scale - this.translateX / this.scale) * (this.canvas.width / rect.width));
        const y = Math.floor(((event.clientY - rect.top) / this.scale - this.translateY / this.scale) * (this.canvas.height / rect.height));

        switch(this.currentTool) {
            case 'fill':
                this.floodFill(x, y);
                break;
            case 'eraser':
                this.isDrawing = true;
                this.erase(x, y);
                break;
            case 'eyedropper':
                this.pickColor(x, y);
                break;
        }
    }

    handleMouseMove(event) {
        if (!this.isDrawing || this.currentTool !== 'eraser') return;

        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor(((event.clientX - rect.left) / this.scale - this.translateX / this.scale) * (this.canvas.width / rect.width));
        const y = Math.floor(((event.clientY - rect.top) / this.scale - this.translateY / this.scale) * (this.canvas.height / rect.height));

        this.erase(x, y);
    }

    handleMouseUp() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveToHistory();
        }
    }

    // 橡皮擦功能
    erase(x, y) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.eraserSize / this.scale, 0, Math.PI * 2);
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        this.ctx.restore();
    }

    // 取色器功能
    pickColor(x, y) {
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        const color = `#${[pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join('')}`;
        this.currentColor = color;
        
        // 更新颜色选择器
        const colorPreview = document.querySelector('.color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = color;
        }
    }

    // 添加清空确认对话框方法
    showClearConfirmation() {
        // 创建确认对话框
        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>系统提示</h3>
                    <button class="close-btn">×</button>
                </div>
                <div class="dialog-body">
                    <p>确定清除画布中所有已填色块吗？</p>
                    <p class="warning-text">请注意，此操作不可撤销！</p>
                </div>
                <div class="dialog-footer">
                    <button class="confirm-btn">确定清除</button>
                    <button class="cancel-btn">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // 添加事件监听
        const closeBtn = dialog.querySelector('.close-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');

        const closeDialog = () => {
            dialog.remove();
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        
        confirmBtn.addEventListener('click', () => {
            this.clearCanvas();
            closeDialog();
        });
    }

    // 添加清空画布方法
    clearCanvas() {
        if (this.originalImageData) {
            this.ctx.putImageData(this.originalImageData, 0, 0);
            this.saveToHistory();
            this.restoreDefaultTool(); // 恢复默认工具状态
        }
    }

    // 添加更新撤销/重做按钮状态的方法
    updateUndoRedoState() {
        const prevBtn = document.querySelector('.tool[data-tool="prev"]');
        const nextBtn = document.querySelector('.tool[data-tool="next"]');
        
        if (prevBtn) {
            prevBtn.style.opacity = this.currentHistoryIndex > 0 ? '1' : '0.5';
            prevBtn.style.cursor = this.currentHistoryIndex > 0 ? 'pointer' : 'not-allowed';
        }
        
        if (nextBtn) {
            nextBtn.style.opacity = this.currentHistoryIndex < this.history.length - 1 ? '1' : '0.5';
            nextBtn.style.cursor = this.currentHistoryIndex < this.history.length - 1 ? 'pointer' : 'not-allowed';
        }
    }

    loadTemplate(templateUrl) {
        const img = new Image();
        
        img.onload = () => {
            // 清空画布
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 确保画布尺寸已设置
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                this.initializeCanvas();
            }
            
            // 计算图片缩放比例以适应画布
            const scale = Math.min(
                this.canvas.width / img.width,
                this.canvas.height / img.height
            ) * 0.8;
            
            const width = img.width * scale;
            const height = img.height * scale;
            
            // 居中绘制图片
            const x = (this.canvas.width - width) / 2;
            const y = (this.canvas.height - height) / 2;
            
            this.ctx.drawImage(img, x, y, width, height);
            
            // 保存原始图片状态
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // 保存初始状态到历史记录
            this.saveToHistory();
            this.initialStateIndex = this.currentHistoryIndex; // 记录初始状态的索引

            // 显示填色界面
            document.querySelector('.coloring-interface').style.display = 'flex';
            // 隐藏主页内容
            document.querySelector('.main-content').style.display = 'none';
        };
        
        img.onerror = (error) => {
            console.error('Failed to load image:', templateUrl, error);
            alert('加载线稿失败，请确认文件路径正确');
        };
        
        console.log('Loading template:', templateUrl);
        img.src = templateUrl;
    }

    // 修改操作后恢复默认工具状态
    restoreDefaultTool() {
        this.currentTool = this.defaultTool;
        // 更新工具栏样式
        const tools = document.querySelectorAll('.tool');
        tools.forEach(tool => {
            if (tool.dataset.tool === this.defaultTool) {
                tool.classList.add('active');
            } else {
                tool.classList.remove('active');
            }
        });
        this.canvas.style.cursor = 'pointer';
    }

    // 添加上传确认对话框方法
    showUploadConfirmation(callback) {
        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>系统提示</h3>
                    <button class="close-btn">×</button>
                </div>
                <div class="dialog-body">
                    <p>上传新图片将覆盖当前图片，是否继续？</p>
                    <p class="warning-text">此操作将清除当前的所有填色内容！</p>
                </div>
                <div class="dialog-footer">
                    <button class="confirm-btn">确定上传</button>
                    <button class="cancel-btn">取消</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const closeBtn = dialog.querySelector('.close-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');

        const closeDialog = () => {
            dialog.remove();
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        
        confirmBtn.addEventListener('click', () => {
            closeDialog();
            callback(); // 执行上传操作
        });
    }
}

// 初始化应用
window.addEventListener('DOMContentLoaded', () => {
    // 创建 ColoringApp 实例并保存到全局变量
    window.coloringApp = new ColoringApp();
    coloringApp = window.coloringApp;
}); 