/**
 * 月次集計機能モジュール
 * 勤怠データの月次集計、CSV出力、Firestore保存を行う
 * 従業員ごとの個別設定を使用して勤務時間を計算
 */

import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    Timestamp, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firestoreインスタンスを取得（グローバル変数dbを使用）
const db = getFirestore();

// グローバル変数
let monthlySummaryData = [];

// デフォルト設定（フォールバック用）
const DEFAULT_SETTINGS = {
    startTime: '09:00',
    endTime: '18:00',
    breakTime: 60, // 分単位
    standardWorkTime: 8 // 時間単位
};

/**
 * 締め日に基づいて集計期間を計算
 * @param {number} year - 対象年
 * @param {number} month - 対象月
 * @param {number} closingDay - 締め日（デフォルト：25日）
 * @returns {Object} 集計期間の開始日と終了日
 */
export function calculatePeriod(year, month, closingDay = 25) {
    const periodStart = new Date(year, month - 1, closingDay + 1);
    periodStart.setMonth(periodStart.getMonth() - 1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(year, month - 1, closingDay);
    periodEnd.setHours(23, 59, 59, 999);

    return { periodStart, periodEnd };
}

/**
 * 従業員データの読み込み（個別設定を取得）
 * @returns {Object} 従業員ID別の設定データ
 */
async function loadEmployeeData() {
    try {
        console.log('従業員データ読み込み開始...');
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const employeeSettings = {};

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            employeeSettings[doc.id] = {
                displayName: data.displayName || data.email,
                // 個別設定（従業員ごとの勤務時間設定）
                startTime: data.startTime || DEFAULT_SETTINGS.startTime,
                endTime: data.endTime || DEFAULT_SETTINGS.endTime,
                breakTime: data.breakTime || DEFAULT_SETTINGS.breakTime,
                standardWorkTime: data.standardWorkTime || DEFAULT_SETTINGS.standardWorkTime
            };
            console.log(`従業員設定読み込み: ${employeeSettings[doc.id].displayName}`, employeeSettings[doc.id]);
        });

        console.log(`従業員データ読み込み完了: ${Object.keys(employeeSettings).length}名`);
        return employeeSettings;
    } catch (error) {
        console.error('従業員データ読み込みエラー:', error);
        return {};
    }
}

/**
 * 休日判定（土日祝）
 * @param {Date} date - 判定する日付
 * @returns {boolean} 休日ならtrue
 */
function isHoliday(date) {
    const day = date.getDay();
    // 土曜日(6)または日曜日(0)
    return day === 0 || day === 6;
}

/**
 * 1日分の勤務データを計算（従業員個別設定を使用）
 * @param {Array} dayRecords - その日の打刻記録
 * @param {Object} employeeConfig - 従業員の個別設定
 * @param {Date} date - 勤務日
 * @returns {Object|null} 勤務データまたはnull
 */
export function calculateDayWorkData(dayRecords, employeeConfig = null, date = null) {
    const clockIn = dayRecords.find(r => r.type === 'clock_in');
    const clockOut = dayRecords.find(r => r.type === 'clock_out');

    if (!clockIn) return null;

    const clockInTime = clockIn.timestamp.toDate();
    const clockOutTime = clockOut ? clockOut.timestamp.toDate() : null;

    if (!clockOutTime) return null; // 退勤していない日はスキップ

    // 総勤務時間計算（ミリ秒）
    const totalMs = clockOutTime - clockInTime;

    const workMinutes = Math.floor(totalMs / (1000 * 60));
    const workHours = workMinutes / 60;

    // 従業員個別設定から所定労働時間を取得（フォールバックはデフォルト設定）
    const standardWorkHours = employeeConfig?.standardWorkTime || DEFAULT_SETTINGS.standardWorkTime;

    // 残業時間計算（所定労働時間を超えた分）
    const overtimeHours = Math.max(0, workHours - standardWorkHours);
    const overtimeMinutes = Math.floor(overtimeHours * 60);

    // 従業員個別設定から始業時刻を取得（フォールバックはデフォルト設定）
    const startTime = employeeConfig?.startTime || DEFAULT_SETTINGS.startTime;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const standardStart = new Date(clockInTime);
    standardStart.setHours(startHour, startMinute, 0, 0);

    const lateMinutes = clockInTime > standardStart ? Math.floor((clockInTime - standardStart) / (1000 * 60)) : 0;
    const isLate = lateMinutes > 0;

    // 従業員個別設定から終業時刻を取得（フォールバックはデフォルト設定）
    const endTime = employeeConfig?.endTime || DEFAULT_SETTINGS.endTime;
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const standardEnd = new Date(clockOutTime);
    standardEnd.setHours(endHour, endMinute, 0, 0);

    const earlyLeaveMinutes = clockOutTime < standardEnd ? Math.floor((standardEnd - clockOutTime) / (1000 * 60)) : 0;
    const isEarlyLeave = earlyLeaveMinutes > 0;

    // 休日判定
    const workDate = date || clockInTime;
    const isHolidayWork = isHoliday(workDate);

    return {
        workMinutes,
        workHours,
        overtimeMinutes,
        overtimeHours,
        lateMinutes,
        isLate,
        earlyLeaveMinutes,
        isEarlyLeave,
        isHolidayWork
    };
}

