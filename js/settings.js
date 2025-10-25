/**
 * Settings Module - 基本設定管理（休日設定、設定保存・読み込み）
 * @description 管理画面の基本設定タブの機能を提供
 * @requires config.js - Firebase設定
 * @requires utils.js - 共通関数
 */

import { db } from './config.js';
import { formatDate, showNotification } from './utils.js';
import { doc, getDoc, setDoc, collection, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * 設定管理クラス
 */
class SettingsManager {
    constructor() {
        this.settings = {
            workStartTime: '09:00',
            workEndTime: '18:00',
            breakTime: 60,
            holidays: [],
            notifications: true,
            autoSave: true
        };
        this.holidaysCache = new Map();
        this.isLoading = false;
    }

    /**
     * 設定初期化
     * @returns {Promise<void>}
     */
    async init() {
        try {
            await this.loadSettings();
            this.bindEvents();
            showNotification('設定が読み込まれました', 'success');
        } catch (error) {
            console.error('設定初期化エラー:', error);
            showNotification('設定の読み込みに失敗しました', 'error');
        }
    }

    /**
     * イベントリスナーをバインド
     */
    bindEvents() {
        // 設定保存ボタン
        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // 休日追加ボタン
        const addHolidayBtn = document.getElementById('addHoliday');
        if (addHolidayBtn) {
            addHolidayBtn.addEventListener('click', () => this.addHoliday());
        }

        // 休日一括インポートボタン
        const importBtn = document.getElementById('importHolidays');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importHolidays());
        }

        // 設定値の変更監視
        this.watchSettingsChanges();
    }

    /**
     * 設定値の変更を監視
     */
    watchSettingsChanges() {
        const inputs = document.querySelectorAll('#settingsTab input, #settingsTab select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                if (this.settings.autoSave) {
                    this.saveSettings();
                }
                this.markAsChanged();
            });
        });
    }

    /**
     * 設定変更マーク
     */
    markAsChanged() {
        const indicator = document.querySelector('.settings-changed-indicator');
        if (indicator) {
            indicator.style.display = 'inline-block';
        }
    }

    /**
     * 設定をFirestoreから読み込み
     * @returns {Promise<void>}
     */
    async loadSettings() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
            
            if (settingsDoc.exists()) {
                this.settings = { ...this.settings, ...settingsDoc.data() };
            }

            await this.loadHolidays();
            this.renderSettings();
            
        } catch (error) {
            console.error('設定読み込みエラー:', error);
            showNotification('設定の読み込みに失敗しました', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 休日データを読み込み
     * @returns {Promise<void>}
     */
    async loadHolidays() {
        try {
            const holidaysSnapshot = await getDocs(collection(db, 'holidays'));
            this.settings.holidays = [];
            this.holidaysCache.clear();

            holidaysSnapshot.forEach(doc => {
                const holiday = { id: doc.id, ...doc.data() };
                this.settings.holidays.push(holiday);
                this.holidaysCache.set(doc.id, holiday);
            });

            // 日付順でソート
            this.settings.holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

        } catch (error) {
            console.error('休日データ読み込みエラー:', error);
            throw error;
        }
    }

    /**
     * 設定をFirestoreに保存
     * @returns {Promise<void>}
     */
    async saveSettings() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // フォームから設定値を取得
            this.getSettingsFromForm();

            // 保存するデータを準備（Firestoreに保存できる形式のみ）
            const settingsToSave = {
                companyName: this.settings.companyName,
                closingDay: this.settings.closingDay,
                startTime: this.settings.startTime,
                endTime: this.settings.endTime,
                breakTime: this.settings.breakTime,
                standardWorkTime: this.settings.standardWorkTime,
                overtimeThreshold: this.settings.overtimeThreshold,
                lateThreshold: this.settings.lateThreshold,
                weekends: this.settings.weekends || [],
                includeHolidays: this.settings.includeHolidays || false,
                updatedAt: Timestamp.now(),
                updatedBy: 'admin'
            };

            // Firestoreに保存
            await setDoc(doc(db, 'settings', 'general'), settingsToSave);

            showNotification('設定が保存されました', 'success');
            this.clearChangedMark();
            this.renderSettings();

        } catch (error) {
            console.error('設定保存エラー:', error);
            showNotification(`設定の保存に失敗しました: ${error.message}`, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * フォームから設定値を取得
     */
    getSettingsFromForm() {
        // 会社情報
        const companyName = document.getElementById('companyName')?.value;
        const closingDay = document.getElementById('closingDay')?.value;

        // 勤務時間設定
        const startTime = document.getElementById('startTime')?.value;
        const endTime = document.getElementById('endTime')?.value;
        const breakTime = document.getElementById('breakTime')?.value;
        const standardWorkTime = document.getElementById('standardWorkTime')?.value;

        // 残業・遅刻設定
        const overtimeThreshold = document.getElementById('overtimeThreshold')?.value;
        const lateThreshold = document.getElementById('lateThreshold')?.value;

        // 休日設定
        const weekends = [];
        ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((day, index) => {
            if (document.getElementById(day)?.checked) {
                weekends.push(index);
            }
        });
        const includeHolidays = document.getElementById('includeHolidays')?.checked;

        // 設定に反映
        if (companyName) this.settings.companyName = companyName;
        if (closingDay) this.settings.closingDay = closingDay;
        if (startTime) this.settings.startTime = startTime;
        if (endTime) this.settings.endTime = endTime;
        if (breakTime) this.settings.breakTime = parseInt(breakTime);
        if (standardWorkTime) this.settings.standardWorkTime = parseFloat(standardWorkTime);
        if (overtimeThreshold) this.settings.overtimeThreshold = parseFloat(overtimeThreshold);
        if (lateThreshold) this.settings.lateThreshold = parseInt(lateThreshold);
        this.settings.weekends = weekends;
        if (includeHolidays !== undefined) this.settings.includeHolidays = includeHolidays;
    }

    /**
     * 設定をフォームに表示
     */
    renderSettings() {
        // 会社情報
        const currentCompanyName = document.getElementById('currentCompanyName');
        const currentClosingDay = document.getElementById('currentClosingDay');
        if (currentCompanyName) currentCompanyName.textContent = this.settings.companyName || '未設定';
        if (currentClosingDay) currentClosingDay.textContent = this.settings.closingDay || '未設定';

        // 勤務時間設定
        const currentStartTime = document.getElementById('currentStartTime');
        const currentEndTime = document.getElementById('currentEndTime');
        const currentBreakTime = document.getElementById('currentBreakTime');
        const currentStandardWorkTime = document.getElementById('currentStandardWorkTime');

        if (currentStartTime) currentStartTime.textContent = this.settings.startTime || '未設定';
        if (currentEndTime) currentEndTime.textContent = this.settings.endTime || '未設定';
        if (currentBreakTime) currentBreakTime.textContent = this.settings.breakTime ? `${this.settings.breakTime}分` : '未設定';
        if (currentStandardWorkTime) currentStandardWorkTime.textContent = this.settings.standardWorkTime ? `${this.settings.standardWorkTime}時間` : '未設定';

        // 残業・遅刻設定
        const currentOvertimeThreshold = document.getElementById('currentOvertimeThreshold');
        const currentLateThreshold = document.getElementById('currentLateThreshold');

        if (currentOvertimeThreshold) currentOvertimeThreshold.textContent = this.settings.overtimeThreshold ? `${this.settings.overtimeThreshold}時間` : '未設定';
        if (currentLateThreshold) currentLateThreshold.textContent = this.settings.lateThreshold ? `${this.settings.lateThreshold}分` : '未設定';

        // 休日設定
        const currentWeekends = document.getElementById('currentWeekends');
        if (currentWeekends && this.settings.weekends) {
            const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
            const weekendLabels = this.settings.weekends.map(day => weekdayNames[day]).join('、');
            currentWeekends.textContent = weekendLabels || '未設定';
        }

        // チェックボックスの状態を復元
        if (this.settings.weekends) {
            ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((day, index) => {
                const checkbox = document.getElementById(day);
                if (checkbox) {
                    checkbox.checked = this.settings.weekends.includes(index);
                }
            });
        }

        const includeHolidays = document.getElementById('includeHolidays');
        if (includeHolidays) includeHolidays.checked = this.settings.includeHolidays || false;
    }

    /**
     * 休日リストを表示
     */
    renderHolidaysList() {
        const container = document.getElementById('holidaysList');
        if (!container) return;

        const currentYear = new Date().getFullYear();
        const thisYearHolidays = this.settings.holidays.filter(holiday => 
            new Date(holiday.date).getFullYear() === currentYear
        );

        container.innerHTML = `
            <div class="holidays-header">
                <h4>登録済み休日 (${currentYear}年) - ${thisYearHolidays.length}件</h4>
                <div class="holidays-controls">
                    <select id="yearFilter">
                        <option value="${currentYear}">${currentYear}年</option>
                        <option value="${currentYear + 1}">${currentYear + 1}年</option>
                        <option value="all">全年度</option>
                    </select>
                    <button type="button" class="btn-secondary" onclick="settingsManager.exportHolidays()">
                        エクスポート
                    </button>
                </div>
            </div>
            <div class="holidays-grid">
                ${this.renderHolidaysGrid(thisYearHolidays)}
            </div>
        `;

        // 年度フィルター
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            yearFilter.addEventListener('change', (e) => this.filterHolidaysByYear(e.target.value));
        }
    }

    /**
     * 休日グリッドをレンダリング
     * @param {Array} holidays - 休日データ
     * @returns {string} HTML文字列
     */
    renderHolidaysGrid(holidays) {
        if (holidays.length === 0) {
            return '<div class="no-holidays">登録されている休日はありません</div>';
        }

        return holidays.map(holiday => `
            <div class="holiday-item" data-holiday-id="${holiday.id}">
                <div class="holiday-date">
                    ${formatDate(new Date(holiday.date), 'MM/DD')}
                    <span class="holiday-weekday">(${this.getWeekdayJa(new Date(holiday.date))})</span>
                </div>
                <div class="holiday-name">${holiday.name}</div>
                <div class="holiday-type ${holiday.type || 'national'}">${this.getHolidayTypeLabel(holiday.type)}</div>
                <button type="button" class="btn-remove" onclick="settingsManager.removeHoliday('${holiday.id}')" 
                        title="削除">×</button>
            </div>
        `).join('');
    }

    /**
     * 年度で休日をフィルター
     * @param {string} year - フィルター年度
     */
    filterHolidaysByYear(year) {
        let filteredHolidays = this.settings.holidays;

        if (year !== 'all') {
            const targetYear = parseInt(year);
            filteredHolidays = this.settings.holidays.filter(holiday => 
                new Date(holiday.date).getFullYear() === targetYear
            );
        }

        const grid = document.querySelector('.holidays-grid');
        if (grid) {
            grid.innerHTML = this.renderHolidaysGrid(filteredHolidays);
        }
    }

    /**
     * 休日を追加
     * @returns {Promise<void>}
     */
    async addHoliday() {
        const date = document.getElementById('holidayDate')?.value;
        const name = document.getElementById('holidayName')?.value;
        const type = document.getElementById('holidayType')?.value || 'national';

        if (!date || !name) {
            showNotification('日付と名称を入力してください', 'error');
            return;
        }

        // 重複チェック
        const existingHoliday = this.settings.holidays.find(h => h.date === date);
        if (existingHoliday) {
            showNotification('その日付は既に登録されています', 'error');
            return;
        }

        try {
            const holidayId = `holiday_${Date.now()}`;
            const holidayData = {
                date,
                name: name.trim(),
                type,
                createdAt: Timestamp.now(),
                createdBy: 'admin'
            };

            // Firestoreに保存
            await setDoc(doc(db, 'holidays', holidayId), holidayData);

            // ローカルキャッシュを更新
            const holiday = { id: holidayId, ...holidayData };
            this.settings.holidays.push(holiday);
            this.holidaysCache.set(holidayId, holiday);

            // ソート
            this.settings.holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

            // UI更新
            this.renderHolidaysList();
            this.clearHolidayForm();

            showNotification('休日が追加されました', 'success');

        } catch (error) {
            console.error('休日追加エラー:', error);
            showNotification('休日の追加に失敗しました', 'error');
        }
    }

    /**
     * 休日を削除
     * @param {string} holidayId - 休日ID
     * @returns {Promise<void>}
     */
    async removeHoliday(holidayId) {
        const holiday = this.holidaysCache.get(holidayId);
        if (!holiday) return;

        if (!confirm(`「${holiday.name}」を削除しますか？`)) {
            return;
        }

        try {
            // Firestoreから削除
            await setDoc(doc(db, 'holidays', holidayId), { deleted: true, deletedAt: Timestamp.now() });

            // ローカルキャッシュから削除
            this.settings.holidays = this.settings.holidays.filter(h => h.id !== holidayId);
            this.holidaysCache.delete(holidayId);

            // UI更新
            this.renderHolidaysList();

            showNotification('休日が削除されました', 'success');

        } catch (error) {
            console.error('休日削除エラー:', error);
            showNotification('休日の削除に失敗しました', 'error');
        }
    }

    /**
     * 休日を一括インポート
     * @returns {Promise<void>}
     */
    async importHolidays() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const content = await this.readFile(file);
                const holidays = this.parseHolidayFile(content, file.type);
                
                if (holidays.length === 0) {
                    showNotification('有効な休日データが見つかりませんでした', 'error');
                    return;
                }

                await this.batchImportHolidays(holidays);
                
            } catch (error) {
                console.error('休日インポートエラー:', error);
                showNotification('ファイルの読み込みに失敗しました', 'error');
            }
        };

        input.click();
    }

    /**
     * 休日をエクスポート
     */
    exportHolidays() {
        const csv = this.generateHolidaysCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `holidays_${new Date().getFullYear()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('休日データをエクスポートしました', 'success');
    }

    /**
     * 休日CSVを生成
     * @returns {string} CSV文字列
     */
    generateHolidaysCSV() {
        const headers = ['日付', '名称', '種別'];
        const rows = this.settings.holidays.map(holiday => [
            holiday.date,
            holiday.name,
            this.getHolidayTypeLabel(holiday.type)
        ]);

        return [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    }

    /**
     * ファイルを読み込み
     * @param {File} file - ファイル
     * @returns {Promise<string>} ファイル内容
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * 休日ファイルをパース
     * @param {string} content - ファイル内容
     * @param {string} fileType - ファイルタイプ
     * @returns {Array} 休日データ
     */
    parseHolidayFile(content, fileType) {
        if (fileType.includes('json')) {
            return JSON.parse(content);
        } else {
            // CSV形式
            const lines = content.split('\n');
            const holidays = [];
            
            for (let i = 1; i < lines.length; i++) {
                const [date, name, type] = lines[i].split(',').map(cell => cell.replace(/"/g, ''));
                if (date && name) {
                    holidays.push({ date, name, type: type || 'national' });
                }
            }
            
            return holidays;
        }
    }

    /**
     * 休日を一括インポート
     * @param {Array} holidays - 休日データ
     * @returns {Promise<void>}
     */
    async batchImportHolidays(holidays) {
        let importCount = 0;
        let skipCount = 0;

        for (const holiday of holidays) {
            // 重複チェック
            const existing = this.settings.holidays.find(h => h.date === holiday.date);
            if (existing) {
                skipCount++;
                continue;
            }

            try {
                const holidayId = `holiday_${Date.now()}_${importCount}`;
                const holidayData = {
                    ...holiday,
                    createdAt: Timestamp.now(),
                    createdBy: 'admin_import'
                };

                await setDoc(doc(db, 'holidays', holidayId), holidayData);

                this.settings.holidays.push({ id: holidayId, ...holidayData });
                this.holidaysCache.set(holidayId, { id: holidayId, ...holidayData });
                
                importCount++;

            } catch (error) {
                console.error(`休日インポートエラー (${holiday.date}):`, error);
            }
        }

        // ソート
        this.settings.holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

        // UI更新
        this.renderHolidaysList();

        showNotification(
            `${importCount}件の休日をインポートしました（スキップ: ${skipCount}件）`, 
            'success'
        );
    }

    /**
     * 休日フォームをクリア
     */
    clearHolidayForm() {
        const dateInput = document.getElementById('holidayDate');
        const nameInput = document.getElementById('holidayName');
        const typeSelect = document.getElementById('holidayType');

        if (dateInput) dateInput.value = '';
        if (nameInput) nameInput.value = '';
        if (typeSelect) typeSelect.value = 'national';
    }

    /**
     * 変更マークをクリア
     */
    clearChangedMark() {
        const indicator = document.querySelector('.settings-changed-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * 曜日の日本語表記を取得
     * @param {Date} date - 日付
     * @returns {string} 曜日
     */
    getWeekdayJa(date) {
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return weekdays[date.getDay()];
    }

    /**
     * 休日種別のラベルを取得
     * @param {string} type - 休日種別
     * @returns {string} ラベル
     */
    getHolidayTypeLabel(type) {
        const labels = {
            national: '国民の祝日',
            company: '会社休日',
            special: '特別休日',
            other: 'その他'
        };
        return labels[type] || labels.national;
    }

    /**
     * 現在の設定を取得
     * @returns {Object} 設定オブジェクト
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * 特定の日が休日かチェック
     * @param {Date} date - チェック対象日
     * @returns {boolean} 休日かどうか
     */
    isHoliday(date) {
        const dateStr = date.toISOString().split('T')[0];
        return this.settings.holidays.some(holiday => holiday.date === dateStr);
    }
}

// グローバルインスタンス
export const settingsManager = new SettingsManager();

/**
 * モジュール初期化関数
 * HTMLから呼び出し可能なラッパー関数
 */
export function initializeSettingsModule() {
    // settingsManager.init()は自動実行されるため、ここでは何もしない
    // このexport関数はHTMLからのimportに必要

    // HTMLのonclickから呼び出せるようにグローバル関数として公開
    window.saveSettings = () => settingsManager.saveSettings();
    window.settingsManager = settingsManager;

    console.log('✅ Settings module initialized');
}

// 自動初期化（DOM読み込み完了後）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => settingsManager.init());
} else {
    settingsManager.init();
}

export default SettingsManager;
