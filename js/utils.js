/**
 * 共通ユーティリティ関数
 * index.htmlとadmin_office_integrated.htmlで共有
 */

/**
 * 時刻フォーマット関数
 * @param {Date} date - フォーマットする日付オブジェクト
 * @returns {string} フォーマットされた時刻文字列 (HH:MM:SS)
 */
export function formatTime(date) {
    return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * 日付フォーマット関数
 * @param {Date} date - フォーマットする日付オブジェクト
 * @param {boolean} includeWeekday - 曜日を含めるかどうか
 * @returns {string} フォーマットされた日付文字列
 */
export function formatDate(date, includeWeekday = true) {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    if (includeWeekday) {
        options.weekday = 'long';
    }
    
    return date.toLocaleDateString('ja-JP', options);
}

/**
 * 勤務時間の計算（外出時間を除外）
 * @param {Array} records - 打刻記録の配列
 * @returns {Object|null} 勤務時間情報または null
 */
export function calculateWorkTime(records) {
    const clockIn = records.find(r => r.type === 'clock_in');
    const clockOut = records.find(r => r.type === 'clock_out');
    
    if (!clockIn) {
        return null;
    }
    
    // 出勤時刻を取得
    const startTime = clockIn.timestamp;
    
    // 退勤していない場合は現在時刻まで
    const endTime = clockOut ? clockOut.timestamp : new Date();
    
    // 総経過時間（ミリ秒）
    const totalMs = endTime - startTime;

    // 分に変換
    const totalMinutes = Math.floor(totalMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
        hours: hours,
        minutes: minutes,
        isFinished: !!clockOut
    };
}

/**
 * CSVデータを生成するヘルパー関数
 * @param {Array} headers - CSVヘッダー配列
 * @param {Array} rows - CSVデータ行の配列
 * @returns {string} CSV文字列
 */
export function generateCSV(headers, rows) {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');
    
    return csvContent;
}

/**
 * タブ切り替え表示関数
 * @param {string} activeTabId - アクティブにするタブのID
 * @param {Array} allTabIds - 全てのタブIDの配列
 */
export function showTab(activeTabId, allTabIds) {
    // 全てのタブを非表示
    allTabIds.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.style.display = 'none';
        }
    });
    
    // 指定されたタブを表示
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.style.display = 'block';
    }
    
    // タブボタンの状態も更新
    allTabIds.forEach(tabId => {
        const btn = document.querySelector(`[onclick*="${tabId}"]`);
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    const activeBtn = document.querySelector(`[onclick*="${activeTabId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * 通知メッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ ('success', 'error', 'info', 'warning')
 * @param {number} duration - 表示時間（ミリ秒、0で自動非表示なし）
 */
export function showNotification(message, type = 'success', duration = 5000) {
    // 既存の通知を削除
    const existingNotification = document.querySelector('.notification-overlay');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 通知要素を作成
    const notification = document.createElement('div');
    notification.className = `notification-overlay notification-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // スタイルを追加
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-left: 4px solid;
        animation: slideIn 0.3s ease;
    `;
    
    const content = notification.querySelector('.notification-content');
    content.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px;
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #999;
        margin-left: auto;
    `;
    
    // タイプ別の色設定
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        info: '#2196F3',
        warning: '#ff9800'
    };
    
    notification.style.borderLeftColor = colors[type] || colors.info;
    
    // DOM に追加
    document.body.appendChild(notification);
    
    // アニメーション用CSS を追加（初回のみ）
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 自動非表示
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, duration);
    }
}

/**
 * ローディング表示を管理
 * @param {boolean} show - true で表示、false で非表示
 * @param {string} message - ローディングメッセージ
 */
export function showLoading(show, message = '読み込み中...') {
    let loading = document.querySelector('.loading-overlay');
    
    if (show) {
        if (!loading) {
            loading = document.createElement('div');
            loading.className = 'loading-overlay';
            loading.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-message">${message}</div>
                </div>
            `;
            
            loading.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;
            
            const content = loading.querySelector('.loading-content');
            content.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                min-width: 200px;
            `;
            
            const spinner = loading.querySelector('.loading-spinner');
            spinner.style.cssText = `
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            `;
            
            // スピナーアニメーション用CSS（初回のみ）
            if (!document.querySelector('#loading-styles')) {
                const style = document.createElement('style');
                style.id = 'loading-styles';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(loading);
        } else {
            loading.querySelector('.loading-message').textContent = message;
            loading.style.display = 'flex';
        }
    } else {
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

/**
 * PC識別情報を生成
 * @returns {string} PC識別情報文字列
 */
export function generatePCIdentifier() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const screenResolution = `${screen.width}x${screen.height}`;
    
    return `${platform} | ${screenResolution} | ${language}`;
}

/**
 * 日付範囲の妥当性チェック
 * @param {Date} startDate - 開始日
 * @param {Date} endDate - 終了日
 * @param {number} maxDays - 最大日数
 * @returns {Object} チェック結果
 */
export function validateDateRange(startDate, endDate, maxDays = 60) {
    const result = {
        isValid: true,
        message: ''
    };
    
    if (!startDate || !endDate) {
        result.isValid = false;
        result.message = '開始日と終了日を選択してください';
        return result;
    }
    
    if (startDate > endDate) {
        result.isValid = false;
        result.message = '開始日は終了日より前の日付を選択してください';
        return result;
    }
    
    const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    if (diffDays > maxDays) {
        result.isValid = false;
        result.message = `期間は${maxDays}日以内で指定してください`;
        return result;
    }
    
    return result;
}

/**
 * デバウンス関数
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * ファイルダウンロード用のBlobを作成
 * @param {string} content - ファイル内容
 * @param {string} filename - ファイル名
 * @param {string} mimeType - MIMEタイプ
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // クリーンアップ
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// グローバル関数として登録（monthly.jsなどから使用）
window.showMessage = showNotification;