/**
 * 期間入力フォームの表示切り替え
 */
export function togglePeriodInput() {
    const periodType = document.getElementById('periodType').value;
    const monthlySection = document.getElementById('monthlyPeriodSection');
    const customSection = document.getElementById('customPeriodSection');

    if (periodType === 'monthly') {
        monthlySection.style.display = 'flex';
        customSection.style.display = 'none';
        updatePeriodDisplay();
    } else {
        monthlySection.style.display = 'none';
        customSection.style.display = 'flex';
    }
}

/**
 * 月次集計を実行（従業員個別設定を使用）
 * @param {Object} currentUser - 現在のユーザー情報
 * @param {Function} showMessage - メッセージ表示関数
 */
export async function calculateMonthlySummary(currentUser, showMessage) {
    try {
        console.log('月次集計開始（従業員個別設定適用）...');

        const periodType = document.getElementById('periodType').value;
        const selectedUserId = document.getElementById('monthlyEmployeeFilter').value;

        let periodStart, periodEnd;

        if (periodType === 'monthly') {
            const year = parseInt(document.getElementById('targetYear').value);
            const month = parseInt(document.getElementById('targetMonth').value);
            const result = calculatePeriod(year, month);
            periodStart = result.periodStart;
            periodEnd = result.periodEnd;
        } else {
            // カスタム期間
            const startDate = document.getElementById('customStartDate').value;
            const endDate = document.getElementById('customEndDate').value;

            if (!startDate || !endDate) {
                showMessage('❌ 開始日と終了日を選択してください', 'error');
                return;
            }

            periodStart = new Date(startDate);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(endDate);
            periodEnd.setHours(23, 59, 59, 999);

            if (periodStart > periodEnd) {
                showMessage('❌ 開始日は終了日より前にしてください', 'error');
                return;
            }
        }

        console.log(`集計期間: ${periodStart.toLocaleDateString()} 〜 ${periodEnd.toLocaleDateString()}`);

        // 従業員データ（個別設定含む）を読み込み
        const employeeSettings = await loadEmployeeData();

        if (Object.keys(employeeSettings).length === 0) {
            showMessage('⚠️ 従業員データが見つかりません', 'warning');
            return;
        }

        // 期間内の全打刻データを取得
        const q = query(
            collection(db, 'attendance'),
            where('timestamp', '>=', Timestamp.fromDate(periodStart)),
            where('timestamp', '<=', Timestamp.fromDate(periodEnd)),
            orderBy('timestamp', 'asc')
        );

        console.log('勤怠データ取得中...');
        const querySnapshot = await getDocs(q);
        const allRecords = [];
        querySnapshot.forEach(docSnap => {
            allRecords.push({ id: docSnap.id, ...docSnap.data() });
        });

        console.log(`取得した勤怠データ: ${allRecords.length}件`);

        // ユーザーごとにグループ化
        const userRecordsMap = {};
        allRecords.forEach(record => {
            if (!userRecordsMap[record.userId]) {
                userRecordsMap[record.userId] = {
                    userName: record.userName,
                    records: []
                };
            }
            userRecordsMap[record.userId].records.push(record);
        });

        // 各ユーザーの月次集計を計算
        monthlySummaryData = [];
        let processedUsers = 0;

        for (const [userId, userData] of Object.entries(userRecordsMap)) {
            // フィルター適用
            if (selectedUserId && userId !== selectedUserId) continue;

            // 従業員の個別設定を取得
            const employeeConfig = employeeSettings[userId];
            
            if (!employeeConfig) {
                console.warn(`従業員設定が見つかりません: ${userId}`);
                continue;
            }

            console.log(`集計処理中: ${employeeConfig.displayName}`, employeeConfig);

            // 日付ごとにグループ化
            const dayRecordsMap = {};
            userData.records.forEach(record => {
                const dateKey = record.timestamp.toDate().toLocaleDateString('ja-JP');
                if (!dayRecordsMap[dateKey]) {
                    dayRecordsMap[dateKey] = [];
                }
                dayRecordsMap[dateKey].push(record);
            });

            // 各日の集計
            let workingDays = 0;
            let totalWorkMinutes = 0;
            let totalOvertimeMinutes = 0;
            let latenessCount = 0;
            let totalLatenessMinutes = 0;
            let earlyLeaveCount = 0;
            let totalEarlyLeaveMinutes = 0;
            let holidayWorkDays = 0;
            let holidayWorkMinutes = 0;
            let paidLeaveDays = 0;
            let absenceDays = 0;
            const usedPCs = new Set();

            for (const [dateKey, dayRecords] of Object.entries(dayRecordsMap)) {
                // 日付をDateオブジェクトに変換
                const [year, month, day] = dateKey.split('/').map(Number);
                const workDate = new Date(year, month - 1, day);

                // 有給休暇チェック
                const hasPaidLeave = dayRecords.some(r => r.type === 'paid_leave');
                if (hasPaidLeave) {
                    paidLeaveDays++;
                    continue; // 有給の日は勤務時間計算をスキップ
                }

                // 欠勤チェック
                const hasAbsence = dayRecords.some(r => r.type === 'absence');
                if (hasAbsence) {
                    absenceDays++;
                    continue; // 欠勤の日は勤務時間計算をスキップ
                }

                // 従業員の個別設定を使用して勤務データを計算
                const dayData = calculateDayWorkData(
                    dayRecords.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate()),
                    employeeConfig,
                    workDate
                );

                if (dayData) {
                    workingDays++;
                    totalWorkMinutes += dayData.workMinutes;
                    totalOvertimeMinutes += dayData.overtimeMinutes;

                    // 休日出勤の場合
                    if (dayData.isHolidayWork) {
                        holidayWorkDays++;
                        holidayWorkMinutes += dayData.workMinutes;
                    }

                    if (dayData.isLate) {
                        latenessCount++;
                        totalLatenessMinutes += dayData.lateMinutes;
                    }

                    if (dayData.isEarlyLeave) {
                        earlyLeaveCount++;
                        totalEarlyLeaveMinutes += dayData.earlyLeaveMinutes;
                    }
                }

                // PC情報収集
                dayRecords.forEach(r => {
                    if (r.pcIdentifier) usedPCs.add(r.pcIdentifier);
                });
            }

            const totalWorkHours = (totalWorkMinutes / 60).toFixed(1);
            const averageWorkHours = workingDays > 0 ? (totalWorkMinutes / 60 / workingDays).toFixed(1) : 0;
            const totalOvertimeHours = (totalOvertimeMinutes / 60).toFixed(1);
            const holidayWorkHours = (holidayWorkMinutes / 60).toFixed(1);

            // 出勤率計算（営業日ベース - 簡易版: 期間の平日数を20日と仮定）
            const expectedWorkingDays = 20;
            const attendanceRate = ((workingDays / expectedWorkingDays) * 100).toFixed(1);

            monthlySummaryData.push({
                userId,
                userName: userData.userName,
                workingDays,
                totalWorkHours,
                averageWorkHours,
                totalOvertimeHours,
                holidayWorkDays,
                holidayWorkHours,
                latenessCount,
                totalLatenessMinutes,
                earlyLeaveCount,
                totalEarlyLeaveMinutes,
                absenceDays,
                paidLeaveDays,
                attendanceRate,
                usedPCs: Array.from(usedPCs),
                // 従業員設定情報を追加
                employeeSettings: employeeConfig
            });

            processedUsers++;
        }

        console.log(`月次集計完了: ${processedUsers}名の従業員を処理しました`);

        // 結果を表示
        displayMonthlySummary();
        document.getElementById('monthlySummaryResults').style.display = 'block';
        
        const message = `✅ 月次集計が完了しました（${processedUsers}名、従業員個別設定適用）`;
        showMessage(message, 'success');

    } catch (error) {
        console.error('月次集計エラー:', error);
        showMessage('❌ 月次集計に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 月次集計結果を表示
 */
function displayMonthlySummary() {
    const tbody = document.getElementById('monthlySummaryTableBody');

    if (monthlySummaryData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; color: #999; padding: 50px;">集計データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = monthlySummaryData.map(summary => `
        <tr>
            <td>
                ${summary.userName}
                ${summary.employeeSettings ? 
                    `<br><small style="color: #666; font-size: 0.8em;">
                        ${summary.employeeSettings.startTime}-${summary.employeeSettings.endTime} 
                        (${summary.employeeSettings.standardWorkTime}h)
                    </small>` : ''
                }
            </td>
            <td>${summary.workingDays}日</td>
            <td>${summary.totalWorkHours}h</td>
            <td>${summary.averageWorkHours}h</td>
            <td>${summary.totalOvertimeHours}h</td>
            <td>${summary.latenessCount}回</td>
            <td>${summary.earlyLeaveCount}回</td>
            <td>${summary.absenceDays}日</td>
            <td>${summary.paidLeaveDays}日</td>
            <td>${summary.attendanceRate}%</td>
            <td>
                <button class="button button-primary button-small" onclick="saveMonthlySummaryGlobal('${summary.userId}')">
                    保存
                </button>
            </td>
        </tr>
    `).join('');

    console.log('月次集計結果表示完了');
}

/**
 * 月次集計をFirestoreに保存
 * @param {string} userId - ユーザーID
 * @param {Object} currentUser - 現在のユーザー情報
 * @param {Function} showMessage - メッセージ表示関数
 */
export async function saveMonthlySummary(userId, currentUser, showMessage) {
    try {
        const summary = monthlySummaryData.find(s => s.userId === userId);
        if (!summary) {
            showMessage('❌ 集計データが見つかりません', 'error');
            return;
        }

        const year = parseInt(document.getElementById('targetYear').value);
        const month = parseInt(document.getElementById('targetMonth').value);
        const { periodStart, periodEnd } = calculatePeriod(year, month);

        const summaryId = `${userId}_${year}_${month}`;
        
        // 日付フォーマット関数
        function formatDateForInput(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        const summaryDoc = {
            userId: summary.userId,
            userName: summary.userName,
            targetYear: year,
            targetMonth: month,
            periodStart: formatDateForInput(periodStart),
            periodEnd: formatDateForInput(periodEnd),
            workingDays: summary.workingDays,
            totalWorkMinutes: parseFloat(summary.totalWorkHours) * 60,
            totalWorkHours: parseFloat(summary.totalWorkHours),
            averageWorkHours: parseFloat(summary.averageWorkHours),
            overtimeMinutes: parseFloat(summary.totalOvertimeHours) * 60,
            overtimeHours: parseFloat(summary.totalOvertimeHours),
            latenessCount: summary.latenessCount,
            latenessMinutes: summary.totalLatenessMinutes,
            earlyLeaveCount: summary.earlyLeaveCount,
            earlyLeaveMinutes: summary.totalEarlyLeaveMinutes,
            paidLeaveDays: summary.paidLeaveDays,
            absenceDays: summary.absenceDays,
            usedPCs: summary.usedPCs,
            // 使用した個別設定を記録
            appliedSettings: summary.employeeSettings,
            calculatedAt: serverTimestamp(),
            isFinalized: false
        };

        console.log('月次集計データ保存中...', summaryDoc);
        await setDoc(doc(db, 'monthly_summaries', summaryId), summaryDoc);
        
        const message = `✅ ${summary.userName}の集計データを保存しました（個別設定適用済み）`;
        showMessage(message, 'success');
        console.log('月次集計データ保存完了:', summaryId);

    } catch (error) {
        console.error('保存エラー:', error);
        showMessage('❌ 保存に失敗しました: ' + error.message, 'error');
    }
}

/**
 * 月次集計結果をCSVファイルとしてエクスポート
 * @param {Function} showMessage - メッセージ表示関数
 */
export function exportMonthlySummaryCSV(showMessage) {
    if (monthlySummaryData.length === 0) {
        showMessage('❌ エクスポートするデータがありません。先に集計を実行してください。', 'error');
        return;
    }

    const year = document.getElementById('targetYear').value;
    const month = document.getElementById('targetMonth').value;

    // CSVヘッダー
    let csv = '従業員名,出勤日数,労働時間(h),休日出勤(日),休日時間(h),残業時間(h),有給日数,欠勤日数,遅刻(回),早退(回),その他\n';

    monthlySummaryData.forEach(summary => {
        csv += `${summary.userName},`;
        csv += `${summary.workingDays},`;
        csv += `${summary.totalWorkHours},`;
        csv += `${summary.holidayWorkDays},`;
        csv += `${summary.holidayWorkHours},`;
        csv += `${summary.totalOvertimeHours},`;
        csv += `${summary.paidLeaveDays},`;
        csv += `${summary.absenceDays},`;
        csv += `${summary.latenessCount},`;
        csv += `${summary.earlyLeaveCount},`;
        csv += `\n`; // その他欄は空白
    });

    // BOM付きでCSVをダウンロード
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `月次集計_${year}年${month}月_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showMessage('✅ CSVファイルをダウンロードしました', 'success');
    console.log('CSV出力完了');
}

/**
 * 集計期間表示を更新
 */
export function updatePeriodDisplay() {
    const year = parseInt(document.getElementById('targetYear').value);
    const month = parseInt(document.getElementById('targetMonth').value);
    const { periodStart, periodEnd } = calculatePeriod(year, month);

    const startStr = `${periodStart.getFullYear()}/${String(periodStart.getMonth() + 1).padStart(2, '0')}/${String(periodStart.getDate()).padStart(2, '0')}`;
    const endStr = `${periodEnd.getFullYear()}/${String(periodEnd.getMonth() + 1).padStart(2, '0')}/${String(periodEnd.getDate()).padStart(2, '0')}`;

    document.getElementById('periodDisplay').textContent = `集計期間: ${startStr} 〜 ${endStr}`;
}

/**
 * 従業員一覧を月次集計用フィルターに設定
 * 個別設定情報も表示に追加
 */
export async function loadMonthlyEmployeeList() {
    try {
        console.log('従業員フィルター一覧読み込み中...');
        
        const employeeSettings = await loadEmployeeData();
        const select = document.getElementById('monthlyEmployeeFilter');
        
        if (!select) {
            console.warn('monthlyEmployeeFilter要素が見つかりません');
            return;
        }

        select.innerHTML = '<option value="">全従業員</option>';

        let addedCount = 0;
        Object.entries(employeeSettings).forEach(([userId, data]) => {
            if (data.displayName) {
                const option = document.createElement('option');
                option.value = userId;
                // 個別設定情報を選択肢に表示
                option.textContent = `${data.displayName} (${data.startTime}-${data.endTime}, ${data.standardWorkTime}h)`;
                select.appendChild(option);
                addedCount++;
            }
        });

        console.log(`従業員フィルター読み込み完了: ${addedCount}名`);
        
    } catch (error) {
        console.error('従業員一覧読み込みエラー:', error);
    }
}

// グローバル関数として公開（HTMLから呼び出すため）
window.togglePeriodInput = function() {
    togglePeriodInput();
};

window.calculateMonthlySummaryGlobal = function() {
    // グローバルスコープの変数とのやり取りのためのラッパー関数
    const currentUser = window.currentUser;
    const showMessage = window.showMessage;

    if (!currentUser) {
        console.error('currentUserが設定されていません');
        if (showMessage) showMessage('❌ ユーザー情報が取得できません', 'error');
        return;
    }

    if (!showMessage) {
        console.error('showMessage関数が設定されていません');
        return;
    }

    calculateMonthlySummary(currentUser, showMessage);
};

window.saveMonthlySummaryGlobal = function(userId) {
    const currentUser = window.currentUser;
    const showMessage = window.showMessage;

    if (!currentUser || !showMessage) {
        console.error('グローバル変数が設定されていません');
        return;
    }

    saveMonthlySummary(userId, currentUser, showMessage);
};

window.exportMonthlySummaryCSVGlobal = function() {
    const showMessage = window.showMessage;

    if (!showMessage) {
        console.error('showMessage関数が設定されていません');
        return;
    }

    exportMonthlySummaryCSV(showMessage);
};

/**
 * モジュール初期化
 * 年月変更時の期間表示更新、従業員リスト読み込み
 */
export function initializeMonthlyModule() {
    console.log('月次集計モジュール初期化開始...');

    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUI);
    } else {
        initializeUI();
    }

    function initializeUI() {
        // 従業員リスト読み込み
        loadMonthlyEmployeeList().then(() => {
            console.log('従業員リスト読み込み完了');
        }).catch(error => {
            console.error('従業員リスト読み込み失敗:', error);
        });

        // 初期期間表示
        updatePeriodDisplay();

        // 年月変更時に期間表示を更新
        const yearSelect = document.getElementById('targetYear');
        const monthSelect = document.getElementById('targetMonth');
        
        if (yearSelect && monthSelect) {
            yearSelect.addEventListener('change', updatePeriodDisplay);
            monthSelect.addEventListener('change', updatePeriodDisplay);
            console.log('年月変更イベントリスナー登録完了');
        } else {
            console.warn('年月選択要素が見つかりません');
        }

        console.log('月次集計モジュール初期化完了');
    }
}

// モジュール読み込み時に初期化実行
initializeMonthlyModule();
