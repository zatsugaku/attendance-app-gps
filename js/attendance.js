/**
 * 打刻管理機能モジュール
 * 
 * 主な機能:
 * - loadRecords: 打刻記録の読み込み
 * - applyFilters: フィルター適用
 * - deleteRecord: 打刻削除
 * - exportToCSV: CSV出力
 * - displayRecords: 記録表示
 * 
 * 依存関係: Firebase Firestore, DOM操作
 */

import { 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    doc, 
    deleteDoc, 
    Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ========================================
// グローバル変数とユーティリティ関数
// ========================================

let allRecords = [];
let allEmployees = []; // 全従業員リスト
let currentFilters = {
    displayDate: null,
    employee: '',
    type: ''
};

/**
 * 日付をinput[type="date"]用フォーマットに変換
 * @param {Date} date - 変換する日付
 * @returns {string} YYYY-MM-DD形式の文字列
 */
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * メッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ (success/error/info)
 */
function showMessage(message, type = 'success') {
    const messageArea = document.getElementById('messageArea');
    if (messageArea) {
        messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
        setTimeout(() => { 
            messageArea.innerHTML = ''; 
        }, 5000);
    }
}

// ========================================
// 従業員データ読み込み機能
// ========================================

/**
 * 全従業員データを読み込み
 * @param {Object} db - Firestore データベースインスタンス
 */
async function loadAllEmployees(db) {
    try {
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);

        allEmployees = [];
        usersSnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            allEmployees.push({
                uid: docSnap.id,
                name: userData.userName || userData.name || '不明',
                email: userData.email || '',
                employeeNumber: userData.employeeNumber || userData.staffNumber || 999,
                role: userData.role || 'employee'
            });
        });

        // 従業員番号でソート
        allEmployees.sort((a, b) => {
            const numA = parseInt(a.employeeNumber) || 999;
            const numB = parseInt(b.employeeNumber) || 999;
            return numA - numB;
        });

        console.log('従業員データ取得完了:', allEmployees.length + '人');
    } catch (error) {
        console.error('従業員データ読み込みエラー:', error);
    }
}

// ========================================
// 打刻記録読み込み機能
// ========================================

/**
 * 全ての打刻記録を読み込み
 * @param {Object} db - Firestore データベースインスタンス
 * @param {boolean} preserveFilters - フィルター状態を保持するかどうか
 */
