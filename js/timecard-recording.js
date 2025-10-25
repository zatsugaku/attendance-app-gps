/**
 * 打刻記録モジュール - 従業員タイムカード用
 *
 * 機能:
 * - 出勤・退勤・外出・戻りの打刻
 * - 本日の打刻記録の取得
 * - ボタン状態の制御
 * - 記録表示
 */

import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    Timestamp,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase インスタンス
const db = getFirestore();

// DOM要素
let clockInBtn, clockOutBtn, breakStartBtn, breakEndBtn;
let todayRecordsEl, messageArea;

// キャッシュ
let todayRecordsCache = [];

/**
 * 本日の打刻記録キャッシュを取得
 * @returns {Array} 本日の記録
 */
export function getTodayRecordsCache() {
    return todayRecordsCache;
}

/**
 * メッセージ表示
 * @param {string} message - メッセージ
 * @param {string} type - タイプ (success/error/info)
 */
function showMessage(message, type = 'success') {
    if (messageArea) {
        messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
        setTimeout(() => {
            messageArea.innerHTML = '';
        }, 5000);
    }
}

/**
 * 記録を表示
 * @param {Array} records - 打刻記録
 * @param {HTMLElement} targetElement - 表示対象の要素
 */
function displayRecords(records, targetElement) {
    const typeConfig = {
        'clock_in': { icon: '🟢', label: '出勤', class: 'clock-in' },
        'clock_out': { icon: '🏠', label: '退勤', class: 'clock-out' },
        'break_start': { icon: '☕', label: '外出', class: 'break-start' },
        'break_end': { icon: '🔙', label: '戻り', class: 'break-end' }
    };

    targetElement.innerHTML = records.map(record => {
        const config = typeConfig[record.type];
        const time = record.timestamp.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="record-item ${config.class}">
                <div class="record-header">
                    <span>${config.icon}</span>
                    <span>${config.label}</span>
                    <span style="margin-left: auto;">${time}</span>
                </div>
                <div class="record-time">
                    💻 ${record.pcIdentifier || 'PC情報なし'}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * ボタンの状態を更新
 * @param {Array} records - 打刻記録
 */
function updateButtonStates(records) {
    clockInBtn.disabled = true;
    clockOutBtn.disabled = true;
    breakStartBtn.disabled = true;
    breakEndBtn.disabled = true;

    if (records.length === 0) {
        clockInBtn.disabled = false;
        messageArea.innerHTML = '';
        return;
    }

    const lastRecord = records[records.length - 1];
    console.log('最後の打刻:', lastRecord.type);

    const hasClockIn = records.some(r => r.type === 'clock_in');
    const hasClockOut = records.some(r => r.type === 'clock_out');

    if (hasClockOut) {
        messageArea.innerHTML = '<div class="message success">✅ 本日の打刻は完了しました。お疲れ様でした!</div>';
        return;
    }

    if (hasClockIn) {
        clockOutBtn.disabled = false;

        if (lastRecord.type === 'clock_in') {
            console.log('→ 外出のみ有効');
            breakStartBtn.disabled = false;
            breakEndBtn.disabled = true;
        } else if (lastRecord.type === 'break_start') {
            console.log('→ 戻りのみ有効');
            breakStartBtn.disabled = true;
            breakEndBtn.disabled = false;
        } else if (lastRecord.type === 'break_end') {
            console.log('→ 外出のみ有効');
            breakStartBtn.disabled = false;
            breakEndBtn.disabled = true;
        }

        messageArea.innerHTML = '<div class="message info">出勤済みです。退勤時に「退勤」ボタンを押してください。</div>';
    } else {
        clockInBtn.disabled = false;
        messageArea.innerHTML = '';
    }
}

/**
 * 本日の打刻記録を取得
 * @param {Object} currentUser - 現在のユーザー
 * @param {Function} workTimeUpdateCallback - 勤務時間更新コールバック
 */
export async function loadTodayRecords(currentUser, workTimeUpdateCallback) {
    if (!currentUser) return;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', currentUser.uid),
            where('timestamp', '>=', Timestamp.fromDate(today)),
            where('timestamp', '<', Timestamp.fromDate(tomorrow)),
            orderBy('timestamp', 'asc')
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            todayRecordsEl.innerHTML = '<p style="color: #666; text-align: center;">まだ打刻記録がありません</p>';
            todayRecordsCache = [];
            updateButtonStates([]);

            // 勤務時間表示を更新
            if (workTimeUpdateCallback) {
                workTimeUpdateCallback([], false);
            }
            return;
        }

        const records = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            records.push({
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
            });
        });

        console.log('本日の記録:', records.map(r => r.type));
        todayRecordsCache = records;
        updateButtonStates(records);
        displayRecords(records, todayRecordsEl);

        // 勤務時間表示を更新
        const hasClockOut = records.some(r => r.type === 'clock_out');
        if (workTimeUpdateCallback) {
            workTimeUpdateCallback(records, !hasClockOut);
        }

    } catch (error) {
        console.error('本日の記録取得エラー:', error);
        todayRecordsEl.innerHTML = '<p style="color: #f44336; text-align: center;">記録の取得に失敗しました</p>';
    }
}

