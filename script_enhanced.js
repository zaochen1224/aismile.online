/**
 * Enhanced AI Smile Generator - Advanced UX Features
 * Features: Zoom functionality, time estimation, advanced animations, accessibility
 * Version: 3.0.0
 */

// Enhanced Configuration
const CONFIG = {
    API: {
        BASE_URL: 'https://api.ailabtools.com',
        ENDPOINTS: {
            UPLOAD: '/api/v1/upload',
            CHANGE_EXPRESSION: '/api/v1/change-expression',
            RESULT: '/api/v1/result'
        },
        TIMEOUT: 30000,
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000,
        // Estimated processing times (in seconds)
        ESTIMATED_TIMES: {
            UPLOAD: 3,
            PROCESSING: 15,
            DOWNLOAD: 2
        }
    },
    
    FILE: {
        MAX_SIZE: 10 * 1024 * 1024,
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
    },
    
    UI: {
        PROGRESS_UPDATE_INTERVAL: 100,
        TOAST_DURATION: 5000,
        LOADING_TIPS_INTERVAL: 2000,
        ANIMATION_DURATION: 300,
        ZOOM_SCALE: 2
    },
    
    EXPRESSIONS: {
        SMILE: 'smile',
        HAPPY: 'happy',
        LAUGH: 'laugh',
        NATURAL: 'natural',
        JOY: 'joy'
    }
};