export async function loadRecords(db, preserveFilters = false) {
    try {
        let displayDate;

        // フィルター状態の処理
        if (preserveFilters && currentFilters.displayDate) {
            displayDate = new Date(currentFilters.displayDate);

            // DOM要素への反映
            const displayDateEl = document.getElementById('displayDate');
            const employeeFilterEl = document.getElementById('employeeFilter');
            const typeFilterEl = document.getElementById('typeFilter');

            if (displayDateEl) displayDateEl.value = currentFilters.displayDate;
            if (employeeFilterEl) employeeFilterEl.value = currentFilters.employee;
            if (typeFilterEl) typeFilterEl.value = currentFilters.type;
        } else {
            // 初回読み込み時は今日の日付を設定
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            displayDate = new Date(today);

            const displayDateEl = document.getElementById('displayDate');

            if (displayDateEl) displayDateEl.value = formatDateForInput(today);

            currentFilters.displayDate = formatDateForInput(today);
        }

        // 時刻範囲設定（1日分）
        const startDate = new Date(displayDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(displayDate);
        endDate.setHours(23, 59, 59, 999);

        // Firestoreクエリ実行
        const q = query(
            collection(db, 'attendance'),
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate)),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        allRecords = [];
        
        querySnapshot.forEach((docSnap) => {
            allRecords.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        // 従業員データを取得
        await loadAllEmployees(db);

        // フィルター適用
        let filtered = allRecords;
        if (preserveFilters && currentFilters.employee) {
            filtered = filtered.filter(r => r.userName === currentFilters.employee);
        }
        if (preserveFilters && currentFilters.type) {
            filtered = filtered.filter(r => r.type === currentFilters.type);
        }

        // UI更新
        updateStats();
        updateEmployeeFilter();
        displayRecords(filtered);
        
    } catch (error) {
        console.error('打刻記録読み込みエラー:', error);
        const recordsTableBody = document.getElementById('recordsTableBody');
        if (recordsTableBody) {
            recordsTableBody.innerHTML = 
                '<tr><td colspan="6" style="text-align: center; color: #f44336; padding: 50px;">記録の読み込みに失敗しました</td></tr>';
        }
        showMessage('❌ 記録の読み込みに失敗しました', 'error');
    }
}

// ========================================
// 統計情報更新機能
// ========================================

/**
 * 統計情報を更新（本日の打刻状況など）
 */
function updateStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 本日の記録をフィルタリング
    const todayRecords = allRecords.filter(record => {
        const recordDate = record.timestamp?.toDate();
        return recordDate >= today && recordDate < tomorrow;
    });

    // 統計値を更新
    const totalRecordsEl = document.getElementById('totalRecords');
    const todayClockInEl = document.getElementById('todayClockIn');
    const todayClockOutEl = document.getElementById('todayClockOut');
    const todayBreaksEl = document.getElementById('todayBreaks');

    if (totalRecordsEl) totalRecordsEl.textContent = allRecords.length;
    if (todayClockInEl) todayClockInEl.textContent = todayRecords.filter(r => r.type === 'clock_in').length;
    if (todayClockOutEl) todayClockOutEl.textContent = todayRecords.filter(r => r.type === 'clock_out').length;
    if (todayBreaksEl) todayBreaksEl.textContent = todayRecords.filter(r => r.type === 'break_start').length;
}

/**
 * 従業員フィルターのオプションを更新
 */
function updateEmployeeFilter() {
    const employeeFilter = document.getElementById('employeeFilter');
    if (!employeeFilter) return;

    // 重複を除いた従業員名リストを取得
    const employees = [...new Set(allRecords.map(r => r.userName))].sort();
    
    employeeFilter.innerHTML = '<option value="">全従業員</option>';
    employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee;
        option.textContent = employee;
        employeeFilter.appendChild(option);
    });
}

// ========================================
// 勤務時間計算機能
// ========================================

/**
 * 指定した日の勤務時間を計算
 * @param {Array} records - 打刻記録配列
 * @param {string} userId - ユーザーID
 * @param {string} date - 計算対象日（日本語形式）
 * @returns {string|null} 勤務時間（例: "8時間30分"）
 */
