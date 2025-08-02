/**
 * AI Smile Generator - Enhanced JavaScript Implementation (English Version)
 * Features: AILabTools API integration, modern ES6+ syntax, comprehensive error handling
 * Author: AI Smile Generator Team
 * Version: 3.0.0
 */

// Configuration and Constants
const CONFIG = {
    API: {
        BASE_URL: 'https://www.ailabapi.com',
        ENDPOINTS: {
            CHANGE_EXPRESSION: '/api/portrait/effects/emotion-editor'
        },
        TIMEOUT: 60000, // 60 seconds for AI processing
        MAX_RETRIES: 3,
        RETRY_DELAY: 2000, // 2 seconds
        ESTIMATED_TIMES: {
            UPLOAD: 2,
            PROCESSING: 20,
            DOWNLOAD: 1
        }
    },
    
    FILE: {
        MAX_SIZE: 5 * 1024 * 1024, // 5MB as per API requirements
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
        ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png'],
        MAX_RESOLUTION: 4096 // 4096x4096px max
    },
    
    UI: {
        PROGRESS_UPDATE_INTERVAL: 100,
        TOAST_DURATION: 5000,
        LOADING_TIPS_INTERVAL: 2000,
        ANIMATION_DURATION: 300,
        ZOOM_SCALE: 2
    },
    
    // AILabTools Expression Types
    EXPRESSIONS: {
        DIMPLE_SMILE: 10,      // Dimple Smile
        PEAR_DIMPLE_SMILE: 11, // Pear Dimple Smile
        BIG_GRIN: 12,          // Big Grin
        STANDARD_GRIN: 13,     // Standard Grin
        COOL_POSE: 14,         // Cool Pose
        SAD: 15,               // Sad
        FORCED_SMILE: 16,      // Forced Smile
        OPENING_EYES: 100      // Opening eyes
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
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
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

    async resizeImage(file, maxWidth = 2048, maxHeight = 2048, quality = 0.9) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                let { width, height } = img;
                
                // Check if image exceeds API resolution limits
                if (width > CONFIG.FILE.MAX_RESOLUTION || height > CONFIG.FILE.MAX_RESOLUTION) {
                    const scale = CONFIG.FILE.MAX_RESOLUTION / Math.max(width, height);
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                }
                
                // Further resize if still too large
                if (width > maxWidth || height > maxHeight) {
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
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    },

    measurePerformance(name, fn) {
        return async (...args) => {
            const start = performance.now();
            const result = await fn(...args);
            const end = performance.now();
            console.log(`Performance: ${name} took ${(end - start).toFixed(2)}ms`);
            return result;
        };
    },

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

// Enhanced API Client for AILabTools
class AILabToolsClient {
    constructor() {
        this.apiKey = this.getApiKey();
        this.baseURL = CONFIG.API.BASE_URL;
        this.requestCount = 0;
        this.errorCount = 0;
    }

    getApiKey() {
        // Priority 1: Cloudflare Pages environment variable (build-time injection)
        if (typeof window !== 'undefined' && window.AILABTOOLS_API_KEY) {
            return window.AILABTOOLS_API_KEY;
        }
        
        // Priority 2: Global variable (Cloudflare Pages)
        if (typeof AILABTOOLS_API_KEY !== 'undefined') {
            return AILABTOOLS_API_KEY;
        }
        
        // Priority 3: Process environment (Node.js environments)
        if (typeof process !== 'undefined' && process.env && process.env.AILABTOOLS_API_KEY) {
            return process.env.AILABTOOLS_API_KEY;
        }
        
        // Priority 4: Local storage (temporary, for testing only)
        const stored = localStorage.getItem('ailabtools_api_key');
        if (stored) return stored;
        
        console.log('No API key found. Available methods:');
        console.log('1. Set via console: smileGenerator.setApiKey("your-key")');
        console.log('2. Check Cloudflare Pages environment variables');
        
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
                    'ailabapi-api-key': this.apiKey, // AILabTools uses this header format
                    'X-Request-ID': Utils.generateId(),
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                this.errorCount++;
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error_msg) {
                        errorMessage = errorData.error_msg;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // Use default error message
                }
                
                throw new APIError(errorMessage, response.status);
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

    /**
     * Change facial expression using AILabTools API
     * @param {File} imageFile - The image file to process
     * @param {number} expressionType - Expression type (10-16, 100)
     * @returns {Promise<string>} - Base64 encoded result image
     */
    async changeExpression(imageFile, expressionType = CONFIG.EXPRESSIONS.DIMPLE_SMILE) {
        if (!this.apiKey) {
            throw new APIError('API key is required. Please set your AILabTools API key.');
        }

        // Validate image file
        if (imageFile.size > CONFIG.FILE.MAX_SIZE) {
            throw new ValidationError(`Image size exceeds ${Utils.formatFileSize(CONFIG.FILE.MAX_SIZE)} limit.`);
        }

        if (!CONFIG.FILE.ALLOWED_TYPES.includes(imageFile.type)) {
            throw new ValidationError(`Unsupported image format. Please use ${CONFIG.FILE.ALLOWED_EXTENSIONS.join(', ')}.`);
        }

        // Create FormData for multipart/form-data request
        const formData = new FormData();
        formData.append('image_target', imageFile);
        formData.append('service_choice', expressionType.toString());

        console.log(`Making API request to: ${this.baseURL}${CONFIG.API.ENDPOINTS.CHANGE_EXPRESSION}`);
        console.log(`Expression type: ${expressionType}`);
        console.log(`Image size: ${Utils.formatFileSize(imageFile.size)}`);

        const response = await this.makeRequest(
            `${this.baseURL}${CONFIG.API.ENDPOINTS.CHANGE_EXPRESSION}`,
            {
                method: 'POST',
                body: formData
                // Note: Don't set Content-Type header for FormData, browser will set it automatically
            }
        );

        const responseData = await response.json();
        console.log('API Response:', responseData);

        // Handle response according to AILabTools format
        if (responseData.error_code !== 0) {
            throw new APIError(responseData.error_msg || 'API processing failed');
        }

        // Extract image data from response
        if (responseData.data && responseData.data.image) {
            const base64Image = responseData.data.image;
            
            // Ensure the base64 string has proper data URL format
            if (base64Image.startsWith('data:image/')) {
                return base64Image;
            } else {
                return `data:image/jpeg;base64,${base64Image}`;
            }
        } else {
            throw new APIError('No image data found in API response');
        }
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
            this.timeElement.innerHTML = `<i class="material-icons">schedule</i>Estimated remaining: ${Utils.formatTime(remaining)}`;
        } else {
            this.timeElement.innerHTML = `<i class="material-icons">check_circle</i>Almost done...`;
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
            <button class="zoom-close" aria-label="Close zoom view">
                <i class="material-icons">close</i>
            </button>
            <img class="zoom-image" alt="Zoomed view">
            <div class="zoom-controls">
                <button class="zoom-btn zoom-in" aria-label="Zoom in">
                    <i class="material-icons">zoom_in</i>
                </button>
                <button class="zoom-btn zoom-out" aria-label="Zoom out">
                    <i class="material-icons">zoom_out</i>
                </button>
                <button class="zoom-btn zoom-reset" aria-label="Reset zoom">
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

        document.addEventListener('keydown', (e) => {
            if (this.modal.classList.contains('active')) {
                if (e.key === 'Escape') this.close();
                if (e.key === '+' || e.key === '=') zoomInBtn.click();
                if (e.key === '-') zoomOutBtn.click();
                if (e.key === '0') resetBtn.click();
            }
        });

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
        
        this.modal.querySelector('.zoom-close').focus();
        Utils.announceToScreenReader('Image zoom view opened');
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        Utils.announceToScreenReader('Image zoom view closed');
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
        if (this.toasts.size >= this.maxToasts) {
            const oldestId = this.toasts.keys().next().value;
            this.dismiss(oldestId);
        }

        const id = Utils.generateId();
        const toast = this.createToast(id, message, type, actions);
        
        this.container.appendChild(toast);
        this.toasts.set(id, { element: toast, timer: null });

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        if (duration > 0) {
            const timer = setTimeout(() => this.dismiss(id), duration);
            this.toasts.get(id).timer = timer;
        }

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
                <button class="toast-close" aria-label="Close notification">
                    <i class="material-icons">close</i>
                </button>
            </div>
            ${actionsHtml}
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(id));

        actions.forEach(action => {
            const actionBtn = toast.querySelector(`[data-action="${action.id}"]`);
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    action.callback();
                    this.dismiss(id);
                });
            }
        });

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
        this.apiClient = new AILabToolsClient();
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
            // 基本检查
            if (!document || !window) {
                throw new Error('Browser environment not available');
            }
            
            // 分步初始化，每步都有错误处理
            try {
                this.initializeElements();
            } catch (error) {
                console.warn('Element initialization warning:', error);
                // 继续执行，不要因为元素问题而完全失败
            }
            
            try {
                this.bindEvents();
            } catch (error) {
                console.warn('Event binding warning:', error);
            }
            
            try {
                this.checkApiKey();
            } catch (error) {
                console.warn('API key check warning:', error);
            }
            
            try {
                this.initializeComparison();
            } catch (error) {
                console.warn('Comparison initialization warning:', error);
            }
            
            try {
                this.setupAccessibility();
            } catch (error) {
                console.warn('Accessibility setup warning:', error);
            }
            
            try {
                this.setupPerformanceMonitoring();
            } catch (error) {
                console.warn('Performance monitoring warning:', error);
            }
            
            console.log('Enhanced AI Smile Generator initialized successfully');
            
            // 尝试通知屏幕阅读器，但不让错误阻止初始化
            try {
                Utils.announceToScreenReader('AI Smile Generator is ready');
            } catch (error) {
                console.warn('Screen reader announcement failed:', error);
            }
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            
            // 创建简单的错误提示，不依赖复杂的UI组件
            const errorMessage = document.createElement('div');
            errorMessage.style.cssText = `
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
            `;
            errorMessage.innerHTML = `
                <strong>Application initialization failed</strong><br>
                Please refresh the page and try again<br>
                <small>Error: ${error.message}</small>
            `;
            document.body.appendChild(errorMessage);
            
            // 5秒后自动移除
            setTimeout(() => {
                if (errorMessage.parentNode) {
                    errorMessage.parentNode.removeChild(errorMessage);
                }
            }, 5000);
            
            throw error; // 重新抛出错误，让上层处理
        }
    }

    initializeElements() {
        // 使用try-catch包装每个元素获取，避免因为缺少元素而失败
        try {
            this.uploadArea = document.getElementById('uploadArea');
        } catch (error) {
            console.warn('Upload area not found:', error);
            this.uploadArea = null;
        }
        
        try {
            this.fileInput = document.getElementById('fileInput');
        } catch (error) {
            console.warn('File input not found:', error);
            this.fileInput = null;
        }
        
        try {
            this.imagePreview = document.getElementById('imagePreview');
        } catch (error) {
            console.warn('Image preview not found:', error);
            this.imagePreview = null;
        }
        
        try {
            this.previewImg = document.getElementById('previewImg');
        } catch (error) {
            console.warn('Preview image not found:', error);
            this.previewImg = null;
        }
        
        try {
            this.removeBtn = document.getElementById('removeBtn');
        } catch (error) {
            console.warn('Remove button not found:', error);
            this.removeBtn = null;
        }
        
        try {
            this.imageInfo = document.getElementById('imageInfo');
        } catch (error) {
            console.warn('Image info not found:', error);
            this.imageInfo = null;
        }

        try {
            this.processBtn = document.getElementById('processBtn');
        } catch (error) {
            console.warn('Process button not found:', error);
            this.processBtn = null;
        }
        
        try {
            this.loadingState = document.getElementById('loadingState');
        } catch (error) {
            console.warn('Loading state not found:', error);
            this.loadingState = null;
        }
        
        try {
            this.progressFill = document.getElementById('progressFill');
        } catch (error) {
            console.warn('Progress fill not found:', error);
            this.progressFill = null;
        }
        
        try {
            this.loadingTip = document.getElementById('loadingTip');
        } catch (error) {
            console.warn('Loading tip not found:', error);
            this.loadingTip = null;
        }
        
        try {
            this.timeEstimate = document.getElementById('timeEstimate');
        } catch (error) {
            console.warn('Time estimate not found:', error);
            this.timeEstimate = null;
        }

        try {
            this.comparisonSection = document.getElementById('comparisonSection');
        } catch (error) {
            console.warn('Comparison section not found:', error);
            this.comparisonSection = null;
        }
        
        try {
            this.beforeImg = document.getElementById('beforeImg');
        } catch (error) {
            console.warn('Before image not found:', error);
            this.beforeImg = null;
        }
        
        try {
            this.afterImg = document.getElementById('afterImg');
        } catch (error) {
            console.warn('After image not found:', error);
            this.afterImg = null;
        }
        
        try {
            this.comparisonSlider = document.getElementById('comparisonSlider');
        } catch (error) {
            console.warn('Comparison slider not found:', error);
            this.comparisonSlider = null;
        }
        
        try {
            this.resultSection = document.getElementById('resultSection');
        } catch (error) {
            console.warn('Result section not found:', error);
            this.resultSection = null;
        }
        
        try {
            this.resultImg = document.getElementById('resultImg');
        } catch (error) {
            console.warn('Result image not found:', error);
            this.resultImg = null;
        }
        
        try {
            this.downloadBtn = document.getElementById('downloadBtn');
        } catch (error) {
            console.warn('Download button not found:', error);
            this.downloadBtn = null;
        }
        
        try {
            this.newImageBtn = document.getElementById('newImageBtn');
        } catch (error) {
            console.warn('New image button not found:', error);
            this.newImageBtn = null;
        }

        try {
            this.shareSection = document.getElementById('shareSection');
        } catch (error) {
            console.warn('Share section not found:', error);
            this.shareSection = null;
        }
        
        try {
            this.shareButtons = document.querySelectorAll('.share-btn');
        } catch (error) {
            console.warn('Share buttons not found:', error);
            this.shareButtons = [];
        }

        // Initialize progress manager only if required elements exist
        if (this.progressFill && this.loadingTip) {
            try {
                this.progressManager = new ProgressManager(
                    this.progressFill, 
                    this.loadingTip, 
                    this.timeEstimate
                );
            } catch (error) {
                console.warn('Progress manager initialization failed:', error);
                this.progressManager = null;
            }
        }

        try {
            this.addZoomButtons();
        } catch (error) {
            console.warn('Zoom buttons addition failed:', error);
        }

        // 检查最小必需元素，但不强制要求所有元素都存在
        const requiredElements = ['uploadArea', 'fileInput'];
        const missingElements = requiredElements.filter(id => !this[id]);
        
        if (missingElements.length > 0) {
            console.warn('Some required elements are missing:', missingElements);
            // 不抛出错误，让应用继续运行
        }
    }

    addZoomButtons() {
        if (this.previewImg) {
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '<i class="material-icons">zoom_in</i>';
            zoomBtn.setAttribute('aria-label', 'Zoom in to view image');
            zoomBtn.addEventListener('click', () => {
                this.zoomManager.open(this.previewImg.src, 'Uploaded image');
            });
            this.previewImg.parentNode.appendChild(zoomBtn);
        }

        if (this.resultImg) {
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '<i class="material-icons">zoom_in</i>';
            zoomBtn.setAttribute('aria-label', 'Zoom in to view result');
            zoomBtn.addEventListener('click', () => {
                this.zoomManager.open(this.resultImg.src, 'AI-enhanced image');
            });
            this.resultImg.parentNode.appendChild(zoomBtn);
        }
    }

    bindEvents() {
        try {
            if (this.uploadArea && this.fileInput) {
                // Detect mobile device
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                
                if (isMobile) {
                    // Mobile device special handling
                    try {
                        this.fileInput.addEventListener('click', (e) => {
                            e.stopPropagation();
                            Utils.announceToScreenReader('File selection dialog opened');
                        });
                    } catch (error) {
                        console.warn('File input click event binding failed:', error);
                    }
                    
                    // iOS Safari special handling
                    if (isIOS) {
                        // Add touch event handling for iOS
                        try {
                            this.uploadArea.addEventListener('touchstart', (e) => {
                                e.preventDefault();
                                this.handleMobileFileUpload();
                            });
                        } catch (error) {
                            console.warn('iOS touchstart event binding failed:', error);
                        }
                        
                        // Prevent double-tap zoom on iOS
                        try {
                            this.uploadArea.addEventListener('touchend', (e) => {
                                e.preventDefault();
                            });
                        } catch (error) {
                            console.warn('iOS touchend event binding failed:', error);
                        }
                        
                        // Add click event as backup
                        try {
                            this.uploadArea.addEventListener('click', (e) => {
                                e.preventDefault();
                                this.handleMobileFileUpload();
                            });
                        } catch (error) {
                            console.warn('iOS click event binding failed:', error);
                        }
                        
                        // Add long press event as extra backup
                        try {
                            this.uploadArea.addEventListener('contextmenu', (e) => {
                                e.preventDefault();
                                this.handleMobileFileUploadFallback();
                            });
                        } catch (error) {
                            console.warn('iOS contextmenu event binding failed:', error);
                        }
                    } else {
                        // Other mobile devices
                        try {
                            this.uploadArea.addEventListener('click', (e) => {
                                e.preventDefault();
                                this.handleMobileFileUpload();
                            });
                        } catch (error) {
                            console.warn('Mobile click event binding failed:', error);
                        }
                        
                        // Add touch event
                        try {
                            this.uploadArea.addEventListener('touchstart', (e) => {
                                e.preventDefault();
                                this.handleMobileFileUpload();
                            });
                        } catch (error) {
                            console.warn('Mobile touchstart event binding failed:', error);
                        }
                    }
                } else {
                    // Desktop behavior
                    try {
                        this.uploadArea.addEventListener('click', () => {
                            this.fileInput.click();
                            Utils.announceToScreenReader('File selection dialog opened');
                        });
                    } catch (error) {
                        console.warn('Desktop click event binding failed:', error);
                    }
                }
                
                try {
                    this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
                } catch (error) {
                    console.warn('Drag over event binding failed:', error);
                }
                
                try {
                    this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
                } catch (error) {
                    console.warn('Drop event binding failed:', error);
                }
                
                try {
                    this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
                } catch (error) {
                    console.warn('Drag leave event binding failed:', error);
                }
                
                try {
                    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
                } catch (error) {
                    console.warn('File input change event binding failed:', error);
                }
            }
        } catch (error) {
            console.warn('Main event binding failed:', error);
        }

        try {
            if (this.removeBtn) {
                this.removeBtn.addEventListener('click', this.removeImage.bind(this));
            }
        } catch (error) {
            console.warn('Remove button event binding failed:', error);
        }

        try {
            if (this.processBtn) {
                this.processBtn.addEventListener('click', this.processImage.bind(this));
            }
        } catch (error) {
            console.warn('Process button event binding failed:', error);
        }

        try {
            if (this.downloadBtn) {
                this.downloadBtn.addEventListener('click', this.downloadResult.bind(this));
            }
        } catch (error) {
            console.warn('Download button event binding failed:', error);
        }

        try {
            if (this.newImageBtn) {
                this.newImageBtn.addEventListener('click', this.resetForNewImage.bind(this));
            }
        } catch (error) {
            console.warn('New image button event binding failed:', error);
        }

        try {
            if (this.comparisonSlider) {
                this.comparisonSlider.addEventListener('input', 
                    Utils.throttle(this.updateComparison.bind(this), 16)
                );
            }
        } catch (error) {
            console.warn('Comparison slider event binding failed:', error);
        }

        try {
            this.shareButtons.forEach(btn => {
                btn.addEventListener('click', this.handleShare.bind(this));
            });
        } catch (error) {
            console.warn('Share buttons event binding failed:', error);
        }

        try {
            document.addEventListener('keydown', this.handleKeyboard.bind(this));
        } catch (error) {
            console.warn('Keyboard event binding failed:', error);
        }
        
        try {
            window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        } catch (error) {
            console.warn('Before unload event binding failed:', error);
        }
        
        try {
            window.addEventListener('online', () => {
                this.toast.success('Network connection restored');
            });
        } catch (error) {
            console.warn('Online event binding failed:', error);
        }
        
        try {
            window.addEventListener('offline', () => {
                this.toast.warning('Network connection lost. Some features may not be available');
            });
        } catch (error) {
            console.warn('Offline event binding failed:', error);
        }
    }

    setupAccessibility() {
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
        if ('web-vital' in window) {
            console.log('Performance monitoring enabled');
        }

        this.apiClient.makeRequest = Utils.measurePerformance(
            'API Request', 
            this.apiClient.makeRequest.bind(this.apiClient)
        );
    }

    checkApiKey() {
        if (!this.apiClient.apiKey) {
            const actions = [{
                id: 'learn-more',
                label: 'Learn More',
                callback: () => {
                    window.open('https://ailabapi.com', '_blank');
                }
            }];
            
            this.toast.warning(
                'Please set your AILabTools API key. Run in browser console: smileGenerator.setApiKey("your-api-key")',
                0,
                actions
            );
        }
    }

    setApiKey(key) {
        this.apiClient.setApiKey(key);
        if (key) {
            this.toast.success('API key set successfully! You can now use AI features.');
            Utils.announceToScreenReader('API key has been set, ready to use');
        } else {
            this.toast.info('API key has been cleared.');
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.classList.add('drag-over');
        Utils.announceToScreenReader('File is hovering over upload area');
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
            Utils.announceToScreenReader('File dropped, processing...');
            this.handleFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    // Mobile file upload handler
    handleMobileFileUpload() {
        try {
            console.log('Mobile file upload initiated');
            
            // Create new file input element
            const newFileInput = document.createElement('input');
            newFileInput.type = 'file';
            newFileInput.accept = 'image/jpeg,image/jpg,image/png,image/webp';
            newFileInput.capture = 'environment';
            newFileInput.multiple = false;
            
            // Set styles
            newFileInput.style.position = 'fixed';
            newFileInput.style.top = '0';
            newFileInput.style.left = '0';
            newFileInput.style.width = '100%';
            newFileInput.style.height = '100%';
            newFileInput.style.opacity = '0';
            newFileInput.style.zIndex = '9999';
            
            // Add to page
            document.body.appendChild(newFileInput);
            
            // Listen for file selection
            newFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    console.log('File selected:', file.name, file.size, file.type);
                    this.handleFile(file);
                } else {
                    console.log('No file selected');
                    this.toast.info('No file selected, please try again');
                }
                // Clean up temporary element
                document.body.removeChild(newFileInput);
            });
            
            // Listen for errors
            newFileInput.addEventListener('error', (e) => {
                console.error('File input error:', e);
                this.toast.error('File selection error, please try again');
                document.body.removeChild(newFileInput);
            });
            
            // Trigger file selection
            newFileInput.click();
            
        } catch (error) {
            console.error('Mobile file upload error:', error);
            this.toast.error('Mobile file upload failed, please try again');
            
            // Fallback: use original file input
            console.log('Falling back to original file input');
            if (this.fileInput) {
                this.fileInput.click();
            }
        }
    }
    
    // Fallback mobile file upload method
    handleMobileFileUploadFallback() {
        if (this.fileInput) {
            // Ensure original file input is visible on mobile
            this.fileInput.style.position = 'relative';
            this.fileInput.style.opacity = '1';
            this.fileInput.style.width = '100%';
            this.fileInput.style.height = '100%';
            this.fileInput.style.zIndex = '10';
            this.fileInput.style.pointerEvents = 'auto';
            
            // Trigger click
            this.fileInput.click();
        }
    }

    async handleFile(file) {
        try {
            FileValidator.validate(file);

            this.toast.info('Processing uploaded file...');

            let processedFile = file;
            if (file.size > CONFIG.FILE.MAX_SIZE * 0.8) { // Process if > 80% of limit
                this.toast.info('Optimizing image for better processing...');
                processedFile = await Utils.resizeImage(file);
            }

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
                ` (Optimized: ${Utils.formatFileSize(file.size)} → ${Utils.formatFileSize(processedFile.size)})` : '';
            
            this.toast.success(`Image uploaded successfully!${sizeReduction}`);
            Utils.announceToScreenReader('Image uploaded successfully, ready to process');

        } catch (error) {
            if (error instanceof ValidationError) {
                this.toast.error(error.message);
            } else {
                console.error('File handling error:', error);
                this.toast.error('File processing failed. Please try again.');
            }
            Utils.announceToScreenReader('File upload failed');
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

        if (this.previewImg) {
            this.previewImg.src = this.currentImage.dataUrl;
            this.previewImg.alt = `Preview: ${this.currentImage.name}`;
        }

        if (this.imageInfo) {
            const sizeInfo = this.currentImage.originalSize !== this.currentImage.size ?
                `${Utils.formatFileSize(this.currentImage.size)} (Original: ${Utils.formatFileSize(this.currentImage.originalSize)})` :
                Utils.formatFileSize(this.currentImage.size);
            
            this.imageInfo.innerHTML = `
                <i class="material-icons">image</i>
                ${this.currentImage.name} (${sizeInfo})
            `;
        }

        if (this.imagePreview) {
            this.imagePreview.style.display = 'block';
            this.imagePreview.classList.add('animate-in');
        }

        if (this.processBtn) {
            this.processBtn.disabled = false;
            this.processBtn.style.display = 'block';
            this.processBtn.classList.add('animate-in');
        }

        if (this.uploadArea) {
            this.uploadArea.style.display = 'none';
        }
    }

    removeImage() {
        this.currentImage = null;
        this.resultImage = null;

        if (this.fileInput) {
            this.fileInput.value = '';
        }

        if (this.imagePreview) {
            this.imagePreview.classList.add('animate-out');
            setTimeout(() => {
                this.imagePreview.style.display = 'none';
                this.imagePreview.classList.remove('animate-out', 'animate-in');
            }, CONFIG.UI.ANIMATION_DURATION);
        }

        if (this.uploadArea) {
            setTimeout(() => {
                this.uploadArea.style.display = 'block';
            }, CONFIG.UI.ANIMATION_DURATION / 2);
        }

        this.hideResults();

        if (this.processBtn) {
            this.processBtn.disabled = true;
            this.processBtn.style.display = 'none';
            this.processBtn.classList.remove('animate-in');
        }

        this.toast.info('Image removed.');
        Utils.announceToScreenReader('Image removed, you can upload a new image');
    }

    async processImage() {
        if (!this.currentImage || this.isProcessing) return;

        if (!this.apiClient.apiKey) {
            const actions = [{
                id: 'set-key',
                label: 'Set Key',
                callback: () => {
                    const key = prompt('Please enter your AILabTools API key:');
                    if (key) this.setApiKey(key);
                }
            }];
            
            this.toast.error('Please set API key first', 0, actions);
            return;
        }

        this.isProcessing = true;
        this.processingStartTime = Date.now();
        this.showLoading();
        
        Utils.announceToScreenReader('Starting AI processing, please wait');

        try {
            this.updateProgress(10, 'Preparing image for AI processing...', CONFIG.API.ESTIMATED_TIMES.PROCESSING);
            
            // Use Dimple Smile (10) as default expression
            this.updateProgress(30, 'Sending to AILabTools API...');
            
            this.updateProgress(50, 'AI is analyzing facial features...');
            
            const resultBase64 = await this.apiClient.changeExpression(
                this.currentImage.file, 
                CONFIG.EXPRESSIONS.DIMPLE_SMILE
            );
            
            this.updateProgress(80, 'Generating natural smile effect...');
            
            this.resultImage = resultBase64;
            this.updateProgress(100, 'Processing complete!');
            
            const processingTime = (Date.now() - this.processingStartTime) / 1000;
            
            await Utils.sleep(500);
            this.showResults();
            
            this.toast.success(`AI smile generation successful! Processing time: ${Utils.formatTime(processingTime)}`);
            Utils.announceToScreenReader('AI processing complete, you can view the results');

        } catch (error) {
            console.error('Processing error:', error);
            
            let errorMessage = 'Processing failed. Please try again.';
            const actions = [];
            
            if (error instanceof APIError) {
                switch (error.status) {
                    case 401:
                        errorMessage = 'Invalid API key. Please check your AILabTools API key.';
                        actions.push({
                            id: 'reset-key',
                            label: 'Reset Key',
                            callback: () => this.setApiKey('')
                        });
                        break;
                    case 429:
                        errorMessage = 'Too many requests. Please try again later.';
                        break;
                    case 413:
                        errorMessage = 'Image file too large. Please upload a smaller image (max 5MB).';
                        break;
                    default:
                        errorMessage = error.message || `API error: ${error.message}`;
                }
            } else if (error instanceof ValidationError) {
                errorMessage = error.message;
            } else if (error.name === 'AbortError') {
                errorMessage = 'Request timeout. Please check your network connection.';
            }
            
            this.toast.error(errorMessage, 8000, actions);
            Utils.announceToScreenReader('Processing failed: ' + errorMessage);
            
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
        
        if (this.progressManager) {
            this.progressManager.reset();
        }
        
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
            'Analyzing facial features and key points...',
            'Applying AILabTools smile generation...',
            'Preserving facial identity and characteristics...',
            'Generating natural dimple smile effect...',
            'Optimizing image quality and details...',
            'Using advanced AI facial expression technology...',
            'Creating seamless smile enhancement...',
            'Finalizing your perfect smile...'
        ];

        let currentTip = 0;
        this.loadingTipsInterval = setInterval(() => {
            if (!this.isProcessing) {
                this.stopLoadingTips();
                return;
            }
            
            if (this.loadingTip) {
                this.loadingTip.innerHTML = `<i class="material-icons">autorenew</i>${tips[currentTip]}`;
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

        this.showComparison(this.currentImage.dataUrl, this.resultImage);
        this.showFinalResult(this.resultImage);
        
        if (this.shareSection) {
            this.shareSection.style.display = 'block';
            this.shareSection.classList.add('animate-in');
        }
    }

    showComparison(beforeSrc, afterSrc) {
        if (this.beforeImg && this.afterImg && this.comparisonSection) {
            this.beforeImg.src = beforeSrc;
            this.beforeImg.alt = 'Original image';
            this.afterImg.src = afterSrc;
            this.afterImg.alt = 'AI-enhanced image with smile';
            
            this.comparisonSection.style.display = 'block';
            this.comparisonSection.classList.add('animate-in');
            this.updateComparison();
        }
    }

    updateComparison() {
        if (this.comparisonSlider && this.afterImg) {
            const value = this.comparisonSlider.value;
            this.afterImg.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
            
            this.comparisonSlider.setAttribute('aria-valuetext', `Showing ${value}% of processed image`);
        }
    }

    showFinalResult(imageSrc) {
        if (this.resultImg && this.resultSection) {
            this.resultImg.src = imageSrc;
            this.resultImg.alt = 'Final AI-enhanced result with natural smile';
            
            this.resultSection.style.display = 'block';
            this.resultSection.classList.add('animate-in');
            
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
                label: 'Set API Key',
                callback: () => {
                    const key = prompt('Please enter your AILabTools API key:');
                    if (key) this.setApiKey(key);
                }
            }];
            
            this.toast.info('Showing demo result. Set API key to use real AI processing.', 10000, actions);
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
                
                ctx.drawImage(img, 0, 0);
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, img.height - 80, img.width, 80);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Demo Mode - Please Configure API Key', img.width / 2, img.height - 45);
                
                ctx.font = '16px Arial';
                ctx.fillText('Set your AILabTools API key to use real AI processing', img.width / 2, img.height - 20);
                
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
            this.toast.error('No result image available for download.');
            return;
        }

        try {
            const filename = this.downloadBtn?.getAttribute('data-filename') || 'ai_smile_result.jpg';
            
            this.toast.info('Preparing download...');
            
            // Convert base64 to blob for download
            if (this.resultImage.startsWith('data:')) {
                this.downloadDataUrl(this.resultImage, filename);
            } else {
                const response = await fetch(this.resultImage);
                const blob = await response.blob();
                this.downloadBlob(blob, filename);
            }
            
            this.toast.success('Image downloaded successfully!');
            Utils.announceToScreenReader('Image download completed');
            
            this.trackEvent('download', 'success', filename);
            
        } catch (error) {
            console.error('Download failed:', error);
            this.toast.error('Download failed. Please try again.');
            Utils.announceToScreenReader('Download failed');
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
        this.toast.info('Reset complete. You can upload a new image.');
        Utils.announceToScreenReader('Reset complete, you can upload a new image');
    }

    initializeComparison() {
        if (this.comparisonSlider) {
            this.comparisonSlider.value = 50;
            this.comparisonSlider.setAttribute('aria-valuetext', 'Showing 50% of processed image');
        }
    }

    async handleShare(e) {
        const platform = e.target.closest('.share-btn')?.dataset.platform;
        if (!platform) return;

        const url = window.location.href;
        const text = 'Check out this amazing AI Smile Generator! Transform any photo with AI-powered smile generation.';

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
                        this.toast.success(platform === 'instagram' ? 'Link copied! Paste to share on Instagram.' : 'Link copied to clipboard!');
                        Utils.announceToScreenReader('Link copied to clipboard');
                        this.trackEvent('share', platform);
                    } else {
                        this.toast.error('Copy failed. Please manually copy the link.');
                    }
                    break;
                    
                default:
                    this.toast.warning('Unsupported sharing platform.');
            }
        } catch (error) {
            console.error('Share failed:', error);
            this.toast.error('Sharing failed. Please try again.');
        }
    }

    handleKeyboard(e) {
        if (e.key === 'Escape') {
            if (this.zoomManager.modal.classList.contains('active')) {
                this.zoomManager.close();
            } else if (this.isProcessing) {
                this.toast.info('Processing in progress, cannot cancel. Please wait for completion.');
            } else {
                this.resetForNewImage();
            }
        }
        
        if (e.key === 'Enter') {
            if (e.target === this.uploadArea) {
                this.fileInput.click();
            } else if (this.currentImage && !this.isProcessing) {
                this.processImage();
            }
        }
        
        if (e.key === ' ' && this.resultImage && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            this.downloadResult();
        }
    }

    handleBeforeUnload(e) {
        if (this.isProcessing) {
            e.preventDefault();
            e.returnValue = 'Image is being processed. Are you sure you want to leave?';
            return e.returnValue;
        }
    }

    trackEvent(category, action, label = '') {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: category,
                event_label: label
            });
        }
        
        console.log(`Event tracked: ${category}/${action}/${label}`);
    }

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
        
        this.toast.clear();
        
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('keydown', this.handleKeyboard);
        
        console.log('Enhanced AI Smile Generator destroyed');
    }
}

