// QuickText - Modern Production App
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyB7CwcJ42D_X4-E9_3sT9Bx31IJDCRCU0M",
    authDomain: "qtext-a12dd.firebaseapp.com",
    projectId: "qtext-a12dd",
    storageBucket: "qtext-a12dd.firebasestorage.app",
    messagingSenderId: "611062076309",
    appId: "1:611062076309:web:913ff067a40e54a26f5c9c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Utility Functions
const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

class QuickTextApp {
    constructor() {
        this.currentPage = this.detectCurrentPage();
        this.init();
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        return path.includes('fetch') || path.includes('get') ? 'fetch' : 'share';
    }

    init() {
        this.setupGlobalEventListeners();
        
        if (this.currentPage === 'share') {
            this.initSharePage();
        } else if (this.currentPage === 'fetch') {
            this.initFetchPage();
        }
    }

    setupGlobalEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (this.currentPage === 'share') {
                    this.shareText();
                } else if (this.currentPage === 'fetch') {
                    this.fetchText();
                }
            }
        });

        // Online/offline status
        window.addEventListener('online', () => {
            console.log('Connection restored');
            this.showToast('Connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            this.showToast('You are offline. Please check your connection.', 'error');
        });
    }

    initSharePage() {
        const inputText = $('inputText');
        const shareBtn = $('shareBtn');
        const clearBtn = $('clearBtn');
        const oneTimeCheck = $('oneTimeCheck');
        const charCount = $('charCount');

        if (!inputText || !shareBtn) return;

        // Character counter and button state
        inputText.addEventListener('input', (e) => {
            const length = e.target.value.length;
            charCount.textContent = length;
            
            const hasText = e.target.value.trim().length > 0;
            shareBtn.disabled = !hasText;
            clearBtn.disabled = !hasText && !oneTimeCheck.checked;

            // Dynamic textarea height
            e.target.style.height = 'auto';
            e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
        });

        // Share button
        shareBtn.addEventListener('click', () => this.shareText());

        // Clear button
        clearBtn.addEventListener('click', () => this.clearForm());

        // One-time checkbox
        oneTimeCheck.addEventListener('change', () => {
            clearBtn.disabled = !inputText.value.trim() && !oneTimeCheck.checked;
        });

        // Auto-focus
        inputText.focus();
    }

    initFetchPage() {
        const fetchCode = $('fetchCode');
        const fetchBtn = $('fetchBtn');

        if (!fetchCode || !fetchBtn) return;

        // Format code input
        fetchCode.addEventListener('input', (e) => {
            const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
            e.target.value = value;
            
            const hasCode = value.trim().length > 0;
            fetchBtn.disabled = !hasCode;
        });

        // Enter key to fetch
        fetchCode.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && fetchCode.value.trim()) {
                e.preventDefault();
                this.fetchText();
            }
        });

        // Fetch button
        fetchBtn.addEventListener('click', () => this.fetchText());

        // Copy and download buttons (will be added dynamically)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'copyTextBtn') {
                this.copyFetchedText();
            } else if (e.target.id === 'downloadBtn') {
                this.downloadText();
            } else if (e.target.id === 'copyCodeBtn') {
                this.copyToClipboard($('shareCode').textContent, 'Code copied!');
            } else if (e.target.id === 'copyLinkBtn') {
                this.copyToClipboard($('shareLink').value, 'Link copied!');
            }
        });

        // Handle URL parameters
        this.handleURLParameters();

        // Auto-focus
        fetchCode.focus();
    }

    async shareText() {
        const inputText = $('inputText');
        const shareBtn = $('shareBtn');
        const oneTimeCheck = $('oneTimeCheck');
        
        const text = inputText.value.trim();
        if (!text) {
            this.showStatus('Please enter some text to share', 'error');
            inputText.focus();
            return;
        }

        try {
            this.setButtonLoading(shareBtn, true, 'Sharing...');
            this.showStatus('Generating secure code...', 'loading');

            const code = await this.generateUniqueCode();
            await setDoc(doc(db, "texts", code), {
                text,
                createdAt: new Date().toISOString(),
                oneTime: !!oneTimeCheck.checked
            });

            const link = `${window.location.origin}/fetch.html?code=${encodeURIComponent(code)}`;
            this.showShareResults(code, link, oneTimeCheck.checked);
            this.showStatus('Text shared successfully!', 'success');

        } catch (error) {
            console.error('Share error:', error);
            this.showStatus(`Failed to share: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading(shareBtn, false, 'Share Text');
        }
    }

    async fetchText() {
        const fetchCode = $('fetchCode');
        const fetchBtn = $('fetchBtn');
        
        const code = fetchCode.value.trim();
        if (!code) {
            this.showFetchStatus('Please enter a code', 'error');
            fetchCode.focus();
            return;
        }

        try {
            this.setButtonLoading(fetchBtn, true, 'Fetching...');
            this.showFetchStatus('Retrieving text...', 'loading');

            const snap = await getDoc(doc(db, "texts", code));
            if (!snap.exists()) {
                this.showFetchStatus(`No text found for code: ${code}`, 'error');
                return;
            }

            const data = snap.data();
            let wasDeleted = false;

            // Handle one-time deletion
            if (data.oneTime) {
                await deleteDoc(doc(db, "texts", code));
                wasDeleted = true;
            }

            this.showFetchedContent(data, wasDeleted);
            this.showFetchStatus('Text retrieved successfully!', 'success');

            // Clear URL parameters for security
            if (window.location.search) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            this.showFetchStatus(`Failed to fetch: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading(fetchBtn, false, 'Fetch');
        }
    }

    async generateUniqueCode(length = 6, maxAttempts = 10) {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const code = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
            
            const exists = await getDoc(doc(db, "texts", code));
            if (!exists.exists()) {
                return code;
            }
        }
        
        throw new Error("Could not generate unique code. Please try again.");
    }

    showShareResults(code, link, isOneTime) {
        const results = $('shareResults');
        const shareCode = $('shareCode');
        const shareLink = $('shareLink');
        const oneTimeWarning = $('oneTimeWarning');

        if (!results) return;

        shareCode.textContent = code;
        shareLink.value = link;
        
        results.classList.remove('hidden');
        
        if (isOneTime) {
            oneTimeWarning.classList.remove('hidden');
        } else {
            oneTimeWarning.classList.add('hidden');
        }
    }

    showFetchedContent(data, wasDeleted) {
        const container = $('fetchedContent');
        const textArea = $('fetchedText');
        const dateSpan = $('fetchedDate');
        const lengthSpan = $('fetchedLength');
        const oneTimeBadge = $('oneTimeBadge');
        const oneTimeNotice = $('oneTimeNotice');
        const deletedNotice = $('deletedNotice');

        if (!container || !textArea) return;

        textArea.value = data.text;
        
        // Adjust textarea height
        textArea.style.height = 'auto';
        textArea.style.height = Math.max(200, textArea.scrollHeight) + 'px';

        dateSpan.textContent = `Created: ${new Date(data.createdAt).toLocaleString()}`;
        lengthSpan.textContent = `${data.text.length} characters`;

        if (data.oneTime) {
            oneTimeBadge.classList.remove('hidden');
            oneTimeNotice.classList.remove('hidden');
            
            if (wasDeleted) {
                deletedNotice.classList.remove('hidden');
            }
        } else {
            oneTimeBadge.classList.add('hidden');
            oneTimeNotice.classList.add('hidden');
            deletedNotice.classList.add('hidden');
        }

        container.classList.remove('hidden');
    }

    clearForm() {
        const inputText = $('inputText');
        const shareBtn = $('shareBtn');
        const clearBtn = $('clearBtn');
        const oneTimeCheck = $('oneTimeCheck');
        const charCount = $('charCount');
        const results = $('shareResults');
        const statusMessage = $('statusMessage');

        if (confirm('Clear all data and reset the form?')) {
            inputText.value = '';
            inputText.style.height = '200px';
            oneTimeCheck.checked = false;
            charCount.textContent = '0';
            
            shareBtn.disabled = true;
            clearBtn.disabled = true;
            
            results.classList.add('hidden');
            statusMessage.classList.add('hidden');
            
            inputText.focus();
        }
    }

    async copyFetchedText() {
        const textArea = $('fetchedText');
        if (!textArea || !textArea.value) return;

        await this.copyToClipboard(textArea.value, 'Text copied to clipboard!');
        
        const btn = $('copyTextBtn');
        this.animateButton(btn, 'Copied!', 'success');
    }

    downloadText() {
        const textArea = $('fetchedText');
        const code = $('fetchCode').value.trim();
        
        if (!textArea || !textArea.value) return;

        const blob = new Blob([textArea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `quicktext-${code || 'download'}.txt`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.showToast('File downloaded successfully!', 'success');
    }

    async copyToClipboard(text, successMessage = 'Copied!') {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(successMessage, 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showToast(successMessage, 'success');
            } catch (fallbackError) {
                this.showToast('Failed to copy to clipboard', 'error');
            }
            
            document.body.removeChild(textArea);
        }
    }

    handleURLParameters() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (code) {
            const fetchCode = $('fetchCode');
            if (fetchCode) {
                fetchCode.value = code;
                $('fetchBtn').disabled = false;
                
                // Auto-fetch after a short delay
                setTimeout(() => this.fetchText(), 300);
            }
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = $('statusMessage');
        if (!statusEl) return;

        statusEl.className = `status-message status-${type}`;
        statusEl.textContent = message;
        statusEl.classList.remove('hidden');

        // Auto-hide after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 5000);
        }
    }

    showFetchStatus(message, type = 'info') {
        const statusEl = $('fetchStatus');
        if (!statusEl) return;

        statusEl.className = `status-message status-${type}`;
        statusEl.textContent = message;
        statusEl.classList.remove('hidden');

        if (type !== 'error') {
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 5000);
        }
    }

    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Toast styles
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out',
            backgroundColor: type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#1d4ed8'
        });
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto-remove
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    setButtonLoading(button, isLoading, text) {
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.classList.add('loading');
            
            const textSpan = button.querySelector('span:last-child');
            if (textSpan) {
                textSpan.textContent = text;
            }
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            
            const textSpan = button.querySelector('span:last-child');
            if (textSpan) {
                textSpan.textContent = text;
            }
        }
    }

    animateButton(button, tempText, tempClass) {
        if (!button) return;

        const originalText = button.textContent;
        const originalClass = button.className;
        
        button.textContent = tempText;
        button.className = `btn btn-${tempClass}`;
        
        setTimeout(() => {
            button.textContent = originalText;
            button.className = originalClass;
        }, 2000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QuickTextApp();
});

// Export for potential external use
window.QuickTextApp = QuickTextApp;