function calculateWorkTime(records, userId, date) {
    // 指定日の記録をフィルタリング・ソート
    const dayRecords = records.filter(r => {
        const recordDate = r.timestamp.toDate().toLocaleDateString('ja-JP');
        return r.userId === userId && recordDate === date;
    }).sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());

    if (dayRecords.length === 0) return null;

    // 出勤・退勤記録を取得
    const clockIn = dayRecords.find(r => r.type === 'clock_in');
    const clockOut = dayRecords.find(r => r.type === 'clock_out');
    
    if (!clockIn) return null;

    // 勤務時間計算（退勤なしの場合は現在時刻まで）
    const startTime = clockIn.timestamp.toDate();
    const endTime = clockOut ? clockOut.timestamp.toDate() : new Date();
    let totalMs = endTime - startTime;

    // 外出時間を差し引き
    let breakMs = 0;
    for (let i = 0; i < dayRecords.length; i++) {
        if (dayRecords[i].type === 'break_start') {
            // 対応する戻りを検索
            for (let j = i + 1; j < dayRecords.length; j++) {
                if (dayRecords[j].type === 'break_end') {
                    breakMs += (dayRecords[j].timestamp.toDate() - dayRecords[i].timestamp.toDate());
                    break;
                }
            }
        }
    }

    // 正味勤務時間を計算
    const workMs = totalMs - breakMs;
    const totalMinutes = Math.floor(workMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}時間${minutes}分`;
}

// ========================================
// 記録表示機能
// ========================================

/**
 * 打刻記録をテーブルに表示（従業員ごとにグループ化）
 * @param {Array} records - 表示する記録配列
 */
export function displayRecords(records) {
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) return;

    // 従業員データがまだ読み込まれていない場合
    if (allEmployees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999; padding: 50px;">従業員データを読み込み中...</td></tr>';
        return;
    }

    // 打刻記録を日付・ユーザーでグルーピング
    const recordsMap = {};

    records.forEach(record => {
        const timestamp = record.timestamp.toDate();
        const dateKey = `${timestamp.getFullYear()}/${timestamp.getMonth() + 1}/${timestamp.getDate()}`;
        const userName = record.userName || '不明';
        const key = `${dateKey}_${userName}`;

        if (!recordsMap[key]) {
            recordsMap[key] = {
                clockIn: null,
                clockOut: null
            };
        }

        if (record.type === 'clock_in') {
            recordsMap[key].clockIn = record;
        } else if (record.type === 'clock_out') {
            recordsMap[key].clockOut = record;
        }
    });

    // 表示対象の日付を取得（選択された日付）
    const displayDateValue = document.getElementById('displayDate')?.value;
    const todayDate = displayDateValue ? new Date(displayDateValue + 'T00:00:00') : new Date();
    const today = `${todayDate.getFullYear()}/${todayDate.getMonth() + 1}/${todayDate.getDate()}`;

    // 全従業員分の行を生成（従業員番号順）
    const grouped = allEmployees.map(employee => {
        const key = `${today}_${employee.name}`;
        const recordData = recordsMap[key] || { clockIn: null, clockOut: null };

        return {
            date: today,
            userName: employee.name,
            userId: employee.uid,
            employeeNumber: employee.employeeNumber,
            clockIn: recordData.clockIn,
            clockOut: recordData.clockOut
        };
    });

    // テーブル行を生成
    const rows = Object.values(grouped).map(group => {
        const clockInTime = group.clockIn ?
            group.clockIn.timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) :
            '-';

        // 退勤時刻の表示ロジック
        let clockOutTime = '-';
        if (group.clockIn && !group.clockOut) {
            // 出勤あり・退勤なし → 勤務中
            clockOutTime = '<span style="color: #667eea; font-weight: bold;">勤務中</span>';
        } else if (group.clockOut) {
            // 退勤あり
            clockOutTime = group.clockOut.timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        }

        // 勤務時間計算
        let duration = '-';
        if (group.clockIn && group.clockOut) {
            const totalMs = group.clockOut.timestamp.toDate() - group.clockIn.timestamp.toDate();
            const totalMinutes = Math.floor(totalMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            duration = `<span class="duration-badge">${hours}時間${minutes}分</span>`;
        }

        // GPS位置情報を表示（index_timecard.htmlではaddressフィールドとして保存される）
        const gpsLocation = group.clockIn?.address || group.clockOut?.address || '-';

        // 統合編集ボタン（1つのボタンで全打刻を管理）
        const recordsData = JSON.stringify({
            date: group.date,
            userName: group.userName,
            userId: group.userId,
            clockIn: group.clockIn ? {
                id: group.clockIn.id,
                time: group.clockIn.timestamp.toDate().toISOString()
            } : null,
            clockOut: group.clockOut ? {
                id: group.clockOut.id,
                time: group.clockOut.timestamp.toDate().toISOString()
            } : null
        }).replace(/"/g, '&quot;');

        return `
            <tr>
                <td>${group.date}</td>
                <td>${group.userName}</td>
                <td>${clockInTime}</td>
                <td>${clockOutTime}</td>
                <td>${duration}</td>
                <td style="font-size: 13px; color: #666;">${gpsLocation}</td>
                <td>
                    <button class="button button-primary button-small" onclick='openUnifiedEditModal(${recordsData})'>
                        編集
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.join('');
}

// ========================================
// フィルター機能
// ========================================

/**
 * フィルターを適用して記録を絞り込み
 * @param {Object} db - Firestore データベースインスタンス
 */