// Custom Error Classes
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

// File Validator
class FileValidator {
    static validate(file) {
        const errors = [];

        if (!CONFIG.FILE.ALLOWED_TYPES.includes(file.type)) {
            errors.push(`Unsupported file type. Please upload ${CONFIG.FILE.ALLOWED_EXTENSIONS.join(', ')} format images.`);
        }

        if (file.size > CONFIG.FILE.MAX_SIZE) {
            errors.push(`File size exceeds limit. Maximum supported size is ${Utils.formatFileSize(CONFIG.FILE.MAX_SIZE)}.`);
        }

        if (!file.type.startsWith('image/')) {
            errors.push('Please upload a valid image file.');
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
        // Check basic browser support
        if (typeof window === 'undefined') {
            throw new Error('Window object not available');
        }
        
        // Check necessary DOM API
        if (typeof document === 'undefined') {
            throw new Error('Document object not available');
        }
        
        // Check file API support
        if (typeof FileReader === 'undefined') {
            console.warn('FileReader not supported, some features may not work');
        }
        
        // Check Fetch API support
        if (typeof fetch === 'undefined') {
            console.warn('Fetch API not supported, API calls may not work');
        }
        
        // Create application instance
        smileGenerator = new EnhancedAISmileGenerator();
        window.smileGenerator = smileGenerator;
        
        console.log('🎭 Enhanced AI Smile Generator loaded successfully!');
        console.log('💡 To set your API key, run: smileGenerator.setApiKey("your-api-key")');
        console.log('📊 To view stats, run: smileGenerator.getStats()');
        console.log('🔧 Available expressions:', CONFIG.EXPRESSIONS);
        
    } catch (error) {
        console.error('Failed to initialize Enhanced AI Smile Generator:', error);
        
        // Create more friendly error message
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.5;
        `;
        
        // Show different messages based on error type
        let errorMessage = 'Application initialization failed. Please refresh the page and try again.';
        
        if (error.message.includes('Window object not available')) {
            errorMessage = 'Browser environment not supported, please use a modern browser.';
        } else if (error.message.includes('Document object not available')) {
            errorMessage = 'Page loading error, please refresh the page and try again.';
        } else if (error.message.includes('FileReader')) {
            errorMessage = 'Your browser does not support file upload functionality, please use another browser.';
        }
        
        errorDiv.innerHTML = `
            <strong>Application initialization failed</strong><br>
            ${errorMessage}<br>
            <small>Error details: ${error.message}</small>
        `;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            color: #dc2626;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        };
        errorDiv.appendChild(closeBtn);
        
        document.body.appendChild(errorDiv);
        
        // Auto remove error message after 10 seconds
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