// Enhanced Utility Functions
const Utils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}秒`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
        }
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const result = document.execCommand('copy');
                document.body.removeChild(textArea);
                return result;
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    },

    // Image processing utilities
    async resizeImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.9) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = img;
                
                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    },

    // Analytics and performance
    measurePerformance(name, fn) {
        return async (...args) => {
            const start = performance.now();
            const result = await fn(...args);
            const end = performance.now();
            console.log(`Performance: ${name} took ${(end - start).toFixed(2)}ms`);
            return result;
        };
    },

    // Accessibility helpers
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.style.cssText = `
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0,0,0,0);
            white-space: nowrap;
            border: 0;
        `;
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
};

// Enhanced API Client
class APIClient {
    constructor() {
        this.apiKey = this.getApiKey();
        this.baseURL = CONFIG.API.BASE_URL;
        this.requestCount = 0;
        this.errorCount = 0;
    }

    getApiKey() {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.AILABTOOLS_API_KEY;
        }
        
        const stored = localStorage.getItem('ailabtools_api_key');
        if (stored) return stored;
        
        return '';
    }

    setApiKey(key) {
        this.apiKey = key;
        if (key) {
            localStorage.setItem('ailabtools_api_key', key);
        } else {
            localStorage.removeItem('ailabtools_api_key');
        }
    }

    async makeRequest(url, options = {}, retries = CONFIG.API.MAX_RETRIES) {
        this.requestCount++;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Request-ID': Utils.generateId(),
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                this.errorCount++;
                throw new APIError(`HTTP ${response.status}: ${response.statusText}`, response.status);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (retries > 0 && this.shouldRetry(error)) {
                console.warn(`Request failed, retrying... (${CONFIG.API.MAX_RETRIES - retries + 1}/${CONFIG.API.MAX_RETRIES})`);
                await Utils.sleep(CONFIG.API.RETRY_DELAY * (CONFIG.API.MAX_RETRIES - retries + 1));
                return this.makeRequest(url, options, retries - 1);
            }
            
            this.errorCount++;
            throw error;
        }
    }

    shouldRetry(error) {
        if (error.name === 'AbortError') return false;
        if (error instanceof APIError && error.status >= 400 && error.status < 500) return false;
        return true;
    }

    async uploadImage(file, onProgress) {
        const formData = new FormData();
        formData.append('image', file);

        // Simulate progress for upload
        if (onProgress) {
            const progressInterval = setInterval(() => {
                onProgress(Math.min(90, Math.random() * 30 + 60));
            }, 500);
            
            setTimeout(() => clearInterval(progressInterval), 2000);
        }

        const response = await this.makeRequest(`${this.baseURL}${CONFIG.API.ENDPOINTS.UPLOAD}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (onProgress) onProgress(100);
        
        return this.extractUrl(data, ['image_url', 'url', 'file_url']);
    }

    async changeExpression(imageUrl, expression = CONFIG.EXPRESSIONS.SMILE, options = {}) {
        const payload = {
            image_url: imageUrl,
            expression: expression,
            intensity: options.intensity || 0.8,
            preserve_identity: options.preserveIdentity !== false,
            enhance_quality: options.enhanceQuality !== false,
            return_format: options.returnFormat || 'url'
        };

        const response = await this.makeRequest(`${this.baseURL}${CONFIG.API.ENDPOINTS.CHANGE_EXPRESSION}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.result_url || data.image_url || data.url) {
            return this.extractUrl(data, ['result_url', 'image_url', 'url']);
        }
        
        if (data.job_id || data.task_id || data.id) {
            const jobId = data.job_id || data.task_id || data.id;
            return this.pollForResult(jobId);
        }
        
        throw new APIError('Unexpected response format from API');
    }

    async pollForResult(jobId, maxAttempts = 30) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await this.makeRequest(`${this.baseURL}${CONFIG.API.ENDPOINTS.RESULT}/${jobId}`);
                const data = await response.json();
                
                if (data.status === 'completed' || data.status === 'success') {
                    return this.extractUrl(data, ['result_url', 'image_url', 'url']);
                } else if (data.status === 'failed' || data.status === 'error') {
                    throw new APIError('Processing failed on server');
                }
                
                await Utils.sleep(2000);
            } catch (error) {
                if (attempt === maxAttempts - 1) throw error;
                await Utils.sleep(2000);
            }
        }
        
        throw new APIError('Processing timeout - result not ready');
    }

    extractUrl(data, keys) {
        for (const key of keys) {
            if (data[key]) return data[key];
            if (data.data && data.data[key]) return data.data[key];
            if (data.result && data.result[key]) return data.result[key];
        }
        throw new APIError('No valid URL found in response');
    }

    getStats() {
        return {
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            successRate: this.requestCount > 0 ? ((this.requestCount - this.errorCount) / this.requestCount * 100).toFixed(1) + '%' : '0%'
        };
    }
}

// Enhanced Progress Manager with Time Estimation
class ProgressManager {
    constructor(progressElement, textElement, timeElement) {
        this.progressElement = progressElement;
        this.textElement = textElement;
        this.timeElement = timeElement;
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.animationId = null;
        this.startTime = null;
        this.estimatedDuration = 0;
    }

    setProgress(progress, text, estimatedTime = null) {
        this.targetProgress = Math.max(0, Math.min(100, progress));
        
        if (text && this.textElement) {
            this.textElement.innerHTML = `<i class="material-icons">autorenew</i>${text}`;
        }
        
        if (estimatedTime !== null) {
            this.estimatedDuration = estimatedTime;
            this.startTime = Date.now();
        }
        
        this.animate();
        this.updateTimeEstimate();
    }

    animate() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        const step = () => {
            const diff = this.targetProgress - this.currentProgress;
            if (Math.abs(diff) < 0.1) {
                this.currentProgress = this.targetProgress;
            } else {
                this.currentProgress += diff * 0.1;
            }

            if (this.progressElement) {
                this.progressElement.style.width = `${this.currentProgress}%`;
                this.progressElement.setAttribute('aria-valuenow', Math.round(this.currentProgress));
            }

            if (Math.abs(this.targetProgress - this.currentProgress) > 0.1) {
                this.animationId = requestAnimationFrame(step);
            } else {
                this.updateTimeEstimate();
            }
        };

        this.animationId = requestAnimationFrame(step);
    }

    updateTimeEstimate() {
        if (!this.timeElement || !this.startTime || this.currentProgress === 0) return;
        
        const elapsed = (Date.now() - this.startTime) / 1000;
        const estimatedTotal = (elapsed / this.currentProgress) * 100;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        
        if (remaining > 0) {
            this.timeElement.innerHTML = `<i class="material-icons">schedule</i>预计剩余: ${Utils.formatTime(remaining)}`;
        } else {
            this.timeElement.innerHTML = `<i class="material-icons">check_circle</i>即将完成...`;
        }
    }

    reset() {
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.startTime = null;
        this.estimatedDuration = 0;
        
        if (this.progressElement) {
            this.progressElement.style.width = '0%';
            this.progressElement.setAttribute('aria-valuenow', 0);
        }
        if (this.textElement) {
            this.textElement.innerHTML = '';
        }
        if (this.timeElement) {
            this.timeElement.innerHTML = '';
        }
    }
}

// Zoom Modal Manager
class ZoomManager {
    constructor() {
        this.modal = null;
        this.currentImage = null;
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'zoom-modal';
        this.modal.innerHTML = `
            <button class="zoom-close" aria-label="关闭放大视图">
                <i class="material-icons">close</i>
            </button>
            <img class="zoom-image" alt="放大查看">
            <div class="zoom-controls">
                <button class="zoom-btn zoom-in" aria-label="放大">
                    <i class="material-icons">zoom_in</i>
                </button>
                <button class="zoom-btn zoom-out" aria-label="缩小">
                    <i class="material-icons">zoom_out</i>
                </button>
                <button class="zoom-btn zoom-reset" aria-label="重置缩放">
                    <i class="material-icons">zoom_out_map</i>
                </button>
            </div>
        `;
        document.body.appendChild(this.modal);
    }

    bindEvents() {
        const closeBtn = this.modal.querySelector('.zoom-close');
        const zoomInBtn = this.modal.querySelector('.zoom-in');
        const zoomOutBtn = this.modal.querySelector('.zoom-out');
        const resetBtn = this.modal.querySelector('.zoom-reset');
        const image = this.modal.querySelector('.zoom-image');

        closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        let scale = 1;
        zoomInBtn.addEventListener('click', () => {
            scale = Math.min(scale * 1.2, 3);
            image.style.transform = `scale(${scale})`;
        });

        zoomOutBtn.addEventListener('click', () => {
            scale = Math.max(scale / 1.2, 0.5);
            image.style.transform = `scale(${scale})`;
        });

        resetBtn.addEventListener('click', () => {
            scale = 1;
            image.style.transform = `scale(${scale})`;
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (this.modal.classList.contains('active')) {
                if (e.key === 'Escape') this.close();
                if (e.key === '+' || e.key === '=') zoomInBtn.click();
                if (e.key === '-') zoomOutBtn.click();
                if (e.key === '0') resetBtn.click();
            }
        });

        // Mouse wheel zoom
        image.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomInBtn.click();
            } else {
                zoomOutBtn.click();
            }
        });
    }

    open(imageSrc, altText = '') {
        const image = this.modal.querySelector('.zoom-image');
        image.src = imageSrc;
        image.alt = altText;
        image.style.transform = 'scale(1)';
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus management
        this.modal.querySelector('.zoom-close').focus();
        
        Utils.announceToScreenReader('图片放大视图已打开');
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        Utils.announceToScreenReader('图片放大视图已关闭');
    }
}

// Enhanced Toast Manager
class ToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toasts = new Map();
        this.maxToasts = 5;
    }

    createContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'false');
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION, actions = []) {
        // Limit number of toasts
        if (this.toasts.size >= this.maxToasts) {
            const oldestId = this.toasts.keys().next().value;
            this.dismiss(oldestId);
        }

        const id = Utils.generateId();
        const toast = this.createToast(id, message, type, actions);
        
        this.container.appendChild(toast);
        this.toasts.set(id, { element: toast, timer: null });

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto dismiss
        if (duration > 0) {
            const timer = setTimeout(() => this.dismiss(id), duration);
            this.toasts.get(id).timer = timer;
        }

        // Announce to screen readers
        Utils.announceToScreenReader(`${type}: ${message}`);

        return id;
    }

    createToast(id, message, type, actions) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        const iconMap = {
            'success': 'check_circle',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };

        let actionsHtml = '';
        if (actions.length > 0) {
            actionsHtml = `
                <div class="toast-actions">
                    ${actions.map(action => `
                        <button class="toast-action" data-action="${action.id}">
                            ${action.label}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        toast.innerHTML = `
            <div class="toast-content">
                <i class="material-icons toast-icon">${iconMap[type] || 'info'}</i>
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="关闭通知">
                    <i class="material-icons">close</i>
                </button>
            </div>
            ${actionsHtml}
        `;

        // Bind events
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(id));

        // Bind action events
        actions.forEach(action => {
            const actionBtn = toast.querySelector(`[data-action="${action.id}"]`);
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    action.callback();
                    this.dismiss(id);
                });
            }
        });

        // Pause auto-dismiss on hover
        toast.addEventListener('mouseenter', () => {
            const toastData = this.toasts.get(id);
            if (toastData && toastData.timer) {
                clearTimeout(toastData.timer);
                toastData.timer = null;
            }
        });

        toast.addEventListener('mouseleave', () => {
            const toastData = this.toasts.get(id);
            if (toastData && !toastData.timer) {
                toastData.timer = setTimeout(() => this.dismiss(id), 3000);
            }
        });

        return toast;
    }

    dismiss(id) {
        const toastData = this.toasts.get(id);
        if (toastData) {
            const { element, timer } = toastData;
            
            if (timer) clearTimeout(timer);
            
            element.classList.remove('show');
            element.classList.add('hide');
            
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.toasts.delete(id);
            }, CONFIG.UI.ANIMATION_DURATION);
        }
    }

    success(message, duration, actions) {
        return this.show(message, 'success', duration, actions);
    }

    error(message, duration, actions) {
        return this.show(message, 'error', duration, actions);
    }

    warning(message, duration, actions) {
        return this.show(message, 'warning', duration, actions);
    }

    info(message, duration, actions) {
        return this.show(message, 'info', duration, actions);
    }

    clear() {
        this.toasts.forEach((_, id) => this.dismiss(id));
    }
}

// Main Enhanced Application
class EnhancedAISmileGenerator {
    constructor() {
        this.apiClient = new APIClient();
        this.toast = new ToastManager();
        this.zoomManager = new ZoomManager();
        this.currentImage = null;
        this.resultImage = null;
        this.isProcessing = false;
        this.progressManager = null;
        this.processingStartTime = null;
        
        this.init();
    }

    async init() {
        try {
            this.initializeElements();
            this.bindEvents();
            this.checkApiKey();
            this.initializeComparison();
            this.setupAccessibility();
            
            // Performance monitoring
            this.setupPerformanceMonitoring();
            
            console.log('Enhanced AI Smile Generator initialized successfully');
            Utils.announceToScreenReader('AI微笑生成器已准备就绪');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.toast.error('应用初始化失败，请刷新页面重试。');
        }
    }

    initializeElements() {
        // Upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.imagePreview = document.getElementById('imagePreview');
        this.previewImg = document.getElementById('previewImg');
        this.removeBtn = document.getElementById('removeBtn');
        this.imageInfo = document.getElementById('imageInfo');

        // Processing elements
        this.processBtn = document.getElementById('processBtn');
        this.loadingState = document.getElementById('loadingState');
        this.progressFill = document.getElementById('progressFill');
        this.loadingTip = document.getElementById('loadingTip');
        this.timeEstimate = document.getElementById('timeEstimate');

        // Result elements
        this.comparisonSection = document.getElementById('comparisonSection');
        this.beforeImg = document.getElementById('beforeImg');
        this.afterImg = document.getElementById('afterImg');
        this.comparisonSlider = document.getElementById('comparisonSlider');
        this.resultSection = document.getElementById('resultSection');
        this.resultImg = document.getElementById('resultImg');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newImageBtn = document.getElementById('newImageBtn');

        // Share elements
        this.shareSection = document.getElementById('shareSection');
        this.shareButtons = document.querySelectorAll('.share-btn');

        // Initialize progress manager
        if (this.progressFill && this.loadingTip) {
            this.progressManager = new ProgressManager(
                this.progressFill, 
                this.loadingTip, 
                this.timeEstimate
            );
        }

        // Add zoom buttons to images
        this.addZoomButtons();

        // Validate required elements
        const requiredElements = ['uploadArea', 'fileInput', 'processBtn'];
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                throw new Error(`Required element not found: ${elementId}`);
            }
        }
    }

    addZoomButtons() {
        // Add zoom button to preview image
        if (this.previewImg) {
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '<i class="material-icons">zoom_in</i>';
            zoomBtn.setAttribute('aria-label', '放大查看图片');
            zoomBtn.addEventListener('click', () => {
                this.zoomManager.open(this.previewImg.src, '上传的图片');
            });
            this.previewImg.parentNode.appendChild(zoomBtn);
        }

        // Add zoom buttons to result images
        if (this.resultImg) {
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '<i class="material-icons">zoom_in</i>';
            zoomBtn.setAttribute('aria-label', '放大查看结果');
            zoomBtn.addEventListener('click', () => {
                this.zoomManager.open(this.resultImg.src, 'AI增强后的图片');
            });
            this.resultImg.parentNode.appendChild(zoomBtn);
        }
    }

    bindEvents() {
        // Upload events with enhanced feedback
        if (this.uploadArea && this.fileInput) {
            this.uploadArea.addEventListener('click', () => {
                this.fileInput.click();
                Utils.announceToScreenReader('打开文件选择对话框');
            });
            
            this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
            this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
            this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        // Enhanced button events
        if (this.removeBtn) {
            this.removeBtn.addEventListener('click', this.removeImage.bind(this));
        }

        if (this.processBtn) {
            this.processBtn.addEventListener('click', this.processImage.bind(this));
        }

        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', this.downloadResult.bind(this));
        }

        if (this.newImageBtn) {
            this.newImageBtn.addEventListener('click', this.resetForNewImage.bind(this));
        }

        // Enhanced comparison slider
        if (this.comparisonSlider) {
            this.comparisonSlider.addEventListener('input', 
                Utils.throttle(this.updateComparison.bind(this), 16)
            );
        }

        // Enhanced share buttons
        this.shareButtons.forEach(btn => {
            btn.addEventListener('click', this.handleShare.bind(this));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', () => {
            this.toast.success('网络连接已恢复');
        });
        window.addEventListener('offline', () => {
            this.toast.warning('网络连接已断开，部分功能可能不可用');
        });
    }

    setupAccessibility() {
        // Add ARIA labels dynamically
        if (this.uploadArea) {
            this.uploadArea.setAttribute('role', 'button');
            this.uploadArea.setAttribute('tabindex', '0');
            this.uploadArea.setAttribute('aria-describedby', 'upload-instructions');
        }

        if (this.progressFill) {
            this.progressFill.setAttribute('role', 'progressbar');
            this.progressFill.setAttribute('aria-valuemin', '0');
            this.progressFill.setAttribute('aria-valuemax', '100');
            this.progressFill.setAttribute('aria-valuenow', '0');
        }

        // Add focus indicators
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });
    }

    setupPerformanceMonitoring() {
        // Monitor Core Web Vitals
        if ('web-vital' in window) {
            // This would integrate with actual web vitals library
            console.log('Performance monitoring enabled');
        }

        // Monitor API performance
        this.apiClient.makeRequest = Utils.measurePerformance(
            'API Request', 
            this.apiClient.makeRequest.bind(this.apiClient)
        );
    }

    checkApiKey() {
        if (!this.apiClient.apiKey) {
            const actions = [{
                id: 'learn-more',
                label: '了解更多',
                callback: () => {
                    window.open('https://ailabtools.com/docs', '_blank');
                }
            }];
            
            this.toast.warning(
                '请设置您的 AILabTools API 密钥。在浏览器控制台中运行: smileGenerator.setApiKey("your-api-key")',
                0,
                actions
            );
        }
    }

    setApiKey(key) {
        this.apiClient.setApiKey(key);
        if (key) {
            this.toast.success('API 密钥设置成功！现在可以使用AI功能了。');
            Utils.announceToScreenReader('API密钥已设置，可以开始使用');
        } else {
            this.toast.info('API 密钥已清除。');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.classList.add('drag-over');
        Utils.announceToScreenReader('文件悬停在上传区域上方');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!this.uploadArea.contains(e.relatedTarget)) {
            this.uploadArea.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            Utils.announceToScreenReader('文件已放置，开始处理');
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    async handleFile(file) {
        try {
            // Validate file
            FileValidator.validate(file);

            // Show processing feedback
            this.toast.info('正在处理上传的文件...');

            // Optimize image if needed
            let processedFile = file;
            if (file.size > 5 * 1024 * 1024) { // 5MB
                this.toast.info('图片较大，正在优化...');
                processedFile = await Utils.resizeImage(file);
            }

            // Create image object
            this.currentImage = {
                file: processedFile,
                originalFile: file,
                name: file.name,
                size: processedFile.size,
                originalSize: file.size,
                type: file.type,
                dataUrl: await this.fileToDataUrl(processedFile)
            };

            this.showImagePreview();
            
            const sizeReduction = file.size !== processedFile.size ? 
                ` (已优化: ${Utils.formatFileSize(file.size)} → ${Utils.formatFileSize(processedFile.size)})` : '';
            
            this.toast.success(`图片上传成功！${sizeReduction}`);
            Utils.announceToScreenReader('图片上传成功，可以开始处理');

        } catch (error) {
            if (error instanceof ValidationError) {
                this.toast.error(error.message);
            } else {
                console.error('File handling error:', error);
                this.toast.error('文件处理失败，请重试。');
            }
            Utils.announceToScreenReader('文件上传失败');
        }
    }

    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    showImagePreview() {
        if (!this.currentImage) return;

        // Update preview image
        if (this.previewImg) {
            this.previewImg.src = this.currentImage.dataUrl;
            this.previewImg.alt = `预览: ${this.currentImage.name}`;
        }

        // Update image info with enhanced details
        if (this.imageInfo) {
            const sizeInfo = this.currentImage.originalSize !== this.currentImage.size ?
                `${Utils.formatFileSize(this.currentImage.size)} (原始: ${Utils.formatFileSize(this.currentImage.originalSize)})` :
                Utils.formatFileSize(this.currentImage.size);
            
            this.imageInfo.innerHTML = `
                <i class="material-icons">image</i>
                ${this.currentImage.name} (${sizeInfo})
            `;
        }

        // Show preview section with animation
        if (this.imagePreview) {
            this.imagePreview.style.display = 'block';
            this.imagePreview.classList.add('animate-in');
        }

        // Enable process button
        if (this.processBtn) {
            this.processBtn.disabled = false;
            this.processBtn.style.display = 'block';
            this.processBtn.classList.add('animate-in');
        }

        // Hide upload area
        if (this.uploadArea) {
            this.uploadArea.style.display = 'none';
        }
    }

    removeImage() {
        this.currentImage = null;
        this.resultImage = null;

        // Reset file input
        if (this.fileInput) {
            this.fileInput.value = '';
        }

        // Hide preview with animation
        if (this.imagePreview) {
            this.imagePreview.classList.add('animate-out');
            setTimeout(() => {
                this.imagePreview.style.display = 'none';
                this.imagePreview.classList.remove('animate-out', 'animate-in');
            }, CONFIG.UI.ANIMATION_DURATION);
        }

        // Show upload area
        if (this.uploadArea) {
            setTimeout(() => {
                this.uploadArea.style.display = 'block';
            }, CONFIG.UI.ANIMATION_DURATION / 2);
        }

        // Hide result sections
        this.hideResults();

        // Disable process button
        if (this.processBtn) {
            this.processBtn.disabled = true;
            this.processBtn.style.display = 'none';
            this.processBtn.classList.remove('animate-in');
        }

        this.toast.info('图片已移除。');
        Utils.announceToScreenReader('图片已移除，可以上传新图片');
    }

    async processImage() {
        if (!this.currentImage || this.isProcessing) return;

        if (!this.apiClient.apiKey) {
            const actions = [{
                id: 'set-key',
                label: '设置密钥',
                callback: () => {
                    const key = prompt('请输入您的 AILabTools API 密钥:');
                    if (key) this.setApiKey(key);
                }
            }];
            
            this.toast.error('请先设置 API 密钥', 0, actions);
            return;
        }

        this.isProcessing = true;
        this.processingStartTime = Date.now();
        this.showLoading();
        
        Utils.announceToScreenReader('开始AI处理，请稍候');

        try {
            // Step 1: Upload image
            this.updateProgress(10, '正在上传图片...', CONFIG.API.ESTIMATED_TIMES.UPLOAD);
            const imageUrl = await this.apiClient.uploadImage(this.currentImage.file);
            
            this.updateProgress(30, '图片上传成功，开始AI处理...');
            
            // Step 2: Process with AI
            this.updateProgress(50, '正在分析面部特征...', CONFIG.API.ESTIMATED_TIMES.PROCESSING);
            const resultUrl = await this.apiClient.changeExpression(imageUrl, CONFIG.EXPRESSIONS.SMILE, {
                intensity: 0.8,
                preserveIdentity: true,
                enhanceQuality: true
            });
            
            this.updateProgress(80, '正在生成微笑效果...');
            
            // Step 3: Store result
            this.resultImage = resultUrl;
            
            this.updateProgress(100, '处理完成！');
            
            // Calculate actual processing time
            const processingTime = (Date.now() - this.processingStartTime) / 1000;
            
            // Show results
            await Utils.sleep(500);
            this.showResults();
            
            this.toast.success(`AI 微笑生成成功！处理用时: ${Utils.formatTime(processingTime)}`);
            Utils.announceToScreenReader('AI处理完成，可以查看结果');

        } catch (error) {
            console.error('Processing error:', error);
            
            let errorMessage = '处理失败，请重试。';
            const actions = [];
            
            if (error instanceof APIError) {
                switch (error.status) {
                    case 401:
                        errorMessage = 'API 密钥无效，请检查您的密钥。';
                        actions.push({
                            id: 'reset-key',
                            label: '重新设置',
                            callback: () => this.setApiKey('')
                        });
                        break;
                    case 429:
                        errorMessage = '请求过于频繁，请稍后再试。';
                        break;
                    case 413:
                        errorMessage = '图片文件过大，请上传较小的图片。';
                        break;
                    default:
                        errorMessage = `API 错误: ${error.message}`;
                }
            } else if (error.name === 'AbortError') {
                errorMessage = '请求超时，请检查网络连接。';
            }
            
            this.toast.error(errorMessage, 8000, actions);
            Utils.announceToScreenReader('处理失败: ' + errorMessage);
            
            // Show demo result as fallback
            this.showDemoResult();
            
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    updateProgress(progress, text, estimatedTime = null) {
        if (this.progressManager) {
            this.progressManager.setProgress(progress, text, estimatedTime);
        }
        
        // Update processing steps
        this.updateProcessingSteps(progress);
    }

    updateProcessingSteps(progress) {
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            const threshold = (index + 1) * (100 / steps.length);
            if (progress >= threshold) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (progress >= threshold - (100 / steps.length)) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }

    showLoading() {
        if (this.loadingState) {
            this.loadingState.style.display = 'block';
            this.loadingState.classList.add('animate-in');
        }
        if (this.processBtn) {
            this.processBtn.style.display = 'none';
        }
        
        // Start progress animation
        if (this.progressManager) {
            this.progressManager.reset();
        }
        
        // Start loading tips rotation
        this.startLoadingTips();
    }

    hideLoading() {
        if (this.loadingState) {
            this.loadingState.classList.add('animate-out');
            setTimeout(() => {
                this.loadingState.style.display = 'none';
                this.loadingState.classList.remove('animate-out', 'animate-in');
            }, CONFIG.UI.ANIMATION_DURATION);
        }
        if (this.processBtn) {
            this.processBtn.style.display = 'block';
        }
        
        this.stopLoadingTips();
    }

    startLoadingTips() {
        const tips = [
            '正在分析面部特征...',
            '正在应用AI表情增强...',
            '正在优化图像质量...',
            '正在生成自然微笑效果...',
            '正在进行最终处理...',
            '使用AILabTools先进技术...',
            '保持面部身份的同时增强表情...',
            '正在创建完美的微笑效果...'
        ];

        let currentTip = 0;
        this.loadingTipsInterval = setInterval(() => {
            if (!this.isProcessing) {
                this.stopLoadingTips();
                return;
            }
            
            currentTip = (currentTip + 1) % tips.length;
        }, CONFIG.UI.LOADING_TIPS_INTERVAL);
    }

    stopLoadingTips() {
        if (this.loadingTipsInterval) {
            clearInterval(this.loadingTipsInterval);
            this.loadingTipsInterval = null;
        }
    }

    showResults() {
        if (!this.currentImage || !this.resultImage) return;

        // Show comparison
        this.showComparison(this.currentImage.dataUrl, this.resultImage);
        
        // Show final result
        this.showFinalResult(this.resultImage);
        
        // Show share section
        if (this.shareSection) {
            this.shareSection.style.display = 'block';
            this.shareSection.classList.add('animate-in');
        }
    }

    showComparison(beforeSrc, afterSrc) {
        if (this.beforeImg && this.afterImg && this.comparisonSection) {
            this.beforeImg.src = beforeSrc;
            this.beforeImg.alt = '原始图片';
            this.afterImg.src = afterSrc;
            this.afterImg.alt = 'AI增强后的图片';
            
            this.comparisonSection.style.display = 'block';
            this.comparisonSection.classList.add('animate-in');
            this.updateComparison();
        }
    }

    updateComparison() {
        if (this.comparisonSlider && this.afterImg) {
            const value = this.comparisonSlider.value;
            this.afterImg.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
            
            // Update ARIA label
            this.comparisonSlider.setAttribute('aria-valuetext', `显示 ${value}% 的处理后图片`);
        }
    }

    showFinalResult(imageSrc) {
        if (this.resultImg && this.resultSection) {
            this.resultImg.src = imageSrc;
            this.resultImg.alt = '最终AI增强结果';
            
            this.resultSection.style.display = 'block';
            this.resultSection.classList.add('animate-in');
            
            // Update download filename
            if (this.currentImage && this.downloadBtn) {
                const nameWithoutExt = this.currentImage.name.replace(/\.[^/.]+$/, '');
                this.downloadBtn.setAttribute('data-filename', `${nameWithoutExt}_smile.jpg`);
            }
        }
    }

    async showDemoResult() {
        if (!this.currentImage) return;
        
        try {
            const demoResult = await this.createDemoImage(this.currentImage.dataUrl);
            this.resultImage = demoResult;
            this.showResults();
            
            const actions = [{
                id: 'set-api-key',
                label: '设置API密钥',
                callback: () => {
                    const key = prompt('请输入您的 AILabTools API 密钥:');
                    if (key) this.setApiKey(key);
                }
            }];
            
            this.toast.info('显示演示结果。设置API密钥以使用真实的AI处理。', 10000, actions);
        } catch (error) {
            console.error('Failed to create demo result:', error);
        }
    }

    createDemoImage(originalDataUrl) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw original image
                ctx.drawImage(img, 0, 0);
                
                // Add demo overlay
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, img.height - 80, img.width, 80);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('演示模式 - 请配置API密钥', img.width / 2, img.height - 45);
                
                ctx.font = '16px Arial';
                ctx.fillText('Demo Mode - Configure API Key', img.width / 2, img.height - 20);
                
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            
            img.onerror = reject;
            img.src = originalDataUrl;
        });
    }

    hideResults() {
        const sections = [this.comparisonSection, this.resultSection, this.shareSection];
        sections.forEach(section => {
            if (section) {
                section.classList.add('animate-out');
                setTimeout(() => {
                    section.style.display = 'none';
                    section.classList.remove('animate-out', 'animate-in');
                }, CONFIG.UI.ANIMATION_DURATION);
            }
        });
    }

    async downloadResult() {
        if (!this.resultImage) {
            this.toast.error('没有可下载的结果图片。');
            return;
        }

        try {
            const filename = this.downloadBtn?.getAttribute('data-filename') || 'ai_smile_result.jpg';
            
            // Show download progress
            this.toast.info('正在准备下载...');
            
            if (this.resultImage.startsWith('data:')) {
                this.downloadDataUrl(this.resultImage, filename);
            } else {
                const response = await fetch(this.resultImage);
                const blob = await response.blob();
                this.downloadBlob(blob, filename);
            }
            
            this.toast.success('图片下载成功！');
            Utils.announceToScreenReader('图片下载完成');
            
            // Track download event
            this.trackEvent('download', 'success', filename);
            
        } catch (error) {
            console.error('Download failed:', error);
            this.toast.error('下载失败，请重试。');
            Utils.announceToScreenReader('下载失败');
        }
    }

    downloadDataUrl(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    resetForNewImage() {
        this.removeImage();
        this.toast.info('已重置，可以上传新图片了。');
        Utils.announceToScreenReader('已重置，可以上传新图片');
    }

    initializeComparison() {
        if (this.comparisonSlider) {
            this.comparisonSlider.value = 50;
            this.comparisonSlider.setAttribute('aria-valuetext', '显示 50% 的处理后图片');
        }
    }

    async handleShare(e) {
        const platform = e.target.closest('.share-btn')?.dataset.platform;
        if (!platform) return;

        const url = window.location.href;
        const text = 'Check out this amazing AI Smile Generator! 快来试试这个神奇的AI微笑生成器！';

        try {
            switch (platform) {
                case 'facebook':
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
                    this.trackEvent('share', 'facebook');
                    break;
                    
                case 'twitter':
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
                    this.trackEvent('share', 'twitter');
                    break;
                    
                case 'instagram':
                case 'copy':
                    const success = await Utils.copyToClipboard(url);
                    if (success) {
                        this.toast.success(platform === 'instagram' ? '链接已复制！在Instagram中粘贴分享。' : '链接已复制到剪贴板！');
                        Utils.announceToScreenReader('链接已复制到剪贴板');
                        this.trackEvent('share', platform);
                    } else {
                        this.toast.error('复制失败，请手动复制链接。');
                    }
                    break;
                    
                default:
                    this.toast.warning('不支持的分享平台。');
            }
        } catch (error) {
            console.error('Share failed:', error);
            this.toast.error('分享失败，请重试。');
        }
    }

    handleKeyboard(e) {
        // ESC - Reset or close modal
        if (e.key === 'Escape') {
            if (this.zoomManager.modal.classList.contains('active')) {
                this.zoomManager.close();
            } else if (this.isProcessing) {
                this.toast.info('处理中，无法取消。请等待完成。');
            } else {
                this.resetForNewImage();
            }
        }
        
        // Enter - Process image or activate upload area
        if (e.key === 'Enter') {
            if (e.target === this.uploadArea) {
                this.fileInput.click();
            } else if (this.currentImage && !this.isProcessing) {
                this.processImage();
            }
        }
        
        // Space - Download result
        if (e.key === ' ' && this.resultImage && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            this.downloadResult();
        }
    }

    handleBeforeUnload(e) {
        if (this.isProcessing) {
            e.preventDefault();
            e.returnValue = '图片正在处理中，确定要离开吗？';
            return e.returnValue;
        }
    }

    // Analytics and tracking
    trackEvent(category, action, label = '') {
        // Integration with analytics services
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: category,
                event_label: label
            });
        }
        
        console.log(`Event tracked: ${category}/${action}/${label}`);
    }

    // Public API methods
    getStats() {
        return {
            api: this.apiClient.getStats(),
            session: {
                imagesProcessed: this.imagesProcessed || 0,
                sessionStart: this.sessionStart || Date.now(),
                errors: this.errors || 0
            }
        };
    }

    destroy() {
        this.stopLoadingTips();
        
        if (this.progressManager && this.progressManager.animationId) {
            cancelAnimationFrame(this.progressManager.animationId);
        }
        
        // Clear toasts
        this.toast.clear();
        
        // Remove event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('keydown', this.handleKeyboard);
        
        console.log('Enhanced AI Smile Generator destroyed');
    }
}

// Custom Error Classes (same as before)
class APIError extends Error {
    constructor(message, status = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

// File Validator (same as before)
class FileValidator {
    static validate(file) {
        const errors = [];

        if (!CONFIG.FILE.ALLOWED_TYPES.includes(file.type)) {
            errors.push(`不支持的文件类型。请上传 ${CONFIG.FILE.ALLOWED_EXTENSIONS.join(', ')} 格式的图片。`);
        }

        if (file.size > CONFIG.FILE.MAX_SIZE) {
            errors.push(`文件大小超过限制。最大支持 ${Utils.formatFileSize(CONFIG.FILE.MAX_SIZE)}。`);
        }

        if (!file.type.startsWith('image/')) {
            errors.push('请上传有效的图片文件。');
        }

        if (errors.length > 0) {
            throw new ValidationError(errors.join(' '));
        }

        return true;
    }
}

// Initialize application
let smileGenerator;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    try {
        smileGenerator = new EnhancedAISmileGenerator();
        window.smileGenerator = smileGenerator;
        
        console.log('🎭 Enhanced AI Smile Generator loaded successfully!');
        console.log('💡 To set your API key, run: smileGenerator.setApiKey("your-api-key")');
        console.log('📊 To view stats, run: smileGenerator.getStats()');
        
    } catch (error) {
        console.error('Failed to initialize Enhanced AI Smile Generator:', error);
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 500px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <strong>应用初始化失败</strong><br>
            请刷新页面重试，或检查浏览器控制台了解详细错误信息。
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedAISmileGenerator, CONFIG, Utils };
} 