export async function applyFilters(db) {
    const displayDate = document.getElementById('displayDate')?.value;
    const employeeFilter = document.getElementById('employeeFilter')?.value;
    const typeFilter = document.getElementById('typeFilter')?.value;

    // バリデーション
    if (!displayDate) {
        alert('日付を選択してください');
        return;
    }

    // フィルター状態を保存
    currentFilters = {
        displayDate,
        employee: employeeFilter || '',
        type: typeFilter || ''
    };

    try {
        // 日付範囲設定（1日分）
        const start = new Date(displayDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(displayDate);
        end.setHours(23, 59, 59, 999);

        // Firestoreクエリ
        const q = query(
            collection(db, 'attendance'),
            where('timestamp', '>=', Timestamp.fromDate(start)),
            where('timestamp', '<=', Timestamp.fromDate(end)),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        allRecords = [];

        querySnapshot.forEach((docSnap) => {
            allRecords.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        // 従業員データを取得
        await loadAllEmployees(db);

        // フィルター適用
        let filtered = allRecords;
        if (employeeFilter) {
            filtered = filtered.filter(r => r.userName === employeeFilter);
        }
        if (typeFilter) {
            filtered = filtered.filter(r => r.type === typeFilter);
        }

        // UI更新
        updateStats();
        updateEmployeeFilter();
        displayRecords(filtered);
        
        showMessage(`✅ ${filtered.length}件の記録を表示中`, 'success');
        
    } catch (error) {
        console.error('フィルター適用エラー:', error);
        showMessage('❌ 絞り込みに失敗しました', 'error');
    }
}

/**
 * フィルターをリセットして今日の記録を表示
 * @param {Object} db - Firestore データベースインスタンス
 */
export async function resetFilters(db) {
    // フォーム要素をリセット
    const today = new Date();
    const todayStr = formatDateForInput(today);

    const displayDateEl = document.getElementById('displayDate');
    const employeeFilterEl = document.getElementById('employeeFilter');
    const typeFilterEl = document.getElementById('typeFilter');

    if (displayDateEl) displayDateEl.value = todayStr;
    if (employeeFilterEl) employeeFilterEl.value = '';
    if (typeFilterEl) typeFilterEl.value = '';

    // フィルター状態をリセット
    currentFilters = {
        displayDate: todayStr,
        employee: '',
        type: ''
    };

    // 記録を再読み込み
    await loadRecords(db, false);
    showMessage('✅ フィルターをリセットしました', 'info');
}

/**
 * 日付を変更（前日/翌日ボタン用）
 * @param {Object} db - Firestore データベースインスタンス
 * @param {number} days - 変更する日数（-1=前日, 1=翌日）
 */
export async function changeDate(db, days) {
    const displayDateInput = document.getElementById('displayDate');
    const currentValue = displayDateInput?.value;
    if (!currentValue) return;

    const [year, month, day] = currentValue.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    currentDate.setDate(currentDate.getDate() + days);

    const newYear = currentDate.getFullYear();
    const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const newDay = String(currentDate.getDate()).padStart(2, '0');
    const newDateStr = `${newYear}-${newMonth}-${newDay}`;

    displayDateInput.value = newDateStr;
    currentFilters.displayDate = newDateStr;

    await applyFilters(db);
}

/**
 * 今日に戻る
 * @param {Object} db - Firestore データベースインスタンス
 */
export async function goToToday(db) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const displayDateInput = document.getElementById('displayDate');
    if (displayDateInput) {
        displayDateInput.value = todayStr;
    }

    document.getElementById('employeeFilter').value = '';
    document.getElementById('typeFilter').value = '';

    currentFilters.displayDate = todayStr;
    currentFilters.employee = '';
    currentFilters.type = '';

    await applyFilters(db);
}

// ========================================
// 削除機能
// ========================================

/**
 * 打刻記録を削除
 * @param {Object} db - Firestore データベースインスタンス
 * @param {string} recordId - 削除対象のレコードID
 * @param {string} userName - ユーザー名（確認表示用）
 * @param {string} type - 打刻種別（確認表示用）
 * @param {string} datetime - 日時（確認表示用）
 */
export async function deleteRecord(db, recordId, userName, type, datetime) {
    // 削除確認
    const confirmMessage = `以下の記録を削除しますか?\n\n従業員: ${userName}\n種別: ${type}\n日時: ${datetime}\n\nこの操作は取り消せません。`;
    
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        // Firestoreから削除
        await deleteDoc(doc(db, 'attendance', recordId));
        
        showMessage('✅ 記録を削除しました', 'success');
        
        // 記録一覧を再読み込み（フィルター状態を保持）
        await loadRecords(db, true);
        
    } catch (error) {
        console.error('削除エラー:', error);
        showMessage('❌ 削除に失敗しました: ' + error.message, 'error');
    }
}

// ========================================
// CSV出力機能
// ========================================

/**
 * 現在表示中の記録をCSVファイルとしてエクスポート（従業員ごとにグループ化）
 */
export function exportToCSV() {
    if (allEmployees.length === 0) {
        alert('従業員データが読み込まれていません');
        return;
    }

    // 打刻記録をマップに変換
    const recordsMap = {};

    allRecords.forEach(record => {
        const timestamp = record.timestamp.toDate();
        const dateKey = `${timestamp.getFullYear()}/${timestamp.getMonth() + 1}/${timestamp.getDate()}`;
        const userName = record.userName || '不明';
        const key = `${dateKey}_${userName}`;

        if (!recordsMap[key]) {
            recordsMap[key] = {
                clockIn: null,
                clockOut: null
            };
        }

        if (record.type === 'clock_in') {
            recordsMap[key].clockIn = record;
        } else if (record.type === 'clock_out') {
            recordsMap[key].clockOut = record;
        }
    });

    // 表示対象の日付を取得
    const displayDateValue = document.getElementById('displayDate')?.value;
    const todayDate = displayDateValue ? new Date(displayDateValue + 'T00:00:00') : new Date();
    const today = `${todayDate.getFullYear()}/${todayDate.getMonth() + 1}/${todayDate.getDate()}`;

    // 全従業員分のデータを生成（従業員番号順）
    const grouped = allEmployees.map(employee => {
        const key = `${today}_${employee.name}`;
        const recordData = recordsMap[key] || { clockIn: null, clockOut: null };

        return {
            date: today,
            userName: employee.name,
            employeeNumber: employee.employeeNumber,
            clockIn: recordData.clockIn,
            clockOut: recordData.clockOut
        };
    });

    let csv = '日付,従業員名,出勤時刻,退勤時刻,勤務時間,GPS位置\n';

    grouped.forEach(group => {
        const clockInTime = group.clockIn ?
            group.clockIn.timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) :
            '';

        const clockOutTime = group.clockIn ?
            (group.clockOut ?
                group.clockOut.timestamp.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) :
                '') :
            '';

        let duration = '';
        if (group.clockIn && group.clockOut) {
            const totalMs = group.clockOut.timestamp.toDate() - group.clockIn.timestamp.toDate();
            const totalMinutes = Math.floor(totalMs / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            duration = `${hours}時間${minutes}分`;
        }

        const gpsLocation = group.clockIn?.address || group.clockOut?.address || '';

        // CSVエスケープ処理
        const escapeCsv = (str) => `"${String(str).replace(/"/g, '""')}"`;

        csv += `${group.date},${escapeCsv(group.userName)},${clockInTime},${clockOutTime},${duration},${escapeCsv(gpsLocation)}\n`;
    });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // ファイル名生成（表示日付を含む）
    const displayDate = currentFilters.displayDate || formatDateForInput(new Date());
    const filename = `打刻記録_${displayDate}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    showMessage(`✅ CSVファイルをダウンロードしました（${grouped.length}人分）`, 'success');
}

// ========================================
// グローバル関数のエクスポート（window経由）
// ========================================

/**
 * モジュールの初期化とグローバル関数の設定
 * HTMLから直接呼び出せるように window オブジェクトに関数を設定
 * @param {Object} db - Firestore データベースインスタンス
 */
export function initializeAttendanceModule(db) {
    // グローバル関数として設定
    window.filterRecords = () => applyFilters(db);
    window.resetFilters = () => resetFilters(db);
    window.changeDate = (days) => changeDate(db, days);
    window.goToToday = () => goToToday(db);
    window.deleteRecord = (recordId, userName, type, datetime) =>
        deleteRecord(db, recordId, userName, type, datetime);
    window.exportToCSV = exportToCSV;

    // loadRecordsもグローバルに公開
    window.loadRecords = (preserveFilters) => loadRecords(db, preserveFilters);

    // 初回読み込み（今日の記録を表示）
    loadRecords(db, false);

    console.log('✅ 打刻管理モジュールが初期化されました');
}

// ========================================
// デフォルトエクスポート
// ========================================

export default {
    loadRecords,
    applyFilters,
    resetFilters,
    deleteRecord,
    exportToCSV,
    displayRecords,
    initializeAttendanceModule
};
