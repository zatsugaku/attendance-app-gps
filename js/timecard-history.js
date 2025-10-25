/**
 * 履歴表示モジュール - 従業員タイムカード用
 *
 * 機能:
 * - 過去の記録表示
 * - 日付フィルタリング
 * - 日別勤務時間集計
 */

import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase インスタンス
const db = getFirestore();

// DOM要素
let showHistoryBtn, historyArea, closeHistoryBtn;
let historyStartDate, historyEndDate, loadHistoryBtn, historyRecordsEl;

/**
 * 勤務時間の計算（外出時間を除外）
 * @param {Array} records - 打刻記録
 * @returns {Object|null} 勤務時間情報
 */
function calculateWorkTime(records) {
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
    let totalMs = endTime - startTime;

    // 外出時間を計算して除外
    let breakMs = 0;
    const breakPairs = [];

    // 外出・戻りのペアを作成
    for (let i = 0; i < records.length; i++) {
        if (records[i].type === 'break_start') {
            // 対応する戻りを探す
            for (let j = i + 1; j < records.length; j++) {
                if (records[j].type === 'break_end') {
                    breakPairs.push({
                        start: records[i].timestamp,
                        end: records[j].timestamp
                    });
                    break;
                }
            }
        }
    }

    // 外出時間の合計を計算
    breakPairs.forEach(pair => {
        breakMs += (pair.end - pair.start);
    });

    // 実勤務時間 = 総経過時間 - 外出時間
    const workMs = totalMs - breakMs;

    // 分に変換
    const totalMinutes = Math.floor(workMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
        hours: hours,
        minutes: minutes,
        isFinished: !!clockOut,
        isOnBreak: records.length > 0 && records[records.length - 1].type === 'break_start'
    };
}

/**
 * 過去の記録を取得して表示
 * @param {Object} currentUser - 現在のユーザー
 */
async function loadHistoryRecords(currentUser) {
    if (!currentUser) return;

    const startDate = historyStartDate.value ? new Date(historyStartDate.value) : null;
    const endDate = historyEndDate.value ? new Date(historyEndDate.value) : null;

    if (!startDate || !endDate) {
        alert('開始日と終了日を選択してください');
        return;
    }

    const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 60) {
        alert('期間は60日以内で指定してください');
        return;
    }

    if (startDate > endDate) {
        alert('開始日は終了日より前の日付を選択してください');
        return;
    }

    try {
        historyRecordsEl.innerHTML = '<p style="color: #666; text-align: center;">読み込み中...</p>';

        endDate.setHours(23, 59, 59, 999);

        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', currentUser.uid),
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate)),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyRecordsEl.innerHTML = '<p style="color: #666; text-align: center;">この期間の記録はありません</p>';
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

        // 日付ごとにグループ化
        const groupedByDate = {};
        records.forEach(record => {
            const dateKey = record.timestamp.toLocaleDateString('ja-JP');
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(record);
        });

        // HTML生成
        historyRecordsEl.innerHTML = Object.entries(groupedByDate).map(([date, dateRecords]) => {
            const workTime = calculateWorkTime(dateRecords);
            const workDurationText = workTime ? `${workTime.hours}時間${workTime.minutes}分` : '-';

            const typeConfig = {
                'clock_in': { icon: '🟢', label: '出勤', class: 'clock-in' },
                'clock_out': { icon: '🏠', label: '退勤', class: 'clock-out' },
                'break_start': { icon: '☕', label: '外出', class: 'break-start' },
                'break_end': { icon: '🔙', label: '戻り', class: 'break-end' }
            };

            const recordsHtml = dateRecords.map(record => {
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

            return `
                <div class="day-group">
                    <div class="day-header">
                        <span>${date}</span>
                        <span class="work-duration">${workDurationText}</span>
                    </div>
                    ${recordsHtml}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('履歴取得エラー:', error);
        historyRecordsEl.innerHTML = '<p style="color: #f44336; text-align: center;">記録の取得に失敗しました</p>';
    }
}

/**
 * 履歴表示モジュールの初期化
 * @param {Object} currentUser - 現在のユーザー
 */
export function initializeHistoryModule(currentUser) {
    // DOM要素を取得
    showHistoryBtn = document.getElementById('showHistoryBtn');
    historyArea = document.getElementById('historyArea');
    closeHistoryBtn = document.getElementById('closeHistoryBtn');
    historyStartDate = document.getElementById('historyStartDate');
    historyEndDate = document.getElementById('historyEndDate');
    loadHistoryBtn = document.getElementById('loadHistoryBtn');
    historyRecordsEl = document.getElementById('historyRecords');

    // 日付のデフォルト設定(過去60日間)
    const today = new Date();
    if (historyEndDate) {
        historyEndDate.valueAsDate = today;
    }

    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(today.getDate() - 60);
    if (historyStartDate) {
        historyStartDate.valueAsDate = sixtyDaysAgo;
    }

    // 過去の記録エリアの表示/非表示
    if (showHistoryBtn) {
        showHistoryBtn.addEventListener('click', () => {
            if (historyArea) historyArea.style.display = 'block';
            showHistoryBtn.style.display = 'none';
        });
    }

    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            if (historyArea) historyArea.style.display = 'none';
            if (showHistoryBtn) showHistoryBtn.style.display = 'block';
        });
    }

    // 表示ボタン
    if (loadHistoryBtn) {
        loadHistoryBtn.addEventListener('click', () => loadHistoryRecords(currentUser));
    }

    console.log('📋 History module initialized');
}