/**
 * 打刻処理(共通関数) - 連打防止機能付き
 * @param {string} type - 打刻タイプ
 * @param {Object} currentUser - 現在のユーザー
 * @param {string} pcInfo - PC識別情報
 * @param {Function} workTimeUpdateCallback - 勤務時間更新コールバック
 */
async function recordAttendance(type, currentUser, pcInfo, workTimeUpdateCallback) {
    // 全ボタンを一時的に無効化
    clockInBtn.disabled = true;
    clockOutBtn.disabled = true;
    breakStartBtn.disabled = true;
    breakEndBtn.disabled = true;

    try {
        await addDoc(collection(db, 'attendance'), {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            email: currentUser.email,
            type: type,
            timestamp: serverTimestamp(),
            pcIdentifier: pcInfo,
            isManualEntry: false
        });

        const typeLabels = {
            'clock_in': '出勤',
            'clock_out': '退勤',
            'break_start': '外出',
            'break_end': '戻り'
        };

        showMessage(`✅ ${typeLabels[type]}を記録しました`, 'success');

        // 少し待ってから記録を再読み込み
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadTodayRecords(currentUser, workTimeUpdateCallback);

    } catch (error) {
        console.error('記録エラー:', error);
        showMessage('記録に失敗しました', 'error');
        await loadTodayRecords(currentUser, workTimeUpdateCallback);
    }
}

/**
 * 打刻記録モジュールの初期化
 * @param {Object} currentUser - 現在のユーザー
 * @param {Function} workTimeUpdateCallback - 勤務時間更新コールバック
 */
export function initializeRecordingModule(currentUser, workTimeUpdateCallback) {
    // DOM要素を取得
    clockInBtn = document.getElementById('clockInBtn');
    clockOutBtn = document.getElementById('clockOutBtn');
    breakStartBtn = document.getElementById('breakStartBtn');
    breakEndBtn = document.getElementById('breakEndBtn');
    todayRecordsEl = document.getElementById('todayRecords');
    messageArea = document.getElementById('messageArea');

    // PC識別情報を取得
    const pcInfo = window.pcInfo || 'Unknown PC';

    // イベントリスナーを設定
    if (clockInBtn) {
        clockInBtn.addEventListener('click', () =>
            recordAttendance('clock_in', currentUser, pcInfo, workTimeUpdateCallback)
        );
    }

    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', () =>
            recordAttendance('clock_out', currentUser, pcInfo, workTimeUpdateCallback)
        );
    }

    if (breakStartBtn) {
        breakStartBtn.addEventListener('click', () =>
            recordAttendance('break_start', currentUser, pcInfo, workTimeUpdateCallback)
        );
    }

    if (breakEndBtn) {
        breakEndBtn.addEventListener('click', () =>
            recordAttendance('break_end', currentUser, pcInfo, workTimeUpdateCallback)
        );
    }

    // 初回の記録読み込み
    loadTodayRecords(currentUser, workTimeUpdateCallback);

    console.log('⏰ Recording module initialized');
}
