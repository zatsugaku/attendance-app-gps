/**
 * 表示モジュール - 従業員タイムカード用
 *
 * 機能:
 * - 時計表示
 * - PC識別情報生成・表示
 * - 勤務時間計算・表示
 * - リアルタイム更新
 * - 深夜0時の自動リロード
 */

// グローバル変数
let workTimeInterval = null;
let todayRecords = [];

/**
 * PC識別情報を生成
 * @returns {string} PC識別情報
 */
export function generatePCIdentifier() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const screenResolution = `${screen.width}x${screen.height}`;

    const pcInfo = `${platform} | ${screenResolution} | ${language}`;

    // グローバルに保存（他のモジュールで使用）
    window.pcInfo = pcInfo;

    // DOM要素に表示
    const pcIdentifier = document.getElementById('pcIdentifier');
    if (pcIdentifier) {
        pcIdentifier.textContent = pcInfo;
    }

    return pcInfo;
}

/**
 * 時計を更新
 */
function updateClock() {
    const now = new Date();
    const dateOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    };
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };

    const currentDate = document.getElementById('currentDate');
    const currentTime = document.getElementById('currentTime');

    if (currentDate) {
        currentDate.textContent = now.toLocaleDateString('ja-JP', dateOptions);
    }

    if (currentTime) {
        currentTime.textContent = now.toLocaleTimeString('ja-JP', timeOptions);
    }
}

/**
 * 深夜0時に自動リロードを設定
 */
function setupMidnightReload() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow - now;

    console.log(`次の自動リロードまで: ${Math.floor(msUntilMidnight / 1000 / 60)}分`);

    setTimeout(() => {
        console.log('日付が変わりました。自動リロードします。');
        location.reload();
    }, msUntilMidnight);
}

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
 * 勤務時間表示を更新
 */
function updateWorkTimeDisplay() {
    const workTimeArea = document.getElementById('workTimeArea');
    const workTimeValue = document.getElementById('workTimeValue');
    const workTimeStatus = document.getElementById('workTimeStatus');

    if (!workTimeArea || !workTimeValue || !workTimeStatus) {
        return;
    }

    if (todayRecords.length === 0) {
        workTimeArea.style.display = 'none';
        return;
    }

    const workTime = calculateWorkTime(todayRecords);

    if (!workTime) {
        workTimeArea.style.display = 'none';
        return;
    }

    workTimeArea.style.display = 'block';
    workTimeValue.textContent = `${workTime.hours}時間${workTime.minutes}分`;

    if (workTime.isFinished) {
        workTimeStatus.textContent = '（確定）';
    } else if (workTime.isOnBreak) {
        workTimeStatus.textContent = '（外出中 - 一時停止）';
    } else {
        workTimeStatus.textContent = '（勤務中 - カウント中）';
    }
}

/**
 * リアルタイム更新を開始
 */
function startWorkTimeUpdate() {
    // 既存のインターバルをクリア
    if (workTimeInterval) {
        clearInterval(workTimeInterval);
    }

    // 1秒ごとに更新
    workTimeInterval = setInterval(() => {
        updateWorkTimeDisplay();
    }, 1000);
}

/**
 * リアルタイム更新を停止
 */
export function stopWorkTimeUpdate() {
    if (workTimeInterval) {
        clearInterval(workTimeInterval);
        workTimeInterval = null;
    }
}

/**
 * 勤務時間表示を更新（外部から呼び出し可能）
 * @param {Array} records - 本日の打刻記録
 * @param {boolean} shouldStartUpdate - リアルタイム更新を開始するか
 */
export function updateWorkTime(records, shouldStartUpdate = false) {
    todayRecords = records;
    updateWorkTimeDisplay();

    if (shouldStartUpdate) {
        startWorkTimeUpdate();
    } else {
        stopWorkTimeUpdate();
    }
}

/**
 * 表示モジュールの初期化
 */
export function initializeDisplayModule() {
    // PC識別情報を生成
    generatePCIdentifier();

    // 時計の更新を開始
    setInterval(updateClock, 1000);
    updateClock();

    // 深夜0時の自動リロードを設定
    setupMidnightReload();

    // generatePCIdentifier をグローバルに公開（timecard-auth.jsで使用）
    window.generatePCIdentifier = generatePCIdentifier;

    console.log('🖥️ Display module initialized');
}
