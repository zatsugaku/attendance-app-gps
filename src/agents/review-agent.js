import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'zatsugaku';
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'office-timecard-system';

/**
 * ReviewAgent - コード品質判定
 *
 * 役割:
 * 1. 生成されたコードの品質チェック
 * 2. セキュリティスキャン
 * 3. 品質スコアリング（100点満点、80点以上で合格）
 * 4. 改善提案
 */
export async function reviewAgent(issueNumber, generatedFiles) {
  console.log(`[ReviewAgent] Reviewing ${generatedFiles.length} files for Issue #${issueNumber}`);

  try {
    // Issueにコメント（開始通知）
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## 🔍 ReviewAgent - コード品質チェック開始

レビュー対象: ${generatedFiles.length}ファイル

実行中...

🌸 Miyabi - ReviewAgent`
    });

    // 各ファイルの内容を読み込み
    const fileContents = await Promise.all(
      generatedFiles.map(async (filePath) => {
        const content = await fs.readFile(filePath, 'utf-8');
        return { path: filePath, content };
      })
    );

    // Claude APIでレビュー
    const reviewPrompt = `あなたはReviewAgentです。以下のコードをレビューしてください。

## レビュー対象ファイル
${fileContents.map(f => `
### ${f.path}
\`\`\`
${f.content}
\`\`\`
`).join('\n')}

## レビュー観点（CSSファイルの場合）
1. **コード品質** (30点)
   - 可読性、保守性、コメントの充実度
   - CSS変数の使用（カラー、サイズなど）
   - セクション分けの明確さ

2. **機能性** (30点)
   - 要件を満たしているか
   - デザインの一貫性
   - レスポンシブデザイン対応

3. **アクセシビリティ** (20点)
   - focus状態のスタイル
   - 十分なコントラスト比
   - キーボードナビゲーション対応

4. **パフォーマンス** (20点)
   - GPU加速の使用（will-change, transform: translateZ(0)）
   - 不要な重複の削減
   - 効率的なセレクタ
   - ネットワーク最適化

## 出力形式（JSON）
{
  "totalScore": 85,
  "passed": true,
  "categories": {
    "quality": 25,
    "functionality": 28,
    "security": 18,
    "performance": 14
  },
  "issues": [
    {
      "file": "public/css/admin-styles.css",
      "severity": "low",
      "message": "改善提案の内容"
    }
  ],
  "summary": "総評"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: reviewPrompt
      }]
    });

    const reviewText = response.content[0].text;
    console.log('[ReviewAgent] Review:', reviewText);

    // JSONを抽出
    const jsonMatch = reviewText.match(/```json\n([\s\S]*?)\n```/);
    const review = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(reviewText);

    // 品質スコアの判定
    const passed = review.totalScore >= 80;
    const emoji = passed ? '✅' : '❌';

    // Issueにコメント
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ${emoji} ReviewAgent - レビュー完了

### 品質スコア: ${review.totalScore}/100 ${passed ? '（合格）' : '（不合格）'}

| 観点 | スコア |
|------|--------|
| コード品質 | ${review.categories.quality}/30 |
| 機能性 | ${review.categories.functionality}/30 |
| セキュリティ | ${review.categories.security}/20 |
| パフォーマンス | ${review.categories.performance}/20 |

### 総評
${review.summary}

${review.issues.length > 0 ? `
### 指摘事項（${review.issues.length}件）
${review.issues.map((issue, i) => `
${i + 1}. **[${issue.severity.toUpperCase()}]** ${issue.file}
   ${issue.message}
`).join('\n')}
` : '指摘事項なし'}

${passed ? '次のステップ: PRAgentを実行します...' : '品質スコアが80点未満のため、CodeGenAgentで修正が必要です。'}

🌸 Miyabi - ReviewAgent`
    });

    return { passed, review };
  } catch (error) {
    console.error('[ReviewAgent] Error:', error);

    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ❌ ReviewAgent - エラー

エラーが発生しました:
\`\`\`
${error.message}
\`\`\`

🌸 Miyabi - ReviewAgent`
    });

    throw error;
  }
}
