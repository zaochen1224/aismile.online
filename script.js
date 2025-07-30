/**
 * AI Smile Generator - Modern JavaScript Implementation
 * Features: AILabTools API integration, modern ES6+ syntax, comprehensive error handling
 * Author: AI Smile Generator Team
 * Version: 2.0.0
 */

// Configuration and Constants
const CONFIG = {
    // API Configuration
    API: {
        BASE_URL: 'https://api.ailabtools.com',
        ENDPOINTS: {
            UPLOAD: '/api/v1/upload',
            CHANGE_EXPRESSION: '/api/v1/change-expression',
            RESULT: '/api/v1/result'
        },
        TIMEOUT: 30000, // 30 seconds
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000 // 1 second
    },
    
    // File validation
    FILE: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
    },
    
    // UI Configuration
    UI: {
        PROGRESS_UPDATE_INTERVAL: 100,
        TOAST_DURATION: 5000,
        LOADING_TIPS_INTERVAL: 2000
    },
    
    // Expression options
    EXPRESSIONS: {
        SMILE: 'smile',
        HAPPY: 'happy',
        LAUGH: 'laugh',
        NATURAL: 'natural',
        JOY: 'joy'
    }
};

// Utility Functions Module
const Utils = {
    /**
     * Format file size to human readable format
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Debounce function
     */
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

    /**
     * Sleep utility for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
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
    }
};

// API Client Module
class APIClient {
    constructor() {
        this.apiKey = this.getApiKey();
        this.baseURL = CONFIG.API.BASE_URL;
    }

    /**
     * Get API key from various sources
     */
    getApiKey() {
        // Try environment variable first (for Node.js environments)
        if (typeof process !== 'undefined' && process.env) {
            return process.env.AILABTOOLS_API_KEY;
        }
        
        // Try localStorage
        const stored = localStorage.getItem('ailabtools_api_key');
        if (stored) return stored;
        
        // Default empty (user needs to set it)
        return '';
    }

    /**
     * Set API key
     */
    setApiKey(key) {
        this.apiKey = key;
        // Store in localStorage for persistence
        if (key) {
            localStorage.setItem('ailabtools_api_key', key);
        } else {
            localStorage.removeItem('ailabtools_api_key');
        }
    }

    /**
     * Make HTTP request with retry logic
     */
    async makeRequest(url, options = {}, retries = CONFIG.API.MAX_RETRIES) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
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
            
            throw error;
        }
    }

    /**
     * Determine if error should trigger a retry
     */
    shouldRetry(error) {
        if (error.name === 'AbortError') return false;
        if (error instanceof APIError && error.status >= 400 && error.status < 500) return false;
        return true;
    }

    /**
     * Upload image to AILabTools
     */
    async uploadImage(file, onProgress) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await this.makeRequest(`${this.baseURL}${CONFIG.API.ENDPOINTS.UPLOAD}`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        return this.extractUrl(data, ['image_url', 'url', 'file_url']);
    }

    /**
     * Change facial expression
     */
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
        
        // Handle different response formats
        if (data.result_url || data.image_url || data.url) {
            return this.extractUrl(data, ['result_url', 'image_url', 'url']);
        }
        
        // Handle async processing
        if (data.job_id || data.task_id || data.id) {
            const jobId = data.job_id || data.task_id || data.id;
            return this.pollForResult(jobId);
        }
        
        throw new APIError('Unexpected response format from API');
    }

    /**
     * Poll for async result
     */
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
                
                // Continue polling
                await Utils.sleep(2000);
            } catch (error) {
                if (attempt === maxAttempts - 1) throw error;
                await Utils.sleep(2000);
            }
        }
        
        throw new APIError('Processing timeout - result not ready');
    }

    /**
     * Extract URL from various response formats
     */
    extractUrl(data, keys) {
        for (const key of keys) {
            if (data[key]) return data[key];
            if (data.data && data.data[key]) return data.data[key];
            if (data.result && data.result[key]) return data.result[key];
        }
        throw new APIError('No valid URL found in response');
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

// File Validator Module
class FileValidator {
    static validate(file) {
        const errors = [];

        // Check file type
        if (!CONFIG.FILE.ALLOWED_TYPES.includes(file.type)) {
            errors.push(`不支持的文件类型。请上传 ${CONFIG.FILE.ALLOWED_EXTENSIONS.join(', ')} 格式的图片。`);
        }

        // Check file size
        if (file.size > CONFIG.FILE.MAX_SIZE) {
            errors.push(`文件大小超过限制。最大支持 ${Utils.formatFileSize(CONFIG.FILE.MAX_SIZE)}。`);
        }

        // Check if file is actually an image
        if (!file.type.startsWith('image/')) {
            errors.push('请上传有效的图片文件。');
        }

        if (errors.length > 0) {
            throw new ValidationError(errors.join(' '));
        }

        return true;
    }
}

// Toast Notification System
class ToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toasts = new Map();
    }

    createContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
        const id = Utils.generateId();
        const toast = this.createToast(id, message, type);
        
        this.container.appendChild(toast);
        this.toasts.set(id, toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(id), duration);
        }

        return id;
    }

    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-left: 4px solid var(--${type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'primary'}-500);
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: auto;
            max-width: 400px;
            word-wrap: break-word;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        const icon = document.createElement('span');
        icon.style.fontSize = '20px';
        icon.textContent = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[type] || 'ℹ️';

        const text = document.createElement('span');
        text.textContent = message;
        text.style.flex = '1';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.5;
            padding: 0;
            margin-left: 8px;
        `;
        closeBtn.onclick = () => this.dismiss(id);

        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(closeBtn);
        toast.appendChild(content);

        return toast;
    }

    dismiss(id) {
        const toast = this.toasts.get(id);
        if (toast) {
            toast.style.transform = 'translateX(400px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(id);
            }, 300);
        }
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// Progress Manager
class ProgressManager {
    constructor(progressElement, textElement) {
        this.progressElement = progressElement;
        this.textElement = textElement;
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.animationId = null;
    }

    setProgress(progress, text) {
        this.targetProgress = Math.max(0, Math.min(100, progress));
        if (text && this.textElement) {
            this.textElement.textContent = text;
        }
        this.animate();
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
            }

            if (Math.abs(this.targetProgress - this.currentProgress) > 0.1) {
                this.animationId = requestAnimationFrame(step);
            }
        };

        this.animationId = requestAnimationFrame(step);
    }

    reset() {
        this.currentProgress = 0;
        this.targetProgress = 0;
        if (this.progressElement) {
            this.progressElement.style.width = '0%';
        }
        if (this.textElement) {
            this.textElement.textContent = '';
        }
    }
}

// Main Application Class
class AISmileGenerator {
    constructor() {
        this.apiClient = new APIClient();
        this.toast = new ToastManager();
        this.currentImage = null;
        this.resultImage = null;
        this.isProcessing = false;
        this.progressManager = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.initializeElements();
            this.bindEvents();
            this.checkApiKey();
            this.initializeComparison();
            
            console.log('AI Smile Generator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.toast.error('应用初始化失败，请刷新页面重试。');
        }
    }

    /**
     * Initialize DOM elements
     */
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
            this.progressManager = new ProgressManager(this.progressFill, this.loadingTip);
        }

        // Validate required elements
        const requiredElements = [
            'uploadArea', 'fileInput', 'processBtn'
        ];
        
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                throw new Error(`Required element not found: ${elementId}`);
            }
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Upload events
        if (this.uploadArea && this.fileInput) {
            this.uploadArea.addEventListener('click', () => this.fileInput.click());
            this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
            this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
            this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        // Remove button
        if (this.removeBtn) {
            this.removeBtn.addEventListener('click', this.removeImage.bind(this));
        }

        // Process button
        if (this.processBtn) {
            this.processBtn.addEventListener('click', this.processImage.bind(this));
        }

        // Result actions
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', this.downloadResult.bind(this));
        }
        if (this.newImageBtn) {
            this.newImageBtn.addEventListener('click', this.resetForNewImage.bind(this));
        }

        // Comparison slider
        if (this.comparisonSlider) {
            this.comparisonSlider.addEventListener('input', this.updateComparison.bind(this));
        }

        // Share buttons
        this.shareButtons.forEach(btn => {
            btn.addEventListener('click', this.handleShare.bind(this));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    /**
     * Check API key availability
     */
    checkApiKey() {
        if (!this.apiClient.apiKey) {
            this.toast.warning(
                '请设置您的 AILabTools API 密钥。在浏览器控制台中运行: smileGenerator.setApiKey("your-api-key")',
                0 // Don't auto-dismiss
            );
        }
    }

    /**
     * Set API key (public method)
     */
    setApiKey(key) {
        this.apiClient.setApiKey(key);
        if (key) {
            this.toast.success('API 密钥设置成功！');
        } else {
            this.toast.info('API 密钥已清除。');
        }
    }

    /**
     * Handle drag over event
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.classList.add('drag-over');
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!this.uploadArea.contains(e.relatedTarget)) {
            this.uploadArea.classList.remove('drag-over');
        }
    }

    /**
     * Handle drop event
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    /**
     * Handle file select event
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    /**
     * Handle file processing
     */
    async handleFile(file) {
        try {
            // Validate file
            FileValidator.validate(file);

            // Create image object
            this.currentImage = {
                file: file,
                name: file.name,
                size: file.size,
                type: file.type,
                dataUrl: await this.fileToDataUrl(file)
            };

            this.showImagePreview();
            this.toast.success('图片上传成功！');

        } catch (error) {
            if (error instanceof ValidationError) {
                this.toast.error(error.message);
            } else {
                console.error('File handling error:', error);
                this.toast.error('文件处理失败，请重试。');
            }
        }
    }

    /**
     * Convert file to data URL
     */
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Show image preview
     */
    showImagePreview() {
        if (!this.currentImage) return;

        // Update preview image
        if (this.previewImg) {
            this.previewImg.src = this.currentImage.dataUrl;
            this.previewImg.alt = `预览: ${this.currentImage.name}`;
        }

        // Update image info
        if (this.imageInfo) {
            this.imageInfo.textContent = `${this.currentImage.name} (${Utils.formatFileSize(this.currentImage.size)})`;
        }

        // Show preview section
        if (this.imagePreview) {
            this.imagePreview.style.display = 'block';
        }

        // Enable process button
        if (this.processBtn) {
            this.processBtn.disabled = false;
            this.processBtn.style.display = 'block';
        }

        // Hide upload area
        if (this.uploadArea) {
            this.uploadArea.style.display = 'none';
        }
    }

    /**
     * Remove current image
     */
    removeImage() {
        this.currentImage = null;
        this.resultImage = null;

        // Reset file input
        if (this.fileInput) {
            this.fileInput.value = '';
        }

        // Hide preview
        if (this.imagePreview) {
            this.imagePreview.style.display = 'none';
        }

        // Show upload area
        if (this.uploadArea) {
            this.uploadArea.style.display = 'block';
        }

        // Hide result sections
        this.hideResults();

        // Disable process button
        if (this.processBtn) {
            this.processBtn.disabled = true;
            this.processBtn.style.display = 'none';
        }

        this.toast.info('图片已移除。');
    }

    /**
     * Process image with AI
     */
    async processImage() {
        if (!this.currentImage || this.isProcessing) return;

        if (!this.apiClient.apiKey) {
            this.toast.error('请先设置 API 密钥。在控制台运行: smileGenerator.setApiKey("your-key")');
            return;
        }

        this.isProcessing = true;
        this.showLoading();

        try {
            // Step 1: Upload image
            this.updateProgress(10, '正在上传图片...');
            const imageUrl = await this.apiClient.uploadImage(this.currentImage.file);
            
            this.updateProgress(30, '图片上传成功，开始AI处理...');
            
            // Step 2: Process with AI
            this.updateProgress(50, '正在分析面部特征...');
            const resultUrl = await this.apiClient.changeExpression(imageUrl, CONFIG.EXPRESSIONS.SMILE, {
                intensity: 0.8,
                preserveIdentity: true,
                enhanceQuality: true
            });
            
            this.updateProgress(80, '正在生成微笑效果...');
            
            // Step 3: Store result
            this.resultImage = resultUrl;
            
            this.updateProgress(100, '处理完成！');
            
            // Show results
            await Utils.sleep(500); // Brief delay to show completion
            this.showResults();
            this.toast.success('AI 微笑生成成功！');

        } catch (error) {
            console.error('Processing error:', error);
            
            if (error instanceof APIError) {
                if (error.status === 401) {
                    this.toast.error('API 密钥无效，请检查您的密钥。');
                } else if (error.status === 429) {
                    this.toast.error('请求过于频繁，请稍后再试。');
                } else if (error.status >= 500) {
                    this.toast.error('服务器错误，请稍后重试。');
                } else {
                    this.toast.error(`API 错误: ${error.message}`);
                }
            } else if (error.name === 'AbortError') {
                this.toast.error('请求超时，请检查网络连接。');
            } else {
                this.toast.error('处理失败，请重试。如果问题持续，请检查图片格式和网络连接。');
            }
            
            // Show demo result as fallback
            this.showDemoResult();
            
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    /**
     * Update processing progress
     */
    updateProgress(progress, text) {
        if (this.progressManager) {
            this.progressManager.setProgress(progress, text);
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (this.loadingState) {
            this.loadingState.style.display = 'block';
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

    /**
     * Hide loading state
     */
    hideLoading() {
        if (this.loadingState) {
            this.loadingState.style.display = 'none';
        }
        if (this.processBtn) {
            this.processBtn.style.display = 'block';
        }
        
        this.stopLoadingTips();
    }

    /**
     * Start rotating loading tips
     */
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
            
            if (this.loadingTip) {
                this.loadingTip.textContent = tips[currentTip];
            }
            currentTip = (currentTip + 1) % tips.length;
        }, CONFIG.UI.LOADING_TIPS_INTERVAL);
    }

    /**
     * Stop loading tips rotation
     */
    stopLoadingTips() {
        if (this.loadingTipsInterval) {
            clearInterval(this.loadingTipsInterval);
            this.loadingTipsInterval = null;
        }
    }

    /**
     * Show processing results
     */
    showResults() {
        if (!this.currentImage || !this.resultImage) return;

        // Show comparison
        this.showComparison(this.currentImage.dataUrl, this.resultImage);
        
        // Show final result
        this.showFinalResult(this.resultImage);
        
        // Show share section
        if (this.shareSection) {
            this.shareSection.style.display = 'block';
        }
    }

    /**
     * Show before/after comparison
     */
    showComparison(beforeSrc, afterSrc) {
        if (this.beforeImg && this.afterImg && this.comparisonSection) {
            this.beforeImg.src = beforeSrc;
            this.beforeImg.alt = '原始图片';
            this.afterImg.src = afterSrc;
            this.afterImg.alt = 'AI增强后的图片';
            this.comparisonSection.style.display = 'block';
            this.updateComparison();
        }
    }

    /**
     * Update comparison slider
     */
    updateComparison() {
        if (this.comparisonSlider && this.afterImg) {
            const value = this.comparisonSlider.value;
            this.afterImg.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
        }
    }

    /**
     * Show final result
     */
    showFinalResult(imageSrc) {
        if (this.resultImg && this.resultSection) {
            this.resultImg.src = imageSrc;
            this.resultImg.alt = '最终AI增强结果';
            this.resultSection.style.display = 'block';
            
            // Update download filename
            if (this.currentImage && this.downloadBtn) {
                const nameWithoutExt = this.currentImage.name.replace(/\.[^/.]+$/, '');
                this.downloadBtn.setAttribute('data-filename', `${nameWithoutExt}_smile.jpg`);
            }
        }
    }

    /**
     * Show demo result when API fails
     */
    async showDemoResult() {
        if (!this.currentImage) return;
        
        try {
            const demoResult = await this.createDemoImage(this.currentImage.dataUrl);
            this.resultImage = demoResult;
            this.showResults();
            this.toast.info('显示演示结果。请设置正确的API密钥以使用真实的AI处理。', 8000);
        } catch (error) {
            console.error('Failed to create demo result:', error);
        }
    }

    /**
     * Create demo image with overlay
     */
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

    /**
     * Hide all result sections
     */
    hideResults() {
        const sections = [this.comparisonSection, this.resultSection, this.shareSection];
        sections.forEach(section => {
            if (section) section.style.display = 'none';
        });
    }

    /**
     * Download result image
     */
    async downloadResult() {
        if (!this.resultImage) {
            this.toast.error('没有可下载的结果图片。');
            return;
        }

        try {
            const filename = this.downloadBtn?.getAttribute('data-filename') || 'ai_smile_result.jpg';
            
            if (this.resultImage.startsWith('data:')) {
                // Data URL - direct download
                this.downloadDataUrl(this.resultImage, filename);
            } else {
                // External URL - fetch and download
                const response = await fetch(this.resultImage);
                const blob = await response.blob();
                this.downloadBlob(blob, filename);
            }
            
            this.toast.success('图片下载成功！');
            
        } catch (error) {
            console.error('Download failed:', error);
            this.toast.error('下载失败，请重试。');
        }
    }

    /**
     * Download data URL as file
     */
    downloadDataUrl(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Download blob as file
     */
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

    /**
     * Reset for new image
     */
    resetForNewImage() {
        this.removeImage();
        this.toast.info('已重置，可以上传新图片了。');
    }

    /**
     * Initialize comparison functionality
     */
    initializeComparison() {
        if (this.comparisonSlider) {
            this.comparisonSlider.value = 50;
        }
    }

    /**
     * Handle social sharing
     */
    async handleShare(e) {
        const platform = e.target.closest('.share-btn')?.dataset.platform;
        if (!platform) return;

        const url = window.location.href;
        const text = 'Check out this amazing AI Smile Generator! 快来试试这个神奇的AI微笑生成器！';

        try {
            switch (platform) {
                case 'facebook':
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
                    break;
                    
                case 'twitter':
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
                    break;
                    
                case 'instagram':
                case 'copy':
                    const success = await Utils.copyToClipboard(url);
                    if (success) {
                        this.toast.success(platform === 'instagram' ? '链接已复制！在Instagram中粘贴分享。' : '链接已复制到剪贴板！');
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

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // ESC - Reset
        if (e.key === 'Escape') {
            if (this.isProcessing) {
                // Could implement cancellation logic here
                this.toast.info('处理中，无法取消。请等待完成。');
            } else {
                this.resetForNewImage();
            }
        }
        
        // Enter - Process image
        if (e.key === 'Enter' && this.currentImage && !this.isProcessing) {
            this.processImage();
        }
        
        // Space - Download result
        if (e.key === ' ' && this.resultImage && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            this.downloadResult();
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload(e) {
        if (this.isProcessing) {
            e.preventDefault();
            e.returnValue = '图片正在处理中，确定要离开吗？';
            return e.returnValue;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopLoadingTips();
        
        if (this.progressManager && this.progressManager.animationId) {
            cancelAnimationFrame(this.progressManager.animationId);
        }
        
        // Remove event listeners
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('keydown', this.handleKeyboard);
        
        console.log('AI Smile Generator destroyed');
    }
}

// Initialize application when DOM is ready
let smileGenerator;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    try {
        smileGenerator = new AISmileGenerator();
        
        // Make it globally accessible for API key setting
        window.smileGenerator = smileGenerator;
        
        console.log('🎭 AI Smile Generator loaded successfully!');
        console.log('💡 To set your API key, run: smileGenerator.setApiKey("your-api-key")');
        
    } catch (error) {
        console.error('Failed to initialize AI Smile Generator:', error);
        
        // Show error to user
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
        
        // Auto remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AISmileGenerator, CONFIG, Utils };